import type { School, U7AppResolver } from '@u7-scl/app-legacy/domain';
import { createSchool, TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import { ApiApp as LegacyApiApp } from '@u7-scl/core/api';
import type { EventBus as LegacyEventBus } from '@u7-scl/core/domain';
import {
  InProcEventBus,
  InProcJobScheduler,
  JobRunJsonRepo,
} from '@u7-scl/core/infra';
import { legacyClock, legacyEventBus } from '@u7-scl/core/legacy-bridge';
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
  type AppContext,
  ApiApp as DmgApiApp,
  type EventBus,
  InProcInbox,
  InProcOutbox,
  InProcReplayStore,
  JsonlOperationLog,
  type ModuleFactory,
} from 'dmg-core/app';
import type { U7AppEnv, U7AppPorts } from './u7-app.types';
import type { U7BotAppMeta } from './u7-app-meta';
import { U7CallerResolver } from './u7-caller-resolver';

/**
 * Приложение u7-school — корень сборки (D-50): по окружению
 * строит репозитории `<dbDir>/…`, приложение DMG (все модули по `dependsOn`
 * на своих репозиториях), шину DMG, а рядом — legacy-оболочку `ApiApp`
 * с планировщиком заданий (strangler до Ф4). Наружу отдаёт приложение DMG
 * (`apiApp`), шину DMG (`eventBus`), школу и резолвер `callers`.
 * Контроллеры и транспорт строит раннер.
 */
export class U7App {
  /** Приложение DMG — единственный вход в модули (D-49). */
  readonly apiApp: DmgApiApp<Identified>;
  /** Шина DMG: подписка по Def, публикация конвертов. */
  readonly eventBus: EventBus;
  readonly school: School;
  readonly appResolver: U7AppResolver;
  readonly callers: U7CallerResolver;

  /** Legacy-оболочка `ApiApp` — нужна только планировщику заданий, до Ф4. */
  readonly #legacyApiApp: LegacyApiApp<U7BotAppMeta>;

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
    const legacyBus = new InProcEventBus();
    const appResolver: U7AppResolver = {
      logger,
      mode: env.mode,
      eventBus: legacyBus,
      school,
    };

    // ══ Peer-review: репозитории кампаний и отзывов (DMG) ══
    const reviewCampaignRepo = new ReviewCampaignJsonRepo(
      `${dbDir}/peer-review/campaigns.json`,
    );
    const reviewRepo = new ReviewJsonRepo(`${dbDir}/peer-review/reviews.json`);

    // ══ DMG: модули по `dependsOn` — каждый на своих репозиториях ══
    // Шина DMG — поверх общей legacy-шины: события wish и peer-review видят
    // stories, события stream доходят до ER (D-37).
    const context = U7App.dmgContext(env, legacyBus, logger);
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

    // ══ Legacy-оболочка: только планировщик заданий (legacy-модулей не осталось) ══
    const legacyApiApp = new LegacyApiApp<U7BotAppMeta>([]).withDmg(
      dmg.api,
      dmg.modules,
    );

    // Планировщик — техническая зависимость: передаётся через init(),
    // lastRunAt персистится — задания переживают перезагрузку (misfire-политика).
    legacyApiApp.init(
      new InProcJobScheduler({
        logger,
        store: new JobRunJsonRepo(`${dbDir}/jobs/last-runs.json`),
      }),
    );

    this.apiApp = dmg.api;
    this.eventBus = context.bus;
    this.school = school;
    this.appResolver = appResolver;
    this.callers = new U7CallerResolver(dmg.api);
    this.#legacyApiApp = legacyApiApp;
  }

  /** Запускает периодические задания (Job) legacy `ApiApp`. */
  start(): void {
    this.#legacyApiApp.start();
  }

  /** Останавливает периодические задания. */
  stop(): void {
    this.#legacyApiApp.stop();
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
    legacyBus: LegacyEventBus,
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
   * Приложение DMG: все модули по `dependsOn` — `user`, `course`, `wish`,
   * `peer-review` (кампании), `questionnaire`, `stream`, `dossier` — на своих
   * репозиториях, собранные `ApiApp` пакета (D-50). `modules` — их Def для
   * заданий legacy-планировщика (`ApiApp.withDmg`).
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
      api: new DmgApiApp<Identified>(context, factories),
      modules: factories.map((f) => f.def),
    };
  }
}
