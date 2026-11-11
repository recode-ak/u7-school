import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Role, type User } from '@u7-scl/app-legacy';
import { InProcJobScheduler } from '@u7-scl/core/infra';
import { ConsoleLogger } from '@u7-scl/core/shared';
import type { ContentSnapshot } from '@u7-scl/domain/course/contract';
import {
  CourseModuleDef,
  ListModulesUcDef,
} from '@u7-scl/domain/course/contract';
import {
  GetMyCampaignsUcDef,
  ListScopeFactsUcDef,
  PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review/contract';
import {
  AbandonUcDef,
  GetQuestionnairesByUserUcDef,
  HandleActionUcDef,
  QuestionnaireModuleDef,
  type QuestionnairePool,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import {
  ActivateStreamUcDef,
  CompleteStudentUcDef,
  CreateStreamUcDef,
  EnrollStudentUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import {
  CancelWishUcDef,
  CreateCourseWishUcDef,
  ListUserWishesUcDef,
  WishModuleDef,
} from '@u7-scl/domain/wish/contract';
import { type OperationRef, SystemCaller, UserCaller } from 'dmg-core';
import {
  type OperationRecord,
  type ReplayClaim,
  type ReplayStore,
  Trace,
} from 'dmg-core/app';
import { U7App } from '../src/u7-app';
import type { U7AppEnv } from '../src/u7-app.types';

/** Актор для UC с requiresAuth: checkAuth проверяет только наличие. */
const ACTOR: User = {
  uuid: '22222222-2222-4222-8222-222222222222',
  name: 'Тестовый актор',
  telegramId: 1,
  roles: [Role.STUDENT],
  createdAt: '2026-06-01T00:00',
};

/** Минимальное окружение для сборки приложения (как прежний тестовый `BotConfig`). */
function makeEnv(dbDir: string): U7AppEnv {
  return {
    mode: 'test',
    dbDir,
    communityGroup: { id: 1, url: 'https://t.me/test-comm' },
    studentGroup: { id: 2, inviteUrl: 'https://t.me/test-stud' },
  };
}

describe('U7App (smoke: сборка с модулем peer-review)', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'u7-app-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('приложение собирается: peer-review — только Def-модуль DMG, legacy-модуля нет', () => {
    const bundle = new U7App(makeEnv(dir), { logger: new ConsoleLogger() });

    expect(bundle.apiApp.getModule('peer-review')).toBeUndefined();
    expect(bundle.school.communityGroup.url).toBe('https://t.me/test-comm');
    expect(bundle.appResolver.mode).toBe('test');
    expect(bundle.appResolver.school.studentGroup.inviteUrl).toBe(
      'https://t.me/test-stud',
    );
  });

  test('init(): подписка ER проходит, query-UC модуля (DMG) отвечает', async () => {
    const bundle = new U7App(makeEnv(dir), { logger: new ConsoleLogger() });
    bundle.apiApp.init(new InProcJobScheduler({ logger: new ConsoleLogger() }));

    // Кампании — модуль DMG: UC доступен через единый вход приложения
    const res = await bundle.apiApp.dispatch(
      PeerReviewModuleDef,
      GetMyCampaignsUcDef.command({ onlyLives: true }),
      new UserCaller(ACTOR),
      Trace.fromRequest({ requestId: crypto.randomUUID() }),
    );
    expect(res).toEqual({ ok: true, value: [] });
  });

  test('UC рецензий — в модуле DMG', async () => {
    const bundle = new U7App(makeEnv(dir), { logger: new ConsoleLogger() });

    const res = await bundle.apiApp.dispatch(
      PeerReviewModuleDef,
      ListScopeFactsUcDef.command({ scopeId: crypto.randomUUID() }),
      new UserCaller(ACTOR),
      Trace.fromRequest({ requestId: crypto.randomUUID() }),
    );
    expect(res).toEqual({
      ok: true,
      value: { hasReviews: false, reviewsCount: 0 },
    });
  });
});

// ══ Корень сборки (D-50): поля для UI раннера, wish через ApiApp, фасады по dependsOn ══

describe('U7App: сборка', () => {
  let dir: string;
  let app: U7App;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'u7-app-assembly-'));
    app = new U7App(makeEnv(dir), { logger: new ConsoleLogger() });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('отдаёт поля бандла для UI раннера и резолвер callers', () => {
    expect(app.apiApp).toBeDefined();
    expect(app.eventBus).toBe(app.appResolver.eventBus);
    expect(app.userFacade).toBeDefined();
    expect(app.userRepo).toBeDefined();
    expect(app.apiApp.getModule('questionnaire')).toBeUndefined();
    expect(app.apiApp.getModule('stream')).toBeUndefined();
    expect(app.apiApp.getModule('course')).toBeUndefined();
    expect(app.school).toBe(app.appResolver.school);
    expect(app.callers).toBeDefined();
  });

  test('UC курса — в модуле DMG', async () => {
    const res = await app.apiApp.dispatch(
      CourseModuleDef,
      ListModulesUcDef.command({}),
      new UserCaller(ACTOR),
      Trace.fromRequest({ requestId: crypto.randomUUID() }),
    );

    expect(res).toEqual({ ok: true, value: [] });
  });

  test('UC wish исполняется через apiApp.dispatch', async () => {
    const res = await app.apiApp.dispatch(
      WishModuleDef,
      ListUserWishesUcDef.command({}),
      new UserCaller(ACTOR),
      Trace.fromRequest({ requestId: crypto.randomUUID() }),
    );

    expect(res).toEqual({ ok: true, value: [] });
  });

  test('wish вызывает course через фасад по dependsOn: неизвестный курс — отказ', async () => {
    const res = await app.apiApp.dispatch(
      WishModuleDef,
      CreateCourseWishUcDef.command({ courseId: COURSE }),
      new UserCaller(ACTOR),
      Trace.fromRequest({ requestId: crypto.randomUUID() }),
    );

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('WISH_COURSE_NOT_FOUND');
  });
});

// ══ Отсев повторов команд DMG: хранилище даёт раннер (D-56, Ф4 трека dmg-cleanup) ══

describe('U7App: хранилище отсева повторов команд', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'u7-app-replay-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('команда с requestId клиента идёт через переданное хранилище', async () => {
    const claimed: string[] = [];
    const replay: ReplayStore = {
      claim: async (key): Promise<ReplayClaim> => {
        claimed.push(key);
        return { kind: 'claimed', token: 't' };
      },
      complete: async () => {},
      release: async () => {},
    };
    const bundle = new U7App(
      { ...makeEnv(dir), replay },
      { logger: new ConsoleLogger() },
    );

    await bundle.apiApp.dispatch(
      WishModuleDef,
      CancelWishUcDef.command({ kind: 'course', courseId: COURSE }),
      new UserCaller(ACTOR),
      Trace.fromRequest({
        requestId: 'tg:1#1',
        channel: { name: 'telegram', visitorId: '1' },
      }),
    );

    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toContain('tg:1#1');
  });
});

// ══ Сосуществование (Ф12): legacy-события → ER DMG-модуля wish ══

const RESPONDENT = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const QUITTER = '6f4e2d3c-8b7a-4f9e-8a1b-b2c3d4e5f6a7';
const COURSE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STREAM = '7a5f3e4d-9c8b-4a0f-9b2c-c3d4e5f6a7b8';
const MODULE = '770e8400-e29b-41d4-a716-446655440003';
const STEP = '33333333-3333-4333-8333-333333333333';

const pool: QuestionnairePool = {
  inviteText: 'Приглашаем пройти опрос',
  whyText: 'Это улучшит твои метрики',
  questions: [
    {
      question: 'Единственный вопрос',
      questionCode: 'q1',
      type: 'choice',
      multiple: false,
      answers: [{ answer: 'Да', answerCode: 'yes' }],
    },
  ],
};

const snapshot: ContentSnapshot = [
  {
    projectId: '11111111-1111-4111-8111-111111111111',
    projectTitle: 'Введение',
    lessons: [
      {
        lessonId: '22222222-2222-4222-8222-222222222222',
        lessonTitle: 'Урок 1',
        stepIds: [STEP],
      },
    ],
  },
];

/** Опубликованный модуль и урок в legacy-формате — снимок для `createStream`. */
const legacyModule = {
  uuid: MODULE,
  title: 'Основы JS',
  description: 'Синтаксис языка',
  authorId: RESPONDENT,
  status: 'published',
  projects: [
    {
      uuid: snapshot[0]?.projectId,
      title: 'Введение',
      status: 'published',
      lessonIds: [snapshot[0]?.lessons[0]?.lessonId],
    },
  ],
  createdAt: '2026-06-01T10:00',
};
const legacyLesson = {
  uuid: snapshot[0]?.lessons[0]?.lessonId,
  moduleId: MODULE,
  title: 'Урок 1',
  status: 'published',
  createdAt: '2026-06-01T10:00',
  stepIds: [STEP],
  mentorStepIds: [],
};

/** Желание в анкетной ветке (pending) — legacy-запись wishes.json. */
const pendingWish = (uuid: string, userId: string) => ({
  uuid,
  userId,
  target: { kind: 'course', courseId: COURSE },
  status: 'pending',
  createdAt: '2026-03-01T10:00',
});

/** Вызов владельца анкеты (`system`) — как `createCourseWish` в модуле `wish`. */
const FROM_WISH: OperationRef = {
  kind: 'useCase',
  module: 'wish',
  name: 'createCourseWish',
};

/** Запускает анкету курса за респондента модулем Def; возвращает её uuid. */
async function startQuestionnaire(
  bundle: U7App,
  respondentId: string,
): Promise<string> {
  const started = await bundle.apiApp.dispatch(
    QuestionnaireModuleDef,
    StartQuestionnaireUcDef.command({ pool, ownerInfo: { courseId: COURSE } }),
    new SystemCaller(
      FROM_WISH,
      new UserCaller({ ...ACTOR, uuid: respondentId }),
    ),
    trace(),
  );
  if (!started.ok) throw new Error('startQuestionnaire не выполнен');

  const list = await bundle.apiApp.dispatch(
    QuestionnaireModuleDef,
    GetQuestionnairesByUserUcDef.command({ userId: respondentId }),
    new UserCaller({ ...ACTOR, uuid: respondentId }),
    trace(),
  );
  if (!list.ok) throw new Error('getQuestionnairesByUser не выполнен');
  const [own] = list.value;
  if (own === undefined) throw new Error('анкета респондента не найдена');
  return own.uuid;
}

/** Курс из legacy-файлов — источник снимка для `createStream`. */
async function seedCourse(dbDir: string): Promise<void> {
  await mkdir(join(dbDir, 'courses'), { recursive: true });
  await Bun.write(
    join(dbDir, 'courses', 'modules.json'),
    JSON.stringify([legacyModule]),
  );
  await Bun.write(
    join(dbDir, 'courses', 'lessons.json'),
    JSON.stringify([legacyLesson]),
  );
}

const trace = () => Trace.fromRequest({ requestId: crypto.randomUUID() });
const MENTOR = new UserCaller({ ...ACTOR, roles: [Role.MENTOR] });

/** Поток создаёт ментор (Def UC `createStream`); возвращает его uuid. */
async function createStream(bundle: U7App): Promise<string> {
  const created = await bundle.apiApp.dispatch(
    StreamModuleDef,
    CreateStreamUcDef.command({
      title: 'Поток JS-1',
      description: 'Основной поток курса JavaScript',
      moduleId: MODULE,
      startDate: Date.UTC(2026, 5, 1, 12),
    }),
    MENTOR,
    trace(),
  );
  if (!created.ok) throw new Error('createStream не выполнен');
  return created.value.streamId;
}

/** Зачисление студента (Def UC `enrollStudent`): событие публикует UoW `stream`. */
async function enroll(
  bundle: U7App,
  streamId: string,
  userId: string,
): Promise<string> {
  const res = await bundle.apiApp.dispatch(
    StreamModuleDef,
    EnrollStudentUcDef.command({ streamId }),
    new UserCaller({ ...ACTOR, uuid: userId }),
    trace(),
  );
  if (!res.ok) throw new Error('enrollStudent не выполнен');
  return res.value.studentId;
}

/** Записи лога операций приложения (`<dbDir>/oplog/*.jsonl`). */
async function oplogRecords(dbDir: string): Promise<OperationRecord[]> {
  const dir = join(dbDir, 'oplog');
  const files = await readdir(dir).catch(() => [] as string[]);
  const lines = await Promise.all(
    files.map(async (f) => (await readFile(join(dir, f), 'utf8')).split('\n')),
  );
  return lines
    .flat()
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as OperationRecord);
}

/** Ждёт, пока в логе операций появятся реакции wish с именами `names`. */
async function waitReactions(
  dbDir: string,
  names: readonly string[],
): Promise<string[]> {
  const deadline = Date.now() + 3000;
  let seen: string[] = [];
  while (Date.now() < deadline) {
    seen = (await oplogRecords(dbDir))
      .filter((r) => r.module === 'wish' && r.kind === 'eventReaction')
      .map((r) => r.op);
    if (names.every((n) => seen.includes(n))) break;
    await new Promise((r) => setTimeout(r, 20));
  }
  return seen.sort();
}

describe('U7App: события студента доходят до ER DMG-модуля wish', () => {
  let dir: string;
  let bundle: U7App;
  const CONFIRMED = '44444444-4444-4444-8444-444444444444';
  const ABANDONED = '55555555-5555-4555-8555-555555555555';

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'u7-app-dmg-'));
    await mkdir(join(dir, 'wish'), { recursive: true });
    await Bun.write(
      join(dir, 'wish', 'wishes.json'),
      JSON.stringify([
        pendingWish(CONFIRMED, RESPONDENT),
        pendingWish(ABANDONED, QUITTER),
      ]),
    );
    await seedCourse(dir);
    bundle = new U7App(makeEnv(dir), { logger: new ConsoleLogger() });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('enrollStudent, createStream, startQuestionnaire, handleAction/abandon → fulfillWish, inviteWishers, confirmWish, abandonWish', async () => {
    const streamId = await createStream(bundle);
    await enroll(bundle, streamId, RESPONDENT);

    const completed = await startQuestionnaire(bundle, RESPONDENT);
    const answered = await bundle.apiApp.dispatch(
      QuestionnaireModuleDef,
      HandleActionUcDef.command({
        questionnaireId: completed,
        type: 'callback',
        value: 'yes',
      }),
      new UserCaller({ ...ACTOR, uuid: RESPONDENT }),
      trace(),
    );
    expect(answered.ok).toBe(true);

    const abandoned = await startQuestionnaire(bundle, QUITTER);
    const interrupted = await bundle.apiApp.dispatch(
      QuestionnaireModuleDef,
      AbandonUcDef.command({ questionnaireId: abandoned }),
      new UserCaller({ ...ACTOR, uuid: QUITTER }),
      trace(),
    );
    expect(interrupted.ok).toBe(true);

    const names = [
      'abandonWish',
      'confirmWish',
      'fulfillWish',
      'inviteWishers',
    ];
    expect(await waitReactions(dir, names)).toEqual(names);

    const rows = JSON.parse(
      await readFile(join(dir, 'wish', 'wishes.json'), 'utf8'),
    ) as Array<{ uuid: string; status: string }>;
    expect(rows.map((r) => [r.uuid, r.status]).sort()).toEqual([
      [CONFIRMED, 'confirmed'],
      [ABANDONED, 'abandoned'],
    ]);
  });
});

// ══ Сосуществование (Ф1 peer-review): legacy-событие stream → ER кампаний DMG ══

describe('U7App: событие completeStudent доходит до ER createStudentCampaign', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'u7-app-peer-review-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('реакция исполняется (в логе операций); кампания по потоку создана', async () => {
    const bundle = new U7App(makeEnv(dir), { logger: new ConsoleLogger() });
    await seedCourse(dir);
    const streamId = await createStream(bundle);
    const studentId = await enroll(
      bundle,
      streamId,
      '77777777-7777-4777-8777-777777777777',
    );
    const activated = await bundle.apiApp.dispatch(
      StreamModuleDef,
      ActivateStreamUcDef.command({ streamId }),
      MENTOR,
      trace(),
    );
    expect(activated.ok).toBe(true);
    const completed = await bundle.apiApp.dispatch(
      StreamModuleDef,
      CompleteStudentUcDef.command({
        streamId,
        studentId,
        outcome: 'advanced',
      }),
      new UserCaller({ ...ACTOR, roles: [Role.ADMIN] }),
      trace(),
    );
    expect(completed.ok).toBe(true);

    const deadline = Date.now() + 3000;
    let ran: OperationRecord[] = [];
    while (Date.now() < deadline && ran.length === 0) {
      ran = (await oplogRecords(dir)).filter(
        (r) => r.module === 'peer-review' && r.op === 'createStudentCampaign',
      );
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(ran).toHaveLength(1);
    expect(
      await Bun.file(join(dir, 'peer-review', 'campaigns.json')).exists(),
    ).toBe(true);
  });
});
