import type { U7App } from '@u7-scl/app';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { getGlobalLogger } from '@u7-scl/core/shared';
import { UserCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { CoursesController } from './controllers/courses/controller';
import { LearningController } from './controllers/learning/controller';
import { MentorController } from './controllers/mentor/controller';
import { PeerReviewController } from './controllers/peer-review/controller';
import { QuestionnaireController } from './controllers/questionnaire/controller';
import { SchoolController } from './controllers/school/controller';
import { StreamsController } from './controllers/streams/controller';
import { requestTrace } from './core/dispatch-uc';
import type { U7BotActor, U7BotUiAppResolve } from './core/u7-bot-app-meta';
import { U7BotUiApp } from './core/ui-app';

/** Поля приложения (`U7App`), нужные UI-слою бота. */
export type UiAppSource = Pick<
  U7App,
  'apiApp' | 'eventBus' | 'school' | 'callers'
>;

/**
 * Результат фабрики UiApp — UI-слой бота.
 */
export interface UiAppBundle {
  uiApp: U7BotUiApp;
  resolve: U7BotUiAppResolve;
  appController: AppController;
  schoolController: SchoolController;
  streamController: StreamsController;
  courseController: CoursesController;
  learningController: LearningController;
  mentorController: MentorController;
  questionnaireController: QuestionnaireController;
  peerReviewController: PeerReviewController;
}

/**
 * Параметры фабрики UiApp (только точечные UI/системные идентификаторы,
 * не зависящие от BotConfig).
 */
export interface CreateUiAppOptions {
  botAdminUuid: string;
  adminTelegramIds?: number[];
}

/**
 * Создаёт U7BotUiApp и все контроллеры, собирает resolve для init.
 *
 * Создание и init разделены: init (с передачей transport) выполняется
 * вызывающим кодом (main.ts) после создания BotTransport.
 */
export async function createUiApp(
  app: UiAppSource,
  options: CreateUiAppOptions,
): Promise<UiAppBundle> {
  const streamController = new StreamsController();
  const courseController = new CoursesController();
  const learningController = new LearningController();
  const mentorController = new MentorController();
  const questionnaireController = new QuestionnaireController();
  const peerReviewController = new PeerReviewController();
  const schoolController = new SchoolController();
  // Админ-гейт /log_level и сообщество школы — app-контроллер (данные из resolve)
  const appController = new AppController();

  const uiApp = new U7BotUiApp([
    appController,
    schoolController,
    streamController,
    courseController,
    learningController,
    mentorController,
    questionnaireController,
    peerReviewController,
  ]);

  // resolve для каскадной инициализации UiApp → контроллеры → стори.
  // actorResolver — `UserCaller` по telegramId; botAdminUuid — гост-регистрация
  // на /start и роли сообщества от имени бота.
  const adminTrace = Trace.fromRequest({ requestId: crypto.randomUUID() });
  const adminCaller = await app.callers.resolve(
    options.botAdminUuid,
    adminTrace,
  );
  if (adminCaller.subject() === undefined) {
    throw new Error(
      `BOT_ADMIN_UUID не найден: пользователь ${options.botAdminUuid} не существует`,
    );
  }
  const resolve: U7BotUiAppResolve = {
    eventBus: app.eventBus,
    actorResolver: async (tgId: number): Promise<U7BotActor> => {
      const trace = requestTrace(tgId, (message) =>
        getGlobalLogger()?.warn('create-ui-app', message, {
          op: 'actorResolver',
        }),
      );
      const caller = await app.callers.resolveByTelegramId(tgId, trace);
      if (!(caller instanceof UserCaller)) {
        throw new Error(`Пользователь с telegramId ${tgId} не найден`);
      }
      return caller;
    },
    appApi: app.apiApp,
    botAdminUuid: options.botAdminUuid,
    school: app.school,
    callers: app.callers,
    adminTelegramIds: options.adminTelegramIds,
  };

  return {
    uiApp,
    resolve,
    appController,
    schoolController,
    streamController,
    courseController,
    learningController,
    mentorController,
    questionnaireController,
    peerReviewController,
  };
}
