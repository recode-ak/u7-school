import { describe, expect, test } from 'bun:test';
import type { Student, StudentRepo } from '@u7-scl/domain/stream';
import { legacyStreamStudents } from './legacy-stream-students';

// Мост к legacy-студентам: порт `StreamStudents` над legacy-репозиторием студентов.
// Сценарии: `factsOf` — факты студентов потока и инвариант
// терминальности; `launch` — перенос логики
// `activate-stream-uc.ts` дословно (enrolled → active, первый шаг тем, у кого
// нет шагов; проверка только `steps.length === 0`, без учёта статуса).

const STREAM = '11111111-1111-4111-8111-111111111111';
const FIRST = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const SECOND = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02';
const at = '2026-06-01T10:00';

const step = (
  stepId: string,
  status: 'issued' | 'completed' = 'completed',
) => ({
  stepId,
  status,
  issuedAt: at,
  ...(status === 'completed' && { completedAt: at }),
});

function student(
  userId: string,
  status: Student['status'],
  steps: Student['steps'] = [],
): Student {
  return {
    uuid: crypto.randomUUID(),
    streamId: STREAM,
    userId,
    status,
    enrolledAt: at,
    currentStepId: SECOND,
    steps,
    createdAt: at,
  };
}

/** Фейк legacy-репозитория студентов: поток → студенты, запись запоминается. */
function fakeRepo(students: Student[]) {
  const saved: Student[] = [];
  const repo = {
    getByStream: async (id: string) =>
      students.filter((s) => s.streamId === id),
    save: async (s: Student) => {
      saved.push(structuredClone(s));
    },
    getByUuid: async () => undefined,
    getByUser: async () => [],
  } as unknown as StudentRepo;
  return { repo, saved };
}

const U = (n: number) =>
  `${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;

describe('legacyStreamStudents.factsOf', () => {
  test('потока без студентов — пустой список', async () => {
    const { repo } = fakeRepo([]);

    expect(await legacyStreamStudents(repo).factsOf(STREAM)).toEqual([]);
  });

  test('статусы сырые; settled — терминальный статус; inProgress — учится или зачислен', async () => {
    const list = [
      student(U(2), 'advanced'),
      student(U(3), 'not_advanced'),
      student(U(4), 'enrolled'),
      student(U(5), 'active'),
      student(U(8), 'abandoned'),
    ];
    const { repo } = fakeRepo(list);

    const facts = await legacyStreamStudents(repo).factsOf(STREAM);

    expect(
      facts.map((f) => [f.userId, f.status, f.settled, f.inProgress]),
    ).toEqual([
      [U(2), 'advanced', true, false],
      [U(3), 'not_advanced', true, false],
      [U(4), 'enrolled', false, true],
      [U(5), 'active', false, true],
      [U(8), 'abandoned', true, false],
    ]);
  });

  test('studentId — uuid записи студента', async () => {
    const one = student(U(2), 'active');
    const { repo } = fakeRepo([one]);

    const [fact] = await legacyStreamStudents(repo).factsOf(STREAM);

    expect(fact?.studentId).toBe(one.uuid);
  });

  test('neverStarted: ушёл, не пройдя ни одного шага — да; со шагом — нет', async () => {
    const { repo } = fakeRepo([
      student(U(8), 'abandoned'),
      student(U(9), 'abandoned', [step(FIRST)]),
      student(U(5), 'active'),
    ]);

    const facts = await legacyStreamStudents(repo).factsOf(STREAM);

    expect(facts.map((f) => f.neverStarted)).toEqual([true, false, false]);
  });

  test('студенты другого потока не попадают', async () => {
    const foreign = { ...student(U(2), 'active'), streamId: U(7) };
    const { repo } = fakeRepo([foreign]);

    expect(await legacyStreamStudents(repo).factsOf(STREAM)).toEqual([]);
  });
});

describe('legacyStreamStudents.launch', () => {
  test('enrolled студент: active и первый шаг выдан', async () => {
    const { repo, saved } = fakeRepo([student(U(2), 'enrolled')]);

    await legacyStreamStudents(repo).launch(STREAM, FIRST);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.status).toBe('active');
    expect(saved[0]?.steps.map((s) => [s.stepId, s.status])).toEqual([
      [FIRST, 'issued'],
    ]);
  });

  test('оба enrolled студента сохранены (два save)', async () => {
    const { repo, saved } = fakeRepo([
      student(U(2), 'enrolled'),
      student(U(3), 'enrolled'),
    ]);

    await legacyStreamStudents(repo).launch(STREAM, FIRST);

    expect(saved.map((s) => s.status)).toEqual(['active', 'active']);
  });

  test('active студент со шагами не трогается — save не вызван', async () => {
    const { repo, saved } = fakeRepo([student(U(2), 'active', [step(FIRST)])]);

    await legacyStreamStudents(repo).launch(STREAM, FIRST);

    expect(saved).toEqual([]);
  });

  test('только enrolled активируется: из двух сохранён один', async () => {
    const { repo, saved } = fakeRepo([
      student(U(2), 'enrolled'),
      student(U(3), 'active', [step(FIRST)]),
    ]);

    await legacyStreamStudents(repo).launch(STREAM, FIRST);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.userId).toBe(U(2));
    expect(saved[0]?.status).toBe('active');
  });

  test('шаг выдаётся при steps.length === 0 без учёта статуса (active без шагов)', async () => {
    const { repo, saved } = fakeRepo([student(U(2), 'active')]);

    await legacyStreamStudents(repo).launch(STREAM, FIRST);

    expect(saved).toHaveLength(1);
    expect(saved[0]?.steps.map((s) => s.stepId)).toEqual([FIRST]);
  });

  test('студенты другого потока не затрагиваются', async () => {
    const foreign = { ...student(U(2), 'enrolled'), streamId: U(7) };
    const { repo, saved } = fakeRepo([foreign]);

    await legacyStreamStudents(repo).launch(STREAM, FIRST);

    expect(saved).toEqual([]);
  });
});
