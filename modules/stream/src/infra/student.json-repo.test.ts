import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { StudentAr, type StudentState } from '@u7-scl/domain/stream';
import { VersionConflict } from 'dmg-core/app';
import { expectOk, TempDir } from 'dmg-core/testing';
import { ValiError } from 'valibot';
import { StudentJsonRepo } from './student.json-repo';

// Репозиторий студентов (`<dbDir>/streams/students.json`). Перенос
// `infra/db/student-json-repo.test.ts` (выборка по статусам → `findStudying`) +
// контракт новой записи: legacy-запись (ISO → число, version 0,
// updatedAt = createdAt), round-trip, устаревшая версия, битая запись —
// исключение, файл цел. Каталог — временный, живые данные не читаются.

let tmpDir: TempDir;
beforeAll(() => {
  tmpDir = TempDir.create('student-json-repo-test-');
});
afterAll(() => tmpDir.dispose());

const STREAM = '77777777-7777-4777-8777-777777777777';
const OTHER_STREAM = '88888888-8888-4888-8888-888888888888';
const USER = '11111111-1111-4111-8111-111111111111';
const OTHER_USER = '22222222-2222-4222-8222-222222222222';
const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const STEP = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01';
const T0 = Date.UTC(2026, 5, 1, 10);
const filePath = (name: string) => tmpDir.file(name);

const makeState = (extra: Partial<StudentState> = {}): StudentState => ({
  uuid: crypto.randomUUID(),
  streamId: STREAM,
  userId: USER,
  enrolledAt: T0,
  status: 'enrolled',
  currentStepId: STEP,
  steps: [],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

const makeStudent = (extra: { userId?: string; streamId?: string } = {}) =>
  expectOk(
    StudentAr.enroll(
      {
        uuid: crypto.randomUUID(),
        streamId: extra.streamId ?? STREAM,
        userId: extra.userId ?? USER,
        moduleId: MODULE,
        firstStepId: STEP,
      },
      T0,
    ),
  );

async function repoWith(name: string, rows: unknown[]) {
  const path = filePath(name);
  await Bun.write(path, JSON.stringify(rows));
  return new StudentJsonRepo(path);
}

describe('StudentJsonRepo — save и findById', () => {
  test('round-trip: сохранённый студент читается тем же состоянием', async () => {
    const repo = new StudentJsonRepo(filePath('students-roundtrip.json'));
    const student = makeStudent();

    await repo.save(student);

    expect((await repo.findById(student.uuid))?.snapshot()).toEqual(
      student.snapshot(),
    );
  });

  test('completionSource шага: round-trip; старая запись без поля читается без него', async () => {
    const synced = {
      stepId: STEP,
      status: 'completed' as const,
      issuedAt: T0,
      completedAt: T0,
      completionSource: 'content_sync' as const,
    };
    const old = { stepId: STEP, status: 'issued' as const, issuedAt: T0 };
    const repo = new StudentJsonRepo(
      filePath('students-completion-source.json'),
    );
    const a = makeState({ status: 'active', steps: [synced] });
    const b = makeState({ status: 'active', steps: [old] });
    await Bun.write(
      filePath('students-completion-source.json'),
      JSON.stringify([a, b]),
    );

    const readA = (await repo.findById(a.uuid))?.snapshot();
    const readB = (await repo.findById(b.uuid))?.snapshot();
    expect(readA?.steps[0]?.completionSource).toBe('content_sync');
    expect(readB?.steps[0]).not.toHaveProperty('completionSource');
    const reread = await repo.findById(a.uuid);
    if (reread) await repo.save(reread);
    expect(
      (await repo.findById(a.uuid))?.snapshot().steps[0]?.completionSource,
    ).toBe('content_sync');
  });

  test('findById несуществующего — undefined, файл не создаётся', async () => {
    const path = filePath('students-missing.json');
    const repo = new StudentJsonRepo(path);

    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
    expect(await Bun.file(path).exists()).toBe(false);
  });

  test('запись по устаревшей версии — VersionConflict', async () => {
    const repo = new StudentJsonRepo(filePath('students-stale.json'));
    const student = makeStudent();
    await repo.save(student);
    const first = await repo.findById(student.uuid);
    const second = await repo.findById(student.uuid);
    if (!first || !second) throw new Error('студент не найден');
    expectOk(first.activate(T0 + 1000));
    expectOk(second.activate(T0 + 2000));
    await repo.save(first);

    await expect(repo.save(second)).rejects.toBeInstanceOf(VersionConflict);
  });
});

describe('StudentJsonRepo — legacy-записи', () => {
  const legacy = (uuid: string, extra: Record<string, unknown> = {}) => ({
    uuid,
    streamId: STREAM,
    userId: USER,
    enrolledAt: '2026-06-01T10:00',
    status: 'active',
    currentStepId: STEP,
    steps: [
      {
        stepId: STEP,
        status: 'completed',
        issuedAt: '2026-06-01T10:00',
        completedAt: '2026-06-01T10:30',
      },
    ],
    createdAt: '2026-06-01T10:00',
    ...extra,
  });

  test('ISO → числа (UTC), updatedAt = createdAt, version = 0; даты шагов тоже', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('students-legacy.json', [legacy(id)]);

    const state = (await repo.findById(id))?.snapshot();

    expect(state).toMatchObject({
      uuid: id,
      enrolledAt: T0,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
    expect(state?.steps[0]).toMatchObject({
      issuedAt: T0,
      completedAt: Date.UTC(2026, 5, 1, 10, 30),
    });
  });

  test('sentAt до минуты и completionDetails читаются', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('students-legacy-notices.json', [
      legacy(id, {
        notices: [
          { kind: 'inactivity_warn_student', sentAt: '2026-06-03T19:00' },
        ],
        status: 'advanced',
        completionDetails: { nextPreference: 'wants_next' },
      }),
    ]);

    const state = (await repo.findById(id))?.snapshot();

    expect(state?.notices).toEqual([
      { kind: 'inactivity_warn_student', sentAt: Date.UTC(2026, 5, 3, 19) },
    ]);
    expect(state?.completionDetails).toEqual({ nextPreference: 'wants_next' });
  });

  test('legacy-запись после перехода сохраняется с version 1, соседние записи целы', async () => {
    const id = crypto.randomUUID();
    const neighbour = crypto.randomUUID();
    const path = filePath('students-legacy-transition.json');
    const repo = await repoWith('students-legacy-transition.json', [
      legacy(id, { status: 'enrolled', steps: [] }),
      legacy(neighbour),
    ]);

    const loaded = await repo.findById(id);
    if (!loaded) throw new Error('студент не найден');
    expectOk(loaded.activate(T0 + 5000));
    await repo.save(loaded);

    const rows = JSON.parse(await Bun.file(path).text()) as StudentState[];
    expect(rows.find((r) => r.uuid === id)).toMatchObject({
      status: 'active',
      version: 1,
      enrolledAt: T0,
    });
    expect((await repo.findById(neighbour))?.snapshot().createdAt).toBe(T0);
  });
});

describe('StudentJsonRepo — смешанный файл', () => {
  test('ISO-записи без version и числовые с version читаются целиком, round-trip корректен', async () => {
    const legacyId = crypto.randomUUID();
    const modernId = crypto.randomUUID();
    const path = filePath('students-mixed.json');
    const repo = await repoWith('students-mixed.json', [
      {
        uuid: legacyId,
        streamId: STREAM,
        userId: USER,
        enrolledAt: '2026-06-01T10:00',
        status: 'enrolled',
        currentStepId: STEP,
        steps: [],
        createdAt: '2026-06-01T10:00',
      },
      makeState({
        uuid: modernId,
        userId: OTHER_USER,
        status: 'active',
        updatedAt: T0 + 7000,
        version: 3,
      }),
    ]);

    expect((await repo.findByStream(STREAM)).map((s) => s.uuid)).toEqual([
      legacyId,
      modernId,
    ]);
    expect((await repo.findById(legacyId))?.snapshot()).toMatchObject({
      enrolledAt: T0,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
    expect((await repo.findById(modernId))?.snapshot()).toMatchObject({
      updatedAt: T0 + 7000,
      version: 3,
    });

    const loaded = await repo.findById(legacyId);
    if (!loaded) throw new Error('студент не найден');
    expectOk(loaded.activate(T0 + 5000));
    await repo.save(loaded);

    const rows = JSON.parse(await Bun.file(path).text()) as StudentState[];
    expect(rows.find((r) => r.uuid === legacyId)).toMatchObject({
      enrolledAt: T0,
      status: 'active',
      version: 1,
    });
    expect(rows.find((r) => r.uuid === modernId)).toMatchObject({
      updatedAt: T0 + 7000,
      version: 3,
    });
    expect((await repo.findById(modernId))?.snapshot().version).toBe(3);
  });
});

describe('StudentJsonRepo — выборки', () => {
  const ids = () =>
    Array.from({ length: 6 }, () => crypto.randomUUID() as string) as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];

  test('findByStream / findByUser фильтруют по полю', async () => {
    const [a, b, c] = ids();
    const repo = await repoWith('students-find.json', [
      makeState({ uuid: a }),
      makeState({ uuid: b, streamId: OTHER_STREAM, userId: OTHER_USER }),
      makeState({ uuid: c, userId: OTHER_USER }),
    ]);

    expect((await repo.findByStream(STREAM)).map((s) => s.uuid)).toEqual([
      a,
      c,
    ]);
    expect((await repo.findByUser(OTHER_USER)).map((s) => s.uuid)).toEqual([
      b,
      c,
    ]);
    expect(await repo.findByStream(crypto.randomUUID())).toEqual([]);
  });

  test.each([
    {
      title: 'active и enrolled возвращаются, терминальные — нет',
      statuses: ['active', 'enrolled', 'abandoned', 'advanced', 'not_advanced'],
      keep: [0, 1],
    },
    {
      title: 'в файле только терминальные — пусто',
      statuses: ['advanced', 'abandoned'],
      keep: [],
    },
  ] as { title: string; statuses: StudentState['status'][]; keep: number[] }[])(
    'findStudying: $title',
    async ({ statuses, keep }) => {
      const rows = statuses.map((status) => makeState({ status }));
      const repo = await repoWith(
        `students-studying-${statuses.join('-')}.json`,
        rows,
      );

      const found = await repo.findStudying();

      expect(found.map((s) => s.uuid).sort()).toEqual(
        rows
          .filter((_, i) => keep.includes(i))
          .map((r) => r.uuid)
          .sort(),
      );
    },
  );
});

describe('StudentJsonRepo — битая запись', () => {
  test('невалидная запись — ValiError, файл не изменён', async () => {
    const path = filePath('students-broken.json');
    const text = JSON.stringify([
      makeState(),
      { uuid: 'not-a-uuid', status: 'nonsense' },
    ]);
    await Bun.write(path, text);
    const repo = new StudentJsonRepo(path);

    await expect(repo.findByStream(STREAM)).rejects.toBeInstanceOf(ValiError);
    await expect(repo.save(makeStudent())).rejects.toBeInstanceOf(ValiError);

    expect(await Bun.file(path).text()).toBe(text);
  });

  test('невалидный JSON — исключение, файл не изменён', async () => {
    const path = filePath('students-bad-json.json');
    const text = '[{"uuid": ';
    await Bun.write(path, text);
    const repo = new StudentJsonRepo(path);

    await expect(repo.findById(crypto.randomUUID())).rejects.toThrow();
    await expect(repo.save(makeStudent())).rejects.toThrow();

    expect(await Bun.file(path).text()).toBe(text);
  });
});
