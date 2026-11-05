import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StreamAr, type StreamState } from '@u7-scl/domain/stream';
import { VersionConflict } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import { ValiError } from 'valibot';
import { StreamJsonRepo } from './stream.json-repo';

// Репозиторий потоков (`<dbDir>/streams/streams.json`, D-36). Перенос
// `infra/db/stream-json-repo.test.ts` (фильтр по schoolId) + контракт новой
// записи: legacy-запись (ISO → число, version 0, updatedAt = createdAt),
// round-trip, устаревшая версия, битая запись — исключение, файл цел.
// Каталог — mkdtemp, живые данные не читаются.

const tmpDir = mkdtempSync(join(tmpdir(), 'stream-json-repo-test-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const SCHOOL_A = 'a0000000-0000-4000-8000-000000000001';
const SCHOOL_B = 'b0000000-0000-4000-8000-000000000002';
const MENTOR = '660e8400-e29b-41d4-a716-446655440002';
const MODULE = '770e8400-e29b-41d4-a716-446655440003';
const STEP = '33333333-3333-4333-8333-333333333333';
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

const filePath = (name: string) => join(tmpDir, name);

const makeState = (extra: Partial<StreamState> = {}): StreamState => ({
  uuid: crypto.randomUUID(),
  schoolId: SCHOOL_A,
  title: 'Поток',
  description: 'Описание',
  mentorId: MENTOR,
  moduleId: MODULE,
  startDate: Date.UTC(2026, 5, 1, 12),
  status: 'enrollment',
  contentSnapshot: snapshot,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

const makeStream = (extra: Partial<StreamState> = {}) => {
  const {
    uuid,
    createdAt: at,
    version: _v,
    updatedAt: _u,
    status: _s,
    ...rest
  } = makeState(extra);
  return expectOk(StreamAr.create({ uuid, ...rest }, at));
};

/** Записывает состояния «как есть» (не через агрегат). */
async function repoWith(
  name: string,
  rows: unknown[],
): Promise<StreamJsonRepo> {
  const path = filePath(name);
  await Bun.write(path, JSON.stringify(rows));
  return new StreamJsonRepo(path);
}

describe('StreamJsonRepo — save и findById', () => {
  test('round-trip: сохранённый поток читается тем же состоянием', async () => {
    const repo = new StreamJsonRepo(filePath('streams-roundtrip.json'));
    const stream = makeStream({ enrollmentKey: 'секрет', goal: 'Цель' });

    await repo.save(stream);
    const found = await repo.findById(stream.uuid);

    expect(found?.snapshot()).toEqual(stream.snapshot());
  });

  test('findById несуществующего — undefined, файл не создаётся', async () => {
    const path = filePath('streams-missing.json');
    const repo = new StreamJsonRepo(path);

    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
    expect(await Bun.file(path).exists()).toBe(false);
  });
});

describe('StreamJsonRepo — версия (D-36)', () => {
  test('запись по устаревшей версии — VersionConflict', async () => {
    const repo = new StreamJsonRepo(filePath('streams-stale.json'));
    const stream = makeStream();
    await repo.save(stream);
    const first = await repo.findById(stream.uuid);
    const second = await repo.findById(stream.uuid);
    if (!first || !second) throw new Error('поток не найден');
    expectOk(first.activate(T0 + 1000));
    expectOk(second.activate(T0 + 2000));
    await repo.save(first);

    await expect(repo.save(second)).rejects.toBeInstanceOf(VersionConflict);
    expect((await repo.findById(stream.uuid))?.snapshot().updatedAt).toBe(
      T0 + 1000,
    );
  });
});

describe('StreamJsonRepo — legacy-записи', () => {
  const legacy = (uuid: string, extra: Record<string, unknown> = {}) => ({
    uuid,
    schoolId: SCHOOL_A,
    title: 'Поток',
    description: 'Описание',
    mentorId: MENTOR,
    moduleId: MODULE,
    startDate: '2026-06-01T12:00',
    status: 'active',
    contentSnapshot: snapshot,
    createdAt: '2026-06-01T10:00',
    ...extra,
  });

  test('ISO-даты → числа (UTC), updatedAt = createdAt, version = 0', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('streams-legacy.json', [legacy(id)]);

    const state = (await repo.findById(id))?.snapshot();

    expect(state).toMatchObject({
      uuid: id,
      startDate: Date.UTC(2026, 5, 1, 12),
      createdAt: T0,
      updatedAt: T0,
      version: 0,
      status: 'active',
    });
  });

  test('legacy-запись после перехода сохраняется с version 1, соседние записи целы', async () => {
    const id = crypto.randomUUID();
    const neighbour = crypto.randomUUID();
    const path = filePath('streams-legacy-transition.json');
    const repo = await repoWith('streams-legacy-transition.json', [
      legacy(id, { status: 'active' }),
      legacy(neighbour),
    ]);

    const loaded = await repo.findById(id);
    if (!loaded) throw new Error('поток не найден');
    expectOk(loaded.complete(T0 + 5000));
    await repo.save(loaded);

    const rows = JSON.parse(await Bun.file(path).text()) as StreamState[];
    expect(rows.find((r) => r.uuid === id)).toMatchObject({
      status: 'completed',
      version: 1,
      startDate: Date.UTC(2026, 5, 1, 12),
    });
    expect((await repo.findById(neighbour))?.snapshot().createdAt).toBe(T0);
  });
});

describe('StreamJsonRepo — выборки', () => {
  const ids = (): [string, string, string] => [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];

  test('findAll фильтрует по schoolId', async () => {
    const [a1, a2, b1] = ids();
    const repo = await repoWith('streams-school.json', [
      makeState({ uuid: a1, schoolId: SCHOOL_A }),
      makeState({ uuid: a2, schoolId: SCHOOL_A }),
      makeState({ uuid: b1, schoolId: SCHOOL_B }),
    ]);

    const a = await repo.findAll({ schoolId: SCHOOL_A });
    const b = await repo.findAll({ schoolId: SCHOOL_B });

    expect(a.map((s) => s.uuid)).toEqual([a1, a2]);
    expect(b.map((s) => s.uuid)).toEqual([b1]);
  });

  test('findAll фильтрует по status и mentorId; без фильтра — все', async () => {
    const [x, y, z] = ids();
    const other = '880e8400-e29b-41d4-a716-446655440009';
    const repo = await repoWith('streams-filter.json', [
      makeState({ uuid: x, status: 'active' }),
      makeState({ uuid: y, status: 'completed', mentorId: other }),
      makeState({ uuid: z, status: 'active', mentorId: other }),
    ]);

    expect(
      (await repo.findAll({ status: 'active' })).map((s) => s.uuid),
    ).toEqual([x, z]);
    expect(
      (await repo.findAll({ mentorId: other })).map((s) => s.uuid),
    ).toEqual([y, z]);
    expect(
      (await repo.findAll({ status: 'active', mentorId: other })).map(
        (s) => s.uuid,
      ),
    ).toEqual([z]);
    expect(await repo.findAll({})).toHaveLength(3);
  });

  test('findByTelegramGroup: сравнение строк, первое совпадение; нет — undefined', async () => {
    const [x, y] = ids();
    const repo = await repoWith('streams-group.json', [
      makeState({ uuid: x, telegramGroupId: '-1001234567890' }),
      makeState({ uuid: y, telegramGroupId: '-1001234567890' }),
    ]);

    expect((await repo.findByTelegramGroup('-1001234567890'))?.uuid).toBe(x);
    expect(await repo.findByTelegramGroup('-100999')).toBeUndefined();
  });
});

describe('StreamJsonRepo — битая запись', () => {
  test('невалидная запись — ValiError, файл не изменён', async () => {
    const path = filePath('streams-broken.json');
    const text = JSON.stringify([
      makeState(),
      { uuid: 'not-a-uuid', status: 'nonsense' },
    ]);
    await Bun.write(path, text);
    const repo = new StreamJsonRepo(path);

    await expect(repo.findAll({})).rejects.toBeInstanceOf(ValiError);
    await expect(repo.save(makeStream())).rejects.toBeInstanceOf(ValiError);

    expect(await Bun.file(path).text()).toBe(text);
  });

  test('невалидный JSON — исключение, файл не изменён', async () => {
    const path = filePath('streams-bad-json.json');
    const text = '[{"uuid": ';
    await Bun.write(path, text);
    const repo = new StreamJsonRepo(path);

    await expect(repo.findById(crypto.randomUUID())).rejects.toThrow();
    await expect(repo.save(makeStream())).rejects.toThrow();

    expect(await Bun.file(path).text()).toBe(text);
  });
});
