import type { U7App } from '@u7-scl/app';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { CoursesController } from './controllers/courses/controller';
import { LearningController } from './controllers/learning/controller';
import { MentorController } from './controllers/mentor/controller';
import { PeerReviewController } from './controllers/peer-review/controller';
import { QuestionnaireController } from './controllers/questionnaire/controller';
import { SchoolController } from './controllers/school/controller';
import { StreamsController } from './controllers/streams/controller';
import { UserController } from './controllers/user/controller';
import type { U7BotUiAppResolve } from './core/u7-bot-app-meta';
import { U7BotUiApp } from './core/ui-app';

/** Поля приложения (`U7App`), нужные UI-слою бота. */
export type UiAppSource = Pick<
  U7App,
  'apiApp' | 'eventBus' | 'userFacade' | 'school' | 'callers'
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
  userController: UserController;
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
  const userController = new UserController();
  const schoolController = new SchoolController();
  // Админ-гейт /log_level и сообщество школы — app-контроллер (данные из resolve)
  const appController = new AppController();

  // Гост-регистрация /start — uiApp через resolve (ФР-4)
  const uiApp = new U7BotUiApp([
    appController,
    schoolController,
    streamController,
    userController,
    courseController,
    learningController,
    mentorController,
    questionnaireController,
    peerReviewController,
  ]);

  // resolve для каскадной инициализации UiApp → контроллеры → стори.
  // actorResolver: резолвит User по telegramId через userFacade;
  // userFacade + botAdminUser — идемпотентная гост-регистрация на /start.
  const botAdminUser = await app.userFacade.getUserByUuid(options.botAdminUuid);
  if (!botAdminUser) {
    throw new Error(
      `BOT_ADMIN_UUID не найден: пользователь ${options.botAdminUuid} не существует`,
    );
  }
  const resolve: U7BotUiAppResolve = {
    eventBus: app.eventBus,
    actorResolver: async (tgId: number) => {
      const user = await app.userFacade.getUserByTelegramId(tgId);
      if (!user) throw new Error(`Пользователь с telegramId ${tgId} не найден`);
      return user;
    },
    appApi: app.apiApp,
    userFacade: app.userFacade,
    botAdminUser,
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
    userController,
    courseController,
    learningController,
    mentorController,
    questionnaireController,
    peerReviewController,
  };
}
