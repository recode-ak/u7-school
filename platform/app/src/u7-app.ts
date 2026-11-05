import type { School, U7AppResolver } from '@u7-scl/app-legacy/domain';
import { createSchool, TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import { ApiApp } from '@u7-scl/core/api';
import type { EventBus } from '@u7-scl/core/domain';
import {
  BaseJsonDb,
  InProcEventBus,
  InProcJobScheduler,
  JobRunJsonRepo,
} from '@u7-scl/core/infra';
import { legacyClock, legacyEventBus } from '@u7-scl/core/legacy-bridge';
import type { Logger } from '@u7-scl/core/shared';
import { ConsoleLogger } from '@u7-scl/core/shared';
import {
  createCourseModule,
  type LessonRepo,
  type ModuleRepo,
  type StepRepo,
} from '@u7-scl/course';
import { CourseApiModule } from '@u7-scl/course/api';
import {
  CourseInProcFacade,
  LegacyCourseJsonRepo,
  LegacyLessonJsonRepo,
  LegacyModuleJsonRepo,
  LegacyStepJsonRepo,
  LessonJsonRepo,
  ModuleJsonRepo,
  StepJsonRepo,
} from '@u7-scl/course/infra';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { PeerReviewModuleDef } from '@u7-scl/domain/peer-review/contract';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { WishModuleDef } from '@u7-scl/domain/wish/contract';
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
import { createUserModule } from '@u7-scl/user';
import { UserApiModule } from '@u7-scl/user/api';
import { UserInProcFacade, UserJsonRepo } from '@u7-scl/user/infra';
import { createWishModule, WishJsonRepo, type WishRepo } from '@u7-scl/wish';
import type { Identified } from 'dmg-core';
import {
  type AppContext,
  ApiApp as DmgApiApp,
  InProcInbox,
  InProcOutbox,
  InProcReplayStore,
  JsonlOperationLog,
  type ModuleFactory,
} from 'dmg-core/app';
import type { U7AppEnv, U7AppPorts, U7LegacyFacades } from './u7-app.types';
import type { U7BotAppMeta } from './u7-app-meta';
import { U7CallerResolver } from './u7-caller-resolver';

/**
 * Приложение u7-school — корень сборки (D-50): по окружению
 * строит репозитории `<dbDir>/…`, legacy-модули и фасады, приложение DMG
 * (внешние модули зависимостей над legacy-фасадами и `wish`, фасады по
 * `dependsOn`) и legacy `ApiApp` с ним (`withDmg`), инициализированный
 * планировщиком заданий. Отдаёт поля, нужные UI раннера, и резолвер
 * `callers`. Контроллеры и транспорт строит раннер.
 */
export class U7App {
  readonly apiApp: ApiApp<U7BotAppMeta>;
  readonly eventBus: EventBus;
  readonly userFacade: UserInProcFacade;
  readonly userRepo: UserJsonRepo;
  readonly courseModule: CourseApiModule;
  readonly school: School;
  readonly appResolver: U7AppResolver;
  readonly callers: U7CallerResolver;

  constructor(env: U7AppEnv, ports: U7AppPorts = {}) {
    const { dbDir } = env;
    const db = new BaseJsonDb();

    const mentors =
      env.mentors ??
      (env.mode !== 'production' ? TEST_SCHOOL.mentors : undefined);

    const school = createSchool({
      communityGroup: env.communityGroup,
      studentGroup: env.studentGroup,
      ...(mentors ? { mentors } : {}),
    });

    const logger = ports.logger ?? new ConsoleLogger();
    const appResolver: U7AppResolver = {
      logger,
      mode: env.mode,
      eventBus: new InProcEventBus(),
      school,
    };

    const userRepo = new UserJsonRepo(
      `${dbDir}/users/users.json`,
      `${dbDir}/users/seed.json`,
      db,
    );

    // ══ Модули: резолвер в конструкторе ══
    const userModule = new UserApiModule({
      userRepo,
      appResolver,
      eventBus: appResolver.eventBus,
    });
    const userFacade = new UserInProcFacade(userModule);

    // ══ Course: репозитории, модуль и фасад ══
    const moduleRepo = new LegacyModuleJsonRepo(
      `${dbDir}/courses/modules.json`,
    );
    const lessonRepo = new LegacyLessonJsonRepo(
      `${dbDir}/courses/lessons.json`,
    );
    const stepRepo = new LegacyStepJsonRepo(`${dbDir}/courses/steps.json`);

    const courseRepo = new LegacyCourseJsonRepo(
      `${dbDir}/courses/courses.json`,
    );

    const courseModule = new CourseApiModule({
      db,
      moduleRepo,
      courseRepo,
      lessonRepo,
      stepRepo,
      userFacade,
      appResolver,
      eventBus: appResolver.eventBus,
    });

    const courseFacade = new CourseInProcFacade(courseModule);

    // ══ Peer-review: репозитории кампаний и отзывов (DMG) ══
    const reviewCampaignRepo = new ReviewCampaignJsonRepo(
      `${dbDir}/peer-review/campaigns.json`,
    );
    const reviewRepo = new ReviewJsonRepo(`${dbDir}/peer-review/reviews.json`);

    // ══ DMG: wish, peer-review и внешние модули зависимостей (адаптеры над legacy) ══
    // Шина DMG — поверх общей legacy-шины: события wish и peer-review видят
    // stories, legacy-события stream доходят до ER (D-37).
    const dmg = U7App.dmgApp(
      U7App.dmgContext(env, appResolver.eventBus, logger),
      {
        user: userFacade,
        course: courseFacade,
      },
      {
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
      },
    );

    // ══ ApiApp: модули (legacy + DMG) ══
    const apiApp = new ApiApp<U7BotAppMeta>([userModule, courseModule]).withDmg(
      dmg.api,
      dmg.modules,
    );

    // Планировщик — техническая зависимость: передаётся через init(),
    // lastRunAt персистится — задания переживают перезагрузку (misfire-политика).
    apiApp.init(
      new InProcJobScheduler({
        logger,
        store: new JobRunJsonRepo(`${dbDir}/jobs/last-runs.json`),
      }),
    );

    this.apiApp = apiApp;
    this.eventBus = appResolver.eventBus;
    this.userFacade = userFacade;
    this.userRepo = userRepo;
    this.courseModule = courseModule;
    this.school = school;
    this.appResolver = appResolver;
    this.callers = new U7CallerResolver(userFacade);
  }

  /** Запускает периодические задания (Job) legacy `ApiApp`. */
  start(): void {
    this.apiApp.start();
  }

  /** Останавливает периодические задания. */
  stop(): void {
    this.apiApp.stop();
  }

  /**
   * Контекст приложения для модулей DMG на время сосуществования: шина DMG
   * поверх legacy-шины (входящие legacy-события зависимостей — по картам
   * `inbound`, D-37), outbox и inbox в процессе (D-47), часы legacy, логгер
   * приложения, JSONL-лог операций `<dbDir>/oplog`, отсев повторов команд
   * (D-56) — переданный или в памяти.
   */
  private static dmgContext(
    env: U7AppEnv,
    legacyBus: EventBus,
    logger: Logger,
  ): AppContext {
    const bus = legacyEventBus(legacyBus, {
      inbound: [],
      onInvalid: (message) => logger.warn('legacy-event-bus', message),
    });
    const clock = legacyClock();
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
   * Приложение DMG: внешние модули зависимостей (адаптеры над legacy-фасадами),
   * `wish`, `peer-review` (кампании) и `questionnaire`, собранные `ApiApp`
   * пакета — фасады по `dependsOn` (D-50). `modules` — их Def для заданий
   * legacy-планировщика (`ApiApp.withDmg`).
   */
  private static dmgApp(
    context: AppContext,
    legacy: U7LegacyFacades,
    repos: {
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
        create: (deps) => createUserModule({ ...deps, legacy: legacy.user }),
      },
      {
        def: CourseModuleDef,
        create: (deps) =>
          createCourseModule({
            ...deps,
            legacy: legacy.course,
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
    ];
    return {
      api: new DmgApiApp<Identified>(context, factories),
      modules: factories.map((f) => f.def),
    };
  }
}
