import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { LessonAr, type LessonState } from '@u7-scl/domain/course';
import { TempDir } from 'dmg-core/testing';
import { ValiError } from 'valibot';
import { LessonJsonRepo } from './lesson.json-repo';

// Репозиторий уроков (`<dbDir>/courses/lessons.json`, D-36). Перенос
// `infra/db/lesson-json-repo.test.ts` (save/getByUuid, getByIds) + контракт
// новой записи: legacy-запись (ISO без секунд → число, version 0, нет
// `updatedAt` → `createdAt`), round-trip, битая запись — исключение, файл цел.
// Каталог — временный: новый репозиторий пишет даты
// числами и до Ф5 не должен писать в `data/` (Т11).

let tmpDir: TempDir;
beforeAll(() => {
  tmpDir = TempDir.create('lesson-json-repo-test-');
});
afterAll(() => tmpDir.dispose());

const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const STEP = '55555555-5555-4555-8555-555555555555';
const T0 = Date.UTC(2026, 6, 8, 18, 35);

const filePath = (name: string) => tmpDir.file(name);

const makeState = (extra: Partial<LessonState> = {}): LessonState => ({
  uuid: crypto.randomUUID(),
  moduleId: MODULE,
  title: 'Тестовый урок',
  status: 'draft',
  stepIds: [STEP],
  mentorStepIds: [],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

/** Записывает строки «как есть» (не через агрегат). */
async function repoWith(
  name: string,
  rows: unknown[],
): Promise<LessonJsonRepo> {
  const path = filePath(name);
  await Bun.write(path, JSON.stringify(rows));
  return new LessonJsonRepo(path);
}

describe('LessonJsonRepo — save и findById', () => {
  test('round-trip: сохранённый урок читается тем же состоянием', async () => {
    const state = makeState({ estimatedMinutes: 30, additional: 'Доп' });
    const repo = await repoWith('lessons-roundtrip.json', [state]);

    const loaded = await repo.findById(state.uuid);
    if (!loaded) throw new Error('урок не найден');
    await repo.save(loaded);
    const found = await repo.findById(state.uuid);

    expect(found?.snapshot()).toEqual(loaded.snapshot());
    expect(found?.snapshot()).toMatchObject({
      uuid: state.uuid,
      title: 'Тестовый урок',
      estimatedMinutes: 30,
      stepIds: [STEP],
    });
  });

  test('findById несуществующего — undefined, файл не создаётся', async () => {
    const path = filePath('lessons-missing.json');
    const repo = new LessonJsonRepo(path);

    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
    expect(await Bun.file(path).exists()).toBe(false);
  });

  test('findById в файле с другими записями — undefined', async () => {
    const repo = await repoWith('lessons-other.json', [makeState()]);

    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
  });

  test('save перезаписывает существующий урок, соседние записи целы', async () => {
    const a = makeState();
    const b = makeState({ title: 'Соседний' });
    const path = filePath('lessons-update.json');
    const repo = await repoWith('lessons-update.json', [a, b]);

    await repo.save(LessonAr.restore({ ...a, title: 'Обновлённый' }));

    const rows = JSON.parse(await Bun.file(path).text()) as LessonState[];
    expect(rows).toHaveLength(2);
    expect((await repo.findById(a.uuid))?.snapshot().title).toBe('Обновлённый');
    expect((await repo.findById(b.uuid))?.snapshot().title).toBe('Соседний');
  });

  test('save пишет даты числами', async () => {
    const state = makeState();
    const path = filePath('lessons-numbers.json');
    const repo = await repoWith('lessons-numbers.json', [state]);
    const loaded = await repo.findById(state.uuid);
    if (!loaded) throw new Error('урок не найден');

    await repo.save(loaded);

    const [row] = JSON.parse(await Bun.file(path).text()) as LessonState[];
    expect(row?.createdAt).toBe(T0);
    expect(row?.updatedAt).toBe(T0);
  });
});

describe('LessonJsonRepo — findByIds', () => {
  const ids = () => [
    crypto.randomUUID(),
    crypto.randomUUID(),
    crypto.randomUUID(),
  ];
  const uuids = (lessons: LessonAr[]) => lessons.map((l) => l.uuid);

  test('возвращает уроки по списку ID (перенос getByIds)', async () => {
    const [a, b] = ids();
    const repo = await repoWith('lessons-ids.json', [
      makeState({ uuid: a }),
      makeState({ uuid: b }),
    ]);

    const result = await repo.findByIds([a as string]);

    expect(uuids(result)).toEqual([a as string]);
  });

  test('порядок — как в файле, а не как в запросе', async () => {
    const [a, b, c] = ids() as [string, string, string];
    const repo = await repoWith('lessons-ids-order.json', [
      makeState({ uuid: a }),
      makeState({ uuid: b }),
      makeState({ uuid: c }),
    ]);

    expect(uuids(await repo.findByIds([c, a]))).toEqual([a, c]);
  });

  test('отсутствующие ID пропускаются', async () => {
    const [a] = ids() as [string];
    const repo = await repoWith('lessons-ids-missing.json', [
      makeState({ uuid: a }),
    ]);

    expect(uuids(await repo.findByIds([crypto.randomUUID(), a]))).toEqual([a]);
  });

  test('повтор ID в запросе не дублирует урок', async () => {
    const [a] = ids() as [string];
    const repo = await repoWith('lessons-ids-dup.json', [
      makeState({ uuid: a }),
    ]);

    expect(uuids(await repo.findByIds([a, a]))).toEqual([a]);
  });

  test('пустой список — []; нет файла — []', async () => {
    const repo = await repoWith('lessons-ids-empty.json', [makeState()]);

    expect(await repo.findByIds([])).toEqual([]);
    expect(
      await new LessonJsonRepo(filePath('lessons-ids-nofile.json')).findByIds([
        crypto.randomUUID(),
      ]),
    ).toEqual([]);
  });
});

describe('LessonJsonRepo — legacy-записи', () => {
  const legacy = (uuid: string, extra: Record<string, unknown> = {}) => ({
    uuid,
    moduleId: MODULE,
    title: 'Урок',
    additional: 'Доп',
    status: 'published',
    estimatedMinutes: 15,
    stepIds: [STEP],
    mentorStepIds: [],
    createdAt: '2026-07-08T18:35',
    updatedAt: '2026-07-08T18:35',
    ...extra,
  });

  test('ISO без секунд → число (UTC), version = 0', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('lessons-legacy.json', [legacy(id)]);

    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      uuid: id,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
      status: 'published',
      estimatedMinutes: 15,
    });
  });

  test('запись без updatedAt (так в данных у 2 уроков): updatedAt = createdAt', async () => {
    const id = crypto.randomUUID();
    const { updatedAt: _u, ...noUpdated } = legacy(id);
    const repo = await repoWith('lessons-legacy-no-updated.json', [noUpdated]);

    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  test('запись с числовыми датами и version читается как есть', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('lessons-numeric.json', [
      legacy(id, { createdAt: T0, updatedAt: T0 + 1, version: 2 }),
    ]);

    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      createdAt: T0,
      updatedAt: T0 + 1,
      version: 2,
    });
  });

  test('legacy-запись после save становится числовой, соседние целы', async () => {
    const id = crypto.randomUUID();
    const neighbour = crypto.randomUUID();
    const path = filePath('lessons-legacy-save.json');
    const repo = await repoWith('lessons-legacy-save.json', [
      legacy(id),
      legacy(neighbour),
    ]);

    const loaded = await repo.findById(id);
    if (!loaded) throw new Error('урок не найден');
    await repo.save(loaded);

    const rows = JSON.parse(await Bun.file(path).text()) as LessonState[];
    expect(rows.find((r) => r.uuid === id)).toMatchObject({
      createdAt: T0,
      version: 0,
    });
    expect((await repo.findById(neighbour))?.snapshot().createdAt).toBe(T0);
  });
});

describe('LessonJsonRepo — битая запись', () => {
  test('невалидная запись — ValiError на чтении и на save, файл не изменён', async () => {
    const path = filePath('lessons-broken.json');
    const text = JSON.stringify([
      makeState(),
      { uuid: 'not-a-uuid', status: 'nonsense' },
    ]);
    await Bun.write(path, text);
    const repo = new LessonJsonRepo(path);

    await expect(repo.findByIds([crypto.randomUUID()])).rejects.toBeInstanceOf(
      ValiError,
    );
    await expect(
      repo.save(LessonAr.restore(makeState())),
    ).rejects.toBeInstanceOf(ValiError);

    expect(await Bun.file(path).text()).toBe(text);
  });

  test('невалидный JSON — исключение, файл не изменён', async () => {
    const path = filePath('lessons-bad-json.json');
    const text = '[{"uuid": ';
    await Bun.write(path, text);
    const repo = new LessonJsonRepo(path);

    await expect(repo.findById(crypto.randomUUID())).rejects.toThrow();
    await expect(repo.save(LessonAr.restore(makeState()))).rejects.toThrow();

    expect(await Bun.file(path).text()).toBe(text);
  });
});
