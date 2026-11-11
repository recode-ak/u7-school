/**
 * `_course-client.ts` — клиент курса для скриптов распространения.
 *
 * Собирает корень сборки `U7App` (D-50) над каталогом данных скрипта и вызывает
 * query-UC модуля `course` через `dispatch` (D-49) от имени администратора:
 * `listModules`, `getModuleSnapshot`, `getLesson`, `getStep`. Отказ UC —
 * исключение скрипта (ERR-01).
 *
 * ```ts
 * const course = await CourseClient.create({ silent: true });
 * const modules = await course.listModules();
 * ```
 */
import { U7App } from '@u7-scl/app';
import { TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import { type Logger, LogLevel } from '@u7-scl/core/shared';
import {
  type ContentSnapshot,
  CourseModuleDef,
  GetLessonUcDef,
  GetModuleSnapshotUcDef,
  GetStepUcDef,
  type LessonView,
  ListModulesUcDef,
  type ModuleSummary,
  type StepView,
} from '@u7-scl/domain/course/contract';
import { type InputOf, type OutputOf, UseCaseDef } from 'dmg-core';
import { Trace } from 'dmg-core/app';

/** UUID автора-ментора (Нур) — субъект запросов скриптов (`call-uc` тоже). */
export const NUR_UUID = '8d9a56f6-51e7-49f0-ba58-2832b157e718';

/** UC модуля курсов: команда собирается только для его Def. */
type CourseUcDef = (typeof CourseModuleDef)['useCases'][number];

/** Субъект запросов: человек из резолвера приложения. */
type CourseCaller = Awaited<ReturnType<U7App['callers']['resolve']>>;

/** No-op логгер — консольная утилита не показывает служебные логи модулей. */
const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  setLogLevel: () => {},
  getLogLevel: () => LogLevel.INFO,
  setSourceLevel: () => {},
};

/** Клиент курса: один экземпляр на запуск скрипта. */
export class CourseClient {
  private constructor(
    private readonly app: U7App,
    private readonly caller: CourseCaller,
    private readonly trace: Trace,
  ) {}

  /**
   * Собирает приложение над каталогом данных `DB_DIR` (по умолчанию `data`) и
   * готовит субъект администратора. `silent` — без служебных логов модулей.
   * Нет пользователя `NUR_UUID` в каталоге — исключение: гостевой субъект
   * видел бы не то, что видит администратор.
   */
  static async create(
    options: { silent?: boolean } = {},
  ): Promise<CourseClient> {
    const dbDir = process.env.DB_DIR ?? 'data';
    const app = new U7App(
      {
        mode: 'development',
        dbDir,
        communityGroup: TEST_SCHOOL.communityGroup,
        studentGroup: TEST_SCHOOL.studentGroup,
        mentors: [...TEST_SCHOOL.mentors],
      },
      options.silent ? { logger: silentLogger } : {},
    );
    const trace = Trace.fromRequest({
      requestId: crypto.randomUUID(),
      channel: { name: 'cli' },
    });
    const admin = await app.userFacade.getUserByUuid(NUR_UUID);
    if (!admin) {
      throw new Error(
        `пользователь ${NUR_UUID} не найден в ${dbDir}/users/users.json: ` +
          'скрипт работает от имени администратора, гостевой субъект недопустим',
      );
    }
    const caller = await app.callers.resolve(admin.uuid, trace);
    return new CourseClient(app, caller, trace);
  }

  /** Модули для показа — `listModules`. */
  listModules(): Promise<ModuleSummary[]> {
    return this.query(ListModulesUcDef, {});
  }

  /** Снимок контента модуля — `getModuleSnapshot`. */
  moduleSnapshot(moduleId: string): Promise<ContentSnapshot> {
    return this.query(GetModuleSnapshotUcDef, { moduleId });
  }

  /** Урок по идентификатору — `getLesson`. */
  lesson(lessonId: string): Promise<LessonView> {
    return this.query(GetLessonUcDef, { lessonId });
  }

  /** Шаг по идентификатору — `getStep`. */
  step(stepId: string): Promise<StepView> {
    return this.query(GetStepUcDef, { stepId });
  }

  private async query<D extends CourseUcDef>(
    uc: D,
    input: InputOf<D>,
  ): Promise<OutputOf<D>> {
    const res = await this.app.apiApp.dispatch(
      CourseModuleDef,
      UseCaseDef.commandOf(uc, input),
      this.caller,
      this.trace,
    );
    if (!res.ok) throw new Error(`${res.error.code}: ${res.error.label}`);
    return res.value;
  }
}
