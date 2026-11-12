import type { Logger } from '@u7-scl/core/shared';
import { ConsoleLogger } from '@u7-scl/core/shared';
import {
  CourseJsonRepo,
  type CourseRepo,
  createCourseModule,
  LessonJsonRepo,
  type LessonRepo,
  ModuleJsonRepo,
  type ModuleRepo,
  StepJsonRepo,
  type StepRepo,
} from '@u7-scl/course';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { DossierModuleDef } from '@u7-scl/domain/dossier/contract';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review/contract';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { WishModuleDef } from '@u7-scl/domain/wish/contract';
import { createDossierModule } from '@u7-scl/dossier';
import {
  createPeerReviewModule,
  ReviewCampaignJsonRepo,
  type ReviewCampaignRepo,
  ReviewJsonRepo,
  type ReviewRepo,
} from '@u7-scl/peer-review';
import {
  createQuestionnaireModule,
  QuestionnaireJsonRepo,
  type QuestionnaireRepo,
} from '@u7-scl/questionnaire';
import {
  createStreamModule,
  type StreamDeps,
  StreamJsonRepo,
  StudentJsonRepo,
} from '@u7-scl/stream';
import { createUserModule, UserJsonRepo, type UserRepo } from '@u7-scl/user';
import { createWishModule, WishJsonRepo, type WishRepo } from '@u7-scl/wish';
import type { Identified } from 'dmg-core';
import {
  ApiApp,
  type AppContext,
  type Clock,
  type EventBus,
  InProcEventBus,
  InProcInbox,
  InProcJobScheduler,
  InProcOutbox,
  InProcReplayStore,
  JsonlOperationLog,
  type ModuleFactory,
} from 'dmg-core/app';
import { appClock } from './app-clock';
import { JobRunJsonRepo } from './infra/job-run-json-repo';
import { createSchool, type School, TEST_SCHOOL } from './school';
import type { U7AppEnv, U7AppPorts, U7AppResolver } from './u7-app.types';
import { U7CallerResolver } from './u7-caller-resolver';

/**
 * Приложение u7-school — корень сборки (D-50): по окружению строит
 * репозитории `<dbDir>/…`, приложение DMG (все модули по `dependsOn` на своих
 * репозиториях), шину DMG и планировщик заданий модулей. Наружу отдаёт
 * приложение DMG (`apiApp`), шину DMG (`eventBus`), школу и резолвер `callers`.
 * Контроллеры и транспорт строит раннер.
 */
export class U7App {
  /** Приложение DMG — единственный вход в модули (D-49). */
  readonly apiApp: ApiApp<Identified>;
  /** Шина DMG: подписка по Def, публикация конвертов. */
  readonly eventBus: EventBus;
  readonly school: School;
  readonly appResolver: U7AppResolver;
  readonly callers: U7CallerResolver;

  /** Задания модулей по расписанию (D-71): запускает `start()`, снимает `stop()`. */
  readonly #scheduler: InProcJobScheduler;

  constructor(env: U7AppEnv, ports: U7AppPorts = {}) {
    const { dbDir } = env;

    const mentors =
      env.mentors ??
      (env.mode !== 'production' ? TEST_SCHOOL.mentors : undefined);

    const school = createSchool({
      communityGroup: env.communityGroup,
      studentGroup: env.studentGroup,
      ...(mentors ? { mentors } : {}),
    });

    const logger = ports.logger ?? new ConsoleLogger();
    const bus = new InProcEventBus(logger);
    const appResolver: U7AppResolver = {
      logger,
      mode: env.mode,
      eventBus: bus,
      school,
    };

    // ══ Peer-review: репозитории кампаний и отзывов (DMG) ══
    const reviewCampaignRepo = new ReviewCampaignJsonRepo(
      `${dbDir}/peer-review/campaigns.json`,
    );
    const reviewRepo = new ReviewJsonRepo(`${dbDir}/peer-review/reviews.json`);

    // ══ DMG: модули по `dependsOn` — каждый на своих репозиториях ══
    const context = U7App.dmgContext(env, bus, appClock, logger);
    const dmg = U7App.dmgApp(context, {
      users: new UserJsonRepo(`${dbDir}/users/users.json`),
      courses: new CourseJsonRepo(`${dbDir}/courses/courses.json`),
      modules: new ModuleJsonRepo(`${dbDir}/courses/modules.json`),
      lessons: new LessonJsonRepo(`${dbDir}/courses/lessons.json`),
      steps: new StepJsonRepo(`${dbDir}/courses/steps.json`),
      wishes: new WishJsonRepo(`${dbDir}/wish/wishes.json`),
      questionnaires: new QuestionnaireJsonRepo(
        `${dbDir}/questionnaires/questionnaires.json`,
      ),
      campaigns: reviewCampaignRepo,
      reviews: reviewRepo,
      streams: new StreamJsonRepo(`${dbDir}/streams/streams.json`),
      students: new StudentJsonRepo(`${dbDir}/streams/students.json`),
      schoolId: school.id,
    });

    const startDelayMs = ports.jobStartDelayMs;

    this.#scheduler = new InProcJobScheduler({
      api: dmg.api,
      modules: dmg.modules,
      clock: appClock,
      logger,
      store: new JobRunJsonRepo(`${dbDir}/jobs/last-runs.json`, logger),
      ...(startDelayMs === undefined ? {} : { startDelayMs }),
    });

    this.apiApp = dmg.api;
    this.eventBus = bus;
    this.school = school;
    this.appResolver = appResolver;
    this.callers = new U7CallerResolver(dmg.api);

    // Реакции модулей — на шину до первого `dispatch` (события UC идут в outbox).
    dmg.api.subscribe();
  }

  /** Запускает периодические задания модулей (D-71). */
  start(): void {
    this.#scheduler.start();
  }

  /** Останавливает задания; идущий прогон не прерывает. */
  stop(): void {
    this.#scheduler.stop();
  }

  /**
   * Контекст приложения для модулей DMG: шина DMG, outbox и inbox в процессе
   * (D-47), часы корня сборки, логгер приложения, JSONL-лог операций
   * `<dbDir>/oplog`, отсев повторов команд (D-56) — переданный или в памяти.
   */
  private static dmgContext(
    env: U7AppEnv,
    bus: EventBus,
    clock: Clock,
    logger: Logger,
  ): AppContext {
    return {
      bus,
      outbox: new InProcOutbox(bus),
      inbox: new InProcInbox(),
      clock,
      logger,
      mode: env.mode,
      oplog: new JsonlOperationLog(`${env.dbDir}/oplog`),
      replay: env.replay ?? new InProcReplayStore({ clock }),
    };
  }

  /**
   * Приложение DMG: все модули по `dependsOn` — `user`, `course`, `wish`,
   * `peer-review` (кампании), `questionnaire`, `stream`, `dossier` — на своих
   * репозиториях, собранные `ApiApp` пакета (D-50). `modules` — их Def для
   * планировщика заданий (D-71).
   */
  private static dmgApp(
    context: AppContext,
    repos: {
      readonly users: UserRepo;
      readonly courses: CourseRepo;
      readonly modules: ModuleRepo;
      readonly lessons: LessonRepo;
      readonly steps: StepRepo;
      readonly wishes: WishRepo;
      readonly questionnaires: QuestionnaireRepo;
      readonly campaigns: ReviewCampaignRepo;
      readonly reviews: ReviewRepo;
      readonly streams: StreamDeps['streams'];
      readonly students: StreamDeps['students'];
      readonly schoolId: string;
    },
  ) {
    const factories: ModuleFactory<Identified>[] = [
      {
        def: UserModuleDef,
        create: (deps) => createUserModule({ ...deps, users: repos.users }),
      },
      {
        def: CourseModuleDef,
        create: (deps) =>
          createCourseModule({
            ...deps,
            courses: repos.courses,
            modules: repos.modules,
            lessons: repos.lessons,
            steps: repos.steps,
          }),
      },
      {
        def: QuestionnaireModuleDef,
        create: (deps) =>
          createQuestionnaireModule({
            ...deps,
            questionnaires: repos.questionnaires,
          }),
      },
      {
        def: StreamModuleDef,
        create: (deps) =>
          createStreamModule({
            ...deps,
            streams: repos.streams,
            students: repos.students,
            schoolId: repos.schoolId,
          }),
      },
      {
        def: WishModuleDef,
        create: (deps) => createWishModule({ ...deps, wishes: repos.wishes }),
      },
      {
        def: PeerReviewModuleDef,
        create: (deps) =>
          createPeerReviewModule({
            ...deps,
            campaigns: repos.campaigns,
            reviews: repos.reviews,
          }),
      },
      {
        def: DossierModuleDef,
        create: (deps) => createDossierModule(deps),
      },
    ];
    return {
      api: new ApiApp<Identified>(context, factories),
      modules: factories.map((f) => f.def),
    };
  }
}
