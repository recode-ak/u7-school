import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConsoleLogger } from '@u7-scl/core/shared';
import {
  CreateReviewUcDef,
  PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review/contract';
import {
  HandleActionUcDef,
  QuestionnaireModuleDef,
  type QuestionnairePool,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import {
  EnrollStudentUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import {
  ListUsersUcDef,
  RegisterGuestUcDef,
  UserModuleDef,
} from '@u7-scl/domain/user/contract';
import { userSubject } from '@u7-scl/domain/user/testing';
import { type OperationRef, SystemCaller, UserCaller } from 'dmg-core';
import type { OperationRecord } from 'dmg-core/app';
import { TempDir, testTrace } from 'dmg-core/testing';
import { U7App } from '../src/u7-app';
import type { U7AppEnv } from '../src/u7-app.types';

// Сквозная проверка D-86 (F-111, Ф4): персональные данные не попадают в лог
// операций (`<dbDir>/oplog`). Каталог — временный; значения-метки уникальны,
// поэтому поиск подстроки по сырым строкам JSONL однозначен.

const ADMIN = '10000000-0000-4000-8000-000000000001';
const RESPONDENT = '10000000-0000-4000-8000-000000000002';
const SUBJECT = '10000000-0000-4000-8000-000000000003';
const MENTOR = '10000000-0000-4000-8000-000000000004';
const LEARNER = '10000000-0000-4000-8000-000000000005';
const CAMPAIGN = '20000000-0000-4000-8000-000000000001';
const SCOPE = '20000000-0000-4000-8000-000000000002';
const STREAM = '20000000-0000-4000-8000-000000000003';
const SCHOOL = 'a0000000-0000-4000-8000-000000000001';
const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const STEP = '33333333-3333-4333-8333-333333333333';
const COURSE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const T0 = Date.UTC(2026, 5, 1, 10);

/** Метки ПД: каждая встречается во входе или state, в логе её быть не должно. */
const SECRET = {
  name: 'Секретное-Имя-Гостя',
  nick: 'secret_nick_guest',
  telegramId: 987654321,
  reviewText: 'REVIEW-SECRET-текст-отзыва-ментору',
  enrollmentKey: 'KEY-SECRET-42',
  answerCode: 'ANSWER-SECRET-code-77',
  ownerNote: 'OWNER-SECRET-note-55',
};

const pool: QuestionnairePool = {
  inviteText: 'Приглашаем пройти опрос',
  whyText: 'Это улучшит твои метрики',
  questions: [
    {
      question: 'Единственный вопрос',
      questionCode: 'q1',
      type: 'choice',
      multiple: false,
      answers: [{ answer: 'Да', answerCode: SECRET.answerCode }],
    },
  ],
};

const snapshot = [
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

const enrollingStream = {
  uuid: STREAM,
  schoolId: SCHOOL,
  title: 'Поток JS-2',
  description: 'Поток с кодовым словом',
  mentorId: MENTOR,
  moduleId: MODULE,
  startDate: T0,
  status: 'enrollment',
  enrollmentKey: SECRET.enrollmentKey,
  contentSnapshot: snapshot,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
};

/** Окно отзывов открыто «навсегда»: автор — субъект, адресат — ментор. */
const campaign = {
  uuid: CAMPAIGN,
  context: 'stream_fate',
  scopeId: SCOPE,
  subjectId: SUBJECT,
  expiresAt: Date.UTC(2099, 0, 1),
  participants: [],
  payload: { subjectOutcome: 'completed_passed', mentorId: MENTOR },
  createdAt: T0,
  updatedAt: T0,
  version: 0,
};

const env = (dbDir: string): U7AppEnv => ({
  mode: 'test',
  dbDir,
  communityGroup: { id: 1, url: 'https://t.me/test-comm' },
  studentGroup: { id: 2, inviteUrl: 'https://t.me/test-stud' },
});

const FROM_WISH: OperationRef = {
  kind: 'useCase',
  module: 'wish',
  name: 'createCourseWish',
};

/** Сырые строки лога операций приложения (`<dbDir>/oplog/*.jsonl`). */
async function oplogLines(dbDir: string): Promise<string[]> {
  const dir = join(dbDir, 'oplog');
  const files = await readdir(dir).catch(() => [] as string[]);
  const lines = await Promise.all(
    files.map(async (f) => (await readFile(join(dir, f), 'utf8')).split('\n')),
  );
  return lines.flat().filter((l) => l !== '');
}

const parsed = (lines: readonly string[]) =>
  lines.map((l) => JSON.parse(l) as OperationRecord);

describe('U7App: в логе операций нет персональных данных (D-86)', () => {
  let tmp: TempDir;
  let dir: string;
  let lines: string[];

  beforeAll(async () => {
    tmp = TempDir.create('u7-app-oplog-');
    dir = tmp.path;
    await mkdir(join(dir, 'streams'), { recursive: true });
    await mkdir(join(dir, 'peer-review'), { recursive: true });
    await Bun.write(
      join(dir, 'streams', 'streams.json'),
      JSON.stringify([enrollingStream]),
    );
    await Bun.write(join(dir, 'streams', 'students.json'), '[]');
    await Bun.write(
      join(dir, 'peer-review', 'campaigns.json'),
      JSON.stringify([campaign]),
    );
    const app = new U7App(env(dir), { logger: new ConsoleLogger() });
    const admin = new UserCaller(
      userSubject({ uuid: ADMIN, roles: ['ADMIN'] }),
    );

    const registerInput = {
      telegramId: SECRET.telegramId,
      name: SECRET.name,
      nick: SECRET.nick,
    };
    const registered = await app.apiApp.dispatch(
      UserModuleDef,
      RegisterGuestUcDef.command(registerInput),
      admin,
      testTrace(),
    );
    if (!registered.ok) throw new Error('registerGuest не выполнен');
    // Повтор — отказ TELEGRAM_ID_TAKEN с telegramId в payload.
    await app.apiApp.dispatch(
      UserModuleDef,
      RegisterGuestUcDef.command(registerInput),
      admin,
      testTrace(),
    );
    await app.apiApp.dispatch(
      UserModuleDef,
      ListUsersUcDef.command({ name: SECRET.name }),
      admin,
      testTrace(),
    );

    const respondent = new SystemCaller(
      FROM_WISH,
      new UserCaller(userSubject({ uuid: RESPONDENT, roles: ['GUEST'] })),
    );
    const started = await app.apiApp.dispatch(
      QuestionnaireModuleDef,
      StartQuestionnaireUcDef.command({
        pool,
        ownerInfo: { courseId: COURSE, note: SECRET.ownerNote },
      }),
      respondent,
      testTrace(),
    );
    if (!started.ok) throw new Error('startQuestionnaire не выполнен');
    const questionnaireId = parsed(await oplogLines(dir))
      .flatMap((r) => r.writes ?? [])
      .find((w) => w.aggregate.includes('questionnaire'))?.uuid;
    if (questionnaireId === undefined) throw new Error('нет записи анкеты');
    await app.apiApp.dispatch(
      QuestionnaireModuleDef,
      HandleActionUcDef.command({
        questionnaireId,
        type: 'callback',
        value: SECRET.answerCode,
      }),
      new UserCaller(userSubject({ uuid: RESPONDENT, roles: ['GUEST'] })),
      testTrace(),
    );

    await app.apiApp.dispatch(
      PeerReviewModuleDef,
      CreateReviewUcDef.command({
        campaignId: CAMPAIGN,
        recipientId: MENTOR,
        text: SECRET.reviewText,
      }),
      new UserCaller(userSubject({ uuid: SUBJECT, roles: ['SUBSCRIBER'] })),
      testTrace(),
    );

    await app.apiApp.dispatch(
      StreamModuleDef,
      EnrollStudentUcDef.command({
        streamId: STREAM,
        enrollmentKey: SECRET.enrollmentKey,
      }),
      new UserCaller(userSubject({ uuid: LEARNER, roles: ['SUBSCRIBER'] })),
      testTrace(),
    );

    lines = await oplogLines(dir);
  });

  afterAll(() => {
    tmp.dispose();
  });

  test('лог не пуст: записаны все прогнанные операции', () => {
    const ops = parsed(lines).map((r) => `${r.module}.${r.op}`);
    for (const op of [
      'user.registerGuest',
      'user.listUsers',
      'questionnaire.startQuestionnaire',
      'questionnaire.handleAction',
      'peer-review.createReview',
      'stream.enrollStudent',
    ]) {
      expect(ops, op).toContain(op);
    }
  });

  test('отказ registerGuest (TELEGRAM_ID_TAKEN) в логе есть, без telegramId', () => {
    const failed = parsed(lines).find(
      (r) =>
        r.op === 'registerGuest' &&
        !r.result.ok &&
        r.result.error.code === 'USER_TELEGRAM_ID_TAKEN',
    );
    expect(failed).toBeDefined();
  });

  test('операции прогона успешны (кроме повтора регистрации)', () => {
    const failed = parsed(lines).filter(
      (r) => !r.result.ok && r.op !== 'registerGuest',
    );
    expect(failed.map((r) => `${r.module}.${r.op}`)).toEqual([]);
  });

  test.each([
    { what: 'имя гостя', value: SECRET.name },
    { what: 'ник гостя', value: SECRET.nick },
    { what: 'telegramId (числом и строкой)', value: String(SECRET.telegramId) },
    { what: 'текст отзыва', value: SECRET.reviewText },
    { what: 'ключ зачисления', value: SECRET.enrollmentKey },
    { what: 'ownerInfo анкеты', value: SECRET.ownerNote },
  ])('в строках JSONL нет: $what', ({ value }) => {
    for (const line of lines) expect(line).not.toContain(value);
  });

  // `previousQuestion` — контент анкеты, не ПД: выход handleAction возвращает
  // вопрос с вариантами, код ответа лежит и в нём — его исключаем, остальное
  // (вход `value`, `selectedAnswers`, патч `answers`) ответа содержать не должно.
  test('в записи handleAction нет ответа анкеты (previousQuestion — контент анкеты, не ПД)', () => {
    const own = lines.filter((l) => l.includes('"op":"handleAction"'));
    expect(own).toHaveLength(1);
    const record = JSON.parse(own[0] ?? '{}');
    delete record.result.output.previousQuestion;
    expect(JSON.stringify(record)).not.toContain(SECRET.answerCode);
  });
});

describe('U7App: срок хранения лога операций', () => {
  let tmp: TempDir;
  let dir: string;

  beforeAll(() => {
    tmp = TempDir.create('u7-app-oplog-retain-');
    dir = tmp.path;
  });

  afterAll(() => {
    tmp.dispose();
  });

  test('retainDays: 90 — файл старше 90 дней удаляется, свежий остаётся', async () => {
    const dayFile = (ago: number) =>
      `${new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10)}.jsonl`;
    const oplog = join(dir, 'oplog');
    await mkdir(oplog, { recursive: true });
    const stale = dayFile(120);
    const fresh = dayFile(10);
    const row = JSON.stringify({
      at: 1,
      module: 'm',
      op: 'o',
      kind: 'useCase',
    });
    await Bun.write(join(oplog, stale), `${row}\n`);
    await Bun.write(join(oplog, fresh), `${row}\n`);

    const app = new U7App(env(dir), { logger: new ConsoleLogger() });
    await app.apiApp.dispatch(
      UserModuleDef,
      ListUsersUcDef.command({}),
      new UserCaller(userSubject({ uuid: ADMIN, roles: ['ADMIN'] })),
      testTrace(),
    );

    const files = await readdir(oplog);
    expect(files).not.toContain(stale);
    expect(files).toContain(fresh);
  });
});
