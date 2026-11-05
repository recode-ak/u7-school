/**
 * _app-factory.ts — общая фабрика для скриптов распространения.
 *
 * ## Назначение
 * Создаёт полный стек ApiApp так же, как это делает реальное приложение бота.
 * Каждый скрипт получает готовый `app` и работает только через
 * `app.execute(useCase, ...)` — это гарантирует, что скрипт одновременно
 * является интеграционным тестом всего стека:
 *   - LegacyModuleJsonRepo, LegacyLessonJsonRepo, LegacyStepJsonRepo
 *   - UserJsonRepo → UserApiModule → UserInProcFacade
 *   - CourseApiModule со всеми use-case'ами
 *   - Visibility-политики (LegacyModuleAr.getVisibleFor, LegacyLessonAr.getVisibleFor)
 *   - safeConvert (форматирование Markdown → Telegram MarkdownV2)
 *
 * ## Требования к данным
 * Для работы скриптов через API необходимы:
 *   - `data/users/users.json` — минимум один пользователь с ролью ADMIN
 *     (NUR_UUID). Создаётся вручную, если отсутствует.
 *   - `data/courses/modules.json` — все модули и проекты должны иметь
 *     валидный статус: `draft`, `published` или `archived`.
 *     `CourseDs.buildSnapshot` включает только published-проекты.
 *   - `data/courses/lessons.json` — уроки с валидными status и stepIds.
 *   - `data/courses/steps.json` — шаги с kind: text/code/file.
 *
 * ## Использование
 * ```ts
 * import { createApp } from './_app-factory';
 * const app = createApp();
 * const modules = await app.execute('list-modules', {});
 * ```
 *
 * ## Примечание
 * NUR_UUID — автор-ментор, от имени которого выполняются запросы.
 * Для скриптов это всегда администратор с полным доступом.
 */
import { TEST_SCHOOL, type U7AppResolver } from '@u7-scl/app-legacy/domain';
import { ApiApp } from '@u7-scl/core/api';
import type { AppMeta } from '@u7-scl/core/domain';
import { type Logger, LogLevel } from '@u7-scl/core/shared';
import type { CourseApiModuleMeta } from '@u7-scl/domain/course';
import type { UserApiModuleMeta } from '@u7-scl/domain/user';
import { CourseApiModule } from '../modules/course/src/api/module.ts';
import { LegacyCourseJsonRepo } from '../modules/course/src/infra/db/course-json-repo.ts';
import { LegacyLessonJsonRepo } from '../modules/course/src/infra/db/lesson-json-repo.ts';
import { LegacyModuleJsonRepo } from '../modules/course/src/infra/db/module-json-repo.ts';
import { LegacyStepJsonRepo } from '../modules/course/src/infra/db/step-json-repo.ts';
import { UserApiModule } from '../modules/user/src/api/index.ts';
import { UserJsonRepo } from '../modules/user/src/infra/db/user-json-repo.ts';
import { UserInProcFacade } from '../modules/user/src/infra/user-in-proc-facade.ts';
import {
  InProcEventBus,
  InProcJobScheduler,
} from '../platform/core/src/infra/index.ts';

/** UUID автора-ментора (Нур) */
export const NUR_UUID = '8d9a56f6-51e7-49f0-ba58-2832b157e718';

/**
 * Резолвит полный User-объект по UUID через UC 'get-user'
 * (сам UC публичный — actor не требуется).
 */
export async function resolveActor(
  app: ReturnType<typeof createApp>,
  uuid: string,
) {
  const user = await app.execute('get-user', { uuid });
  return user;
}

/** No-op логгер для подавления служебных логов API-модулей */
const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  setLogLevel: () => {},
  getLogLevel: () => LogLevel.INFO,
  setSourceLevel: () => {},
};

/** Метаданные приложения для скриптов (course + user) */
interface ScriptAppMeta extends AppMeta {
  name: 'script-app';
  moduleMetas: CourseApiModuleMeta | UserApiModuleMeta;
}

/**
 * Создаёт полный экземпляр ApiApp, идентичный тому,
 * что используется в реальном приложении бота.
 *
 * @param silent — если true, служебные логи API-модулей подавляются
 *
 * Порядок сборки повторяет DI реального приложения:
 * 1. Infra-репозитории (JSON-файлы)
 * 2. UserApiModule + UserInProcFacade
 * 3. CourseApiModule (зависит от repos + userFacade)
 * 4. ApiApp регистрирует оба модуля и вызывает init()
 */
export function createApp(silent = false): ApiApp<ScriptAppMeta> {
  const appResolver: U7AppResolver = {
    logger: silent ? silentLogger : (console as unknown as Logger),
    mode: 'development' as const,
    eventBus: new InProcEventBus(),
    school: TEST_SCHOOL,
  };

  const moduleRepo = new LegacyModuleJsonRepo();
  const courseRepo = new LegacyCourseJsonRepo();
  const lessonRepo = new LegacyLessonJsonRepo();
  const stepRepo = new LegacyStepJsonRepo();
  const userRepo = new UserJsonRepo();

  const userModule = new UserApiModule({
    userRepo,
    appResolver,
    eventBus: appResolver.eventBus,
  });
  const userFacade = new UserInProcFacade(userModule);

  const courseModule = new CourseApiModule({
    moduleRepo,
    courseRepo,
    lessonRepo,
    stepRepo,
    userFacade,
    appResolver,
    eventBus: appResolver.eventBus,
  });

  // Планировщик — техническая зависимость: передаётся через init();
  // для скриптов достаточно in-memory-хранилища прогонов.
  const app = new ApiApp([userModule, courseModule]);
  app.init(
    new InProcJobScheduler({
      logger: silent ? silentLogger : (console as unknown as Logger),
    }),
  );

  return app;
}
