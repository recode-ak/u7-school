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
import { createCourseModule } from '@u7-scl/course';
import { CourseApiModule } from '@u7-scl/course/api';
import {
  CourseInProcFacade,
  CourseJsonRepo,
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
  questionnaireLegacyInbound,
} from '@u7-scl/questionnaire';
import { QuestionnaireApiModule } from '@u7-scl/questionnaire/api';
import type { QuestionnaireApiModuleResolver } from '@u7-scl/questionnaire/domain';
import {
  QuestionnaireJsonRepo as QJsonRepo,
  QuestionnaireInProcFacade,
} from '@u7-scl/questionnaire/infra';
import {
  createStreamModule,
  StreamApiModule,
  StreamInProcFacade,
  StreamJsonRepo,
  StudentJsonRepo,
  streamLegacyInbound,
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
 * Приложение u7-school — корень сборки (D-50, TR-33): по окружению
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
  readonly questionnaireFacade: QuestionnaireInProcFacade;
  readonly streamModule: StreamApiModule;
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

    const streamRepo = new StreamJsonRepo(`${dbDir}/streams/streams.json`);
    const streamStudentRepo = new StudentJsonRepo(
      `${dbDir}/streams/students.json`,
    );

    // ══ Модули: резолвер в конструкторе ══
    const userModule = new UserApiModule({
      userRepo,
      appResolver,
      eventBus: appResolver.eventBus,
    });
    const userFacade = new UserInProcFacade(userModule);

    // ══ Course: репозитории, модуль и фасад ══
    const moduleRepo = new ModuleJsonRepo(`${dbDir}/courses/modules.json`);
    const lessonRepo = new LessonJsonRepo(`${dbDir}/courses/lessons.json`);
    const stepRepo = new StepJsonRepo(`${dbDir}/courses/steps.json`);

    const courseRepo = new CourseJsonRepo(`${dbDir}/courses/courses.json`);

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

    // ══ Questionnaire: модуль и фасад ══
    const qRepo = new QJsonRepo(
      `${dbDir}/questionnaires/questionnaires.json`,
      db,
    );

    const questionnaireResolver: QuestionnaireApiModuleResolver = {
      questionnaireRepo: qRepo,
      userFacade,
      db,
      appResolver,
      eventBus: appResolver.eventBus,
    };

    const questionnaireModule = new QuestionnaireApiModule(
      questionnaireResolver,
    );

    const questionnaireFacade = new QuestionnaireInProcFacade(
      questionnaireModule,
    );

    const streamModule = new StreamApiModule({
      streamRepo,
      streamStudentRepo,
      userFacade,
      courseFacade,
      appResolver,
      eventBus: appResolver.eventBus,
    });

    const streamFacade = new StreamInProcFacade(streamModule);

    // ══ Peer-review: репозитории кампаний и отзывов (DMG) ══
    const reviewCampaignRepo = new ReviewCampaignJsonRepo(
      `${dbDir}/peer-review/campaigns.json`,
    );
    const reviewRepo = new ReviewJsonRepo(`${dbDir}/peer-review/reviews.json`);

    // ══ DMG: wish, peer-review и внешние модули зависимостей (адаптеры над legacy) ══
    // Шина DMG — поверх общей legacy-шины: события wish и peer-review видят
    // stories, legacy-события stream/questionnaire доходят до ER (D-37).
    const dmg = U7App.dmgApp(
      U7App.dmgContext(env, appResolver.eventBus, logger),
      {
        user: userFacade,
        course: courseFacade,
        questionnaire: questionnaireFacade,
        stream: streamFacade,
      },
      {
        wishes: new WishJsonRepo(`${dbDir}/wish/wishes.json`),
        campaigns: reviewCampaignRepo,
        reviews: reviewRepo,
      },
    );

    // ══ ApiApp: модули (legacy + DMG) ══
    const apiApp = new ApiApp<U7BotAppMeta>([
      userModule,
      streamModule,
      courseModule,
      questionnaireModule,
    ]).withDmg(dmg.api, dmg.modules);

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
    this.questionnaireFacade = questionnaireFacade;
    this.streamModule = streamModule;
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
      inbound: [...streamLegacyInbound, ...questionnaireLegacyInbound],
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
   * Приложение DMG: внешние модули зависимостей (адаптеры над legacy-фасадами,
   * TR-11), `wish` и `peer-review` (кампании), собранные `ApiApp` пакета — фасады по `dependsOn`
   * (D-50). `modules` — их Def для заданий legacy-планировщика
   * (`ApiApp.withDmg`).
   */
  private static dmgApp(
    context: AppContext,
    legacy: U7LegacyFacades,
    repos: {
      readonly wishes: WishRepo;
      readonly campaigns: ReviewCampaignRepo;
      readonly reviews: ReviewRepo;
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
          createCourseModule({ ...deps, legacy: legacy.course }),
      },
      {
        def: QuestionnaireModuleDef,
        create: (deps) =>
          createQuestionnaireModule({ ...deps, legacy: legacy.questionnaire }),
      },
      {
        def: StreamModuleDef,
        create: (deps) =>
          createStreamModule({ ...deps, legacy: legacy.stream }),
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
