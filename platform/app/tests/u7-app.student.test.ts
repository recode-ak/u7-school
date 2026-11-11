import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Role, type User } from '@u7-scl/app-legacy';
import { ConsoleLogger } from '@u7-scl/core/shared';
import {
  CompleteStudentUcDef,
  DropStudentUcDef,
  EnrollStudentUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { UserCaller } from 'dmg-core';
import { type OperationRecord, Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import { U7App } from '../src/u7-app';
import type { U7AppEnv } from '../src/u7-app.types';

// Замена legacy-публикаций `student.enrolled/completed/abandoned` в
// `u7-app.test.ts:356-440`: события публикует UoW модуля `stream` при настоящем
// UC (`dispatch`), и они доходят до ER `wish` (fulfillWish) и `peer-review`
// (createStudentCampaign). Каталог — mkdtemp, сид — новый формат файлов.

const STREAM = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const SCHOOL = 'a0000000-0000-4000-8000-000000000001';
const MENTOR = '66666666-6666-4666-8666-666666666666';
const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const STEP = '33333333-3333-4333-8333-333333333333';
const RESPONDENT = '11111111-1111-4111-8111-111111111111';
const LEARNER = '77777777-7777-4777-8777-777777777777';
const LEARNER_ROW = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const LEAVER = '88888888-8888-4888-8888-888888888888';
const LEAVER_ROW = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const T0 = Date.UTC(2026, 5, 1, 10);

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

const stream = {
  uuid: STREAM,
  schoolId: SCHOOL,
  title: 'Поток JS-1',
  description: 'Основной поток курса JavaScript',
  mentorId: MENTOR,
  moduleId: MODULE,
  startDate: T0,
  status: 'active',
  contentSnapshot: snapshot,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
};

const studentRow = (uuid: string, userId: string) => ({
  uuid,
  streamId: STREAM,
  userId,
  enrolledAt: T0,
  status: 'active',
  currentStepId: STEP,
  steps: [{ stepId: STEP, status: 'issued', issuedAt: T0 }],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
});

const env = (dbDir: string): U7AppEnv => ({
  mode: 'test',
  dbDir,
  communityGroup: { id: 1, url: 'https://t.me/test-comm' },
  studentGroup: { id: 2, inviteUrl: 'https://t.me/test-stud' },
});

const user = (uuid: string, roles: Role[]): User => ({
  uuid,
  name: 'Тест',
  telegramId: 1,
  roles,
  createdAt: '2026-06-01T00:00',
});
const trace = () => Trace.fromRequest({ requestId: crypto.randomUUID() });

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

/** Ждёт записи реакции `module/op` в логе операций. */
async function waitReaction(dbDir: string, module: string, op: string) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const found = (await oplogRecords(dbDir)).filter(
      (r) => r.module === module && r.op === op && r.kind === 'eventReaction',
    );
    if (found.length > 0) return found;
    await new Promise((r) => setTimeout(r, 20));
  }
  return [];
}

describe('U7App: события студента от UoW модуля stream доходят до ER', () => {
  let dir: string;
  let app: U7App;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'u7-app-student-'));
    await mkdir(join(dir, 'streams'), { recursive: true });
    await Bun.write(
      join(dir, 'streams', 'streams.json'),
      JSON.stringify([stream]),
    );
    await Bun.write(
      join(dir, 'streams', 'students.json'),
      JSON.stringify([
        studentRow(LEARNER_ROW, LEARNER),
        studentRow(LEAVER_ROW, LEAVER),
      ]),
    );
    app = new U7App(env(dir), { logger: new ConsoleLogger() });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  test('enrollStudent → stream.student.enrolled → ER fulfillWish (wish)', async () => {
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        EnrollStudentUcDef.command({ streamId: STREAM }),
        new UserCaller(user(RESPONDENT, [Role.SUBSCRIBER])),
        trace(),
      ),
    );

    expect(await waitReaction(dir, 'wish', 'fulfillWish')).not.toHaveLength(0);
    const rows = JSON.parse(
      await readFile(join(dir, 'streams', 'students.json'), 'utf8'),
    ) as Array<{ userId: string; status: string }>;
    expect(rows.find((r) => r.userId === RESPONDENT)?.status).toBe('enrolled');
  });

  test('completeStudent → stream.student.completed → ER createStudentCampaign (peer-review)', async () => {
    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        CompleteStudentUcDef.command({
          streamId: STREAM,
          studentId: LEARNER_ROW,
          outcome: 'advanced',
        }),
        new UserCaller(user(MENTOR, [Role.MENTOR])),
        trace(),
      ),
    );

    expect(
      await waitReaction(dir, 'peer-review', 'createStudentCampaign'),
    ).not.toHaveLength(0);
  });

  test('dropStudent → stream.student.abandoned → ER createStudentCampaign (peer-review)', async () => {
    const before = (await oplogRecords(dir)).filter(
      (r) => r.module === 'peer-review' && r.op === 'createStudentCampaign',
    ).length;

    expectOk(
      await app.apiApp.dispatch(
        StreamModuleDef,
        DropStudentUcDef.command({ streamId: STREAM, studentId: LEAVER_ROW }),
        new UserCaller(user(LEAVER, [Role.GUEST])),
        trace(),
      ),
    );

    const deadline = Date.now() + 3000;
    let after = before;
    while (Date.now() < deadline && after <= before) {
      after = (await oplogRecords(dir)).filter(
        (r) => r.module === 'peer-review' && r.op === 'createStudentCampaign',
      ).length;
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(after).toBeGreaterThan(before);
  });
});
