import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Role, type User } from '@u7-scl/app';
import { InProcJobScheduler } from '@u7-scl/core/infra';
import { ConsoleLogger } from '@u7-scl/core/shared';
import type { ContentSnapshot } from '@u7-scl/domain/course';
import {
  QuestionnaireFactory,
  type QuestionnairePool,
} from '@u7-scl/domain/questionnaire';
import { StreamAr, StudentAr } from '@u7-scl/domain/stream';
import type { OperationRecord } from 'dmg-core/app';
import * as v from 'valibot';
import { type BotConfig, BotConfigSchema } from './config';
import { createApiApp } from './create-api-app';

/** Актор для UC с requiresAuth: checkAuth проверяет только наличие. */
const ACTOR: User = {
  uuid: '22222222-2222-4222-8222-222222222222',
  name: 'Тестовый актор',
  telegramId: 1,
  roles: [Role.STUDENT],
  createdAt: '2026-06-01T00:00',
};

/** Минимальный конфиг для сборки приложения (токены бота не используются). */
function makeConfig(dbDir: string): BotConfig {
  return v.parse(BotConfigSchema, {
    botToken: 'test-token',
    communityGroupUrl: 'https://t.me/test-comm',
    communityGroupId: 1,
    studentGroupInvite: 'https://t.me/test-stud',
    studentGroupId: 2,
    mode: 'test',
    botAdminUuid: '99999999-9999-4999-8999-999999999999',
    dbDir,
  });
}

describe('create-api-app (smoke: сборка с модулем peer-review)', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'u7-api-app-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('приложение собирается: модуль peer-review зарегистрирован', () => {
    const bundle = createApiApp(makeConfig(dir), new ConsoleLogger());

    const module = bundle.apiApp.getModule('peer-review');
    expect(module).toBeDefined();
    expect(bundle.school.communityGroup.url).toBe('https://t.me/test-comm');
    expect(bundle.appResolver.mode).toBe('test');
    expect(bundle.appResolver.school.studentGroup.inviteUrl).toBe(
      'https://t.me/test-stud',
    );
  });

  test('init(): подписка ER проходит, query-UC модуля отвечает', async () => {
    const bundle = createApiApp(makeConfig(dir), new ConsoleLogger());
    bundle.apiApp.init(new InProcJobScheduler({ logger: new ConsoleLogger() }));

    // Модуль init() подписал ER create-student-campaign на события судьбы
    // студента; пользовательский UC доступен через единый вход приложения
    const campaigns = await bundle.apiApp.execute(
      'get-my-campaigns',
      { userId: '11111111-1111-4111-8111-111111111111', onlyLives: true },
      ACTOR,
    );
    expect(campaigns).toEqual([]);
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

/** Желание в анкетной ветке (pending) — legacy-запись wishes.json. */
const pendingWish = (uuid: string, userId: string) => ({
  uuid,
  userId,
  target: { kind: 'course', courseId: COURSE },
  status: 'pending',
  createdAt: '2026-03-01T10:00',
});

/** Анкета по курсу: владелец — желание курса (как у create-course-wish). */
function questionnaireOf(respondentId: string) {
  const ar = QuestionnaireFactory.createStandard(respondentId, pool, {
    courseId: COURSE,
  });
  ar.start();
  return ar;
}

/** Первое событие агрегата (legacy-форма — как публикуют legacy-UC). */
function single<E>(events: readonly E[]): E {
  const [event] = events;
  if (event === undefined) throw new Error('агрегат не создал событие');
  return event;
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

describe('create-api-app: legacy-события доходят до ER DMG-модуля wish', () => {
  let dir: string;
  let bundle: ReturnType<typeof createApiApp>;
  const CONFIRMED = '44444444-4444-4444-8444-444444444444';
  const ABANDONED = '55555555-5555-4555-8555-555555555555';

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'u7-api-app-dmg-'));
    await mkdir(join(dir, 'wish'), { recursive: true });
    await Bun.write(
      join(dir, 'wish', 'wishes.json'),
      JSON.stringify([
        pendingWish(CONFIRMED, RESPONDENT),
        pendingWish(ABANDONED, QUITTER),
      ]),
    );
    bundle = createApiApp(makeConfig(dir), new ConsoleLogger());
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('student.enrolled, stream.created, questionnaire:complete|abandon → fulfillWish, inviteWishers, confirmWish, abandonWish', async () => {
    const bus = bundle.eventBus;
    bus.publish(
      single(StudentAr.enroll(STREAM, RESPONDENT, STEP, MODULE).flushEvents()),
    );
    bus.publish(
      single(
        StreamAr.create(
          {
            title: 'Поток JS-1',
            description: 'Основной поток курса JavaScript',
            mentorId: RESPONDENT,
            moduleId: MODULE,
            startDate: '2026-06-01T12:00',
          },
          snapshot,
        ).flushEvents(),
      ),
    );
    const completed = questionnaireOf(RESPONDENT);
    completed.handleAction({ type: 'callback', value: 'yes' });
    bus.publish(single(completed.flushEvents()));
    const abandoned = questionnaireOf(QUITTER);
    abandoned.abandon('timeout');
    bus.publish(single(abandoned.flushEvents()));

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
