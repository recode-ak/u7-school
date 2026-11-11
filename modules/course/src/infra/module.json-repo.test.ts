import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModuleAr, type ModuleState } from '@u7-scl/domain/course';
import { ValiError } from 'valibot';
import { ModuleJsonRepo } from './module.json-repo';

// Репозиторий модулей (`<dbDir>/courses/modules.json`, D-36). Перенос
// `infra/db/module-json-repo.test.ts` (save/getByUuid, не найден, getAll,
// фильтр status, перезапись) + контракт новой записи: legacy-запись
// (ISO без секунд → число, version 0, updatedAt = createdAt), round-trip,
// битая запись — исключение, файл цел.
// Каталог — mkdtemp: новый репозиторий пишет даты числами и до Ф5 не
// должен писать в `data/` (Т11).

const tmpDir = mkdtempSync(join(tmpdir(), 'module-json-repo-test-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const AUTHOR = '660e8400-e29b-41d4-a716-446655440004';
const OTHER_AUTHOR = '880e8400-e29b-41d4-a716-446655440009';
const LESSON = '33333333-3333-4333-8333-333333333333';
const T0 = Date.UTC(2026, 6, 8, 18, 35);

const filePath = (name: string) => join(tmpDir, name);

const makeState = (extra: Partial<ModuleState> = {}): ModuleState => ({
  uuid: crypto.randomUUID(),
  title: 'Тестовый модуль',
  description: 'Описание',
  authorId: AUTHOR,
  tags: ['js'],
  status: 'draft',
  projects: [
    {
      uuid: crypto.randomUUID(),
      title: 'Проект',
      status: 'published',
      lessonIds: [LESSON],
    },
  ],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

/** Записывает строки «как есть» (не через агрегат). */
async function repoWith(
  name: string,
  rows: unknown[],
): Promise<ModuleJsonRepo> {
  const path = filePath(name);
  await Bun.write(path, JSON.stringify(rows));
  return new ModuleJsonRepo(path);
}

describe('ModuleJsonRepo — save и findById', () => {
  test('round-trip: сохранённый модуль читается тем же состоянием', async () => {
    const state = makeState({ goal: 'Цель' });
    const repo = await repoWith('modules-roundtrip.json', [state]);

    const loaded = await repo.findById(state.uuid);
    if (!loaded) throw new Error('модуль не найден');
    await repo.save(loaded);
    const found = await repo.findById(state.uuid);

    expect(found?.snapshot()).toEqual(loaded.snapshot());
    expect(found?.snapshot()).toMatchObject({
      uuid: state.uuid,
      title: 'Тестовый модуль',
      goal: 'Цель',
    });
  });

  test('findById несуществующего — undefined, файл не создаётся', async () => {
    const path = filePath('modules-missing.json');
    const repo = new ModuleJsonRepo(path);

    expect(
      await repo.findById('550e8400-e29b-41d4-a716-446655440099'),
    ).toBeUndefined();
    expect(await Bun.file(path).exists()).toBe(false);
  });

  test('findById в файле с другими записями — undefined', async () => {
    const repo = await repoWith('modules-other.json', [makeState()]);

    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
  });

  test('save перезаписывает существующий модуль, соседние записи целы', async () => {
    const a = makeState();
    const b = makeState({ title: 'Соседний' });
    const path = filePath('modules-update.json');
    const repo = await repoWith('modules-update.json', [a, b]);

    await repo.save(ModuleAr.restore({ ...a, title: 'Обновлённый' }));

    const rows = JSON.parse(await Bun.file(path).text()) as ModuleState[];
    expect(rows).toHaveLength(2);
    expect((await repo.findById(a.uuid))?.snapshot().title).toBe('Обновлённый');
    expect((await repo.findById(b.uuid))?.snapshot().title).toBe('Соседний');
  });

  test('save пишет даты числами', async () => {
    const state = makeState();
    const path = filePath('modules-numbers.json');
    const repo = await repoWith('modules-numbers.json', [state]);
    const loaded = await repo.findById(state.uuid);
    if (!loaded) throw new Error('модуль не найден');

    await repo.save(loaded);

    const [row] = JSON.parse(await Bun.file(path).text()) as ModuleState[];
    expect(row?.createdAt).toBe(T0);
    expect(row?.updatedAt).toBe(T0);
  });
});

describe('ModuleJsonRepo — legacy-записи', () => {
  const legacy = (uuid: string, extra: Record<string, unknown> = {}) => ({
    uuid,
    title: 'Модуль',
    description: 'Описание',
    authorId: AUTHOR,
    targetAudience: 'Новички',
    tags: ['js'],
    status: 'published',
    projects: [
      {
        uuid: crypto.randomUUID(),
        title: 'Проект',
        goal: 'Цель',
        result: 'Результат',
        status: 'published',
        lessonIds: [LESSON],
      },
    ],
    createdAt: '2026-07-08T18:35',
    updatedAt: '2026-07-08T18:35',
    ...extra,
  });

  test('ISO без секунд → число (UTC), version = 0', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('modules-legacy.json', [legacy(id)]);

    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      uuid: id,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
      status: 'published',
    });
  });

  test('запись без updatedAt и version: updatedAt = createdAt, version = 0', async () => {
    const id = crypto.randomUUID();
    const { updatedAt: _u, ...noUpdated } = legacy(id);
    const repo = await repoWith('modules-legacy-no-updated.json', [noUpdated]);

    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  test('запись с числовыми датами и version читается как есть', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('modules-numeric.json', [
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
    const path = filePath('modules-legacy-save.json');
    const repo = await repoWith('modules-legacy-save.json', [
      legacy(id),
      legacy(neighbour),
    ]);

    const loaded = await repo.findById(id);
    if (!loaded) throw new Error('модуль не найден');
    await repo.save(loaded);

    const rows = JSON.parse(await Bun.file(path).text()) as ModuleState[];
    expect(rows.find((r) => r.uuid === id)).toMatchObject({
      createdAt: T0,
      version: 0,
    });
    expect((await repo.findById(neighbour))?.snapshot().createdAt).toBe(T0);
  });
});

describe('ModuleJsonRepo — findAll', () => {
  const at = (day: number) => Date.UTC(2026, 6, day, 10);

  const fixtureRows = () => {
    const [a, b, c] = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    return {
      ids: { a, b, c },
      rows: [
        makeState({
          uuid: a,
          title: 'Beta JS',
          status: 'published',
          tags: ['js', 'web'],
          createdAt: at(2),
          updatedAt: at(2),
        }),
        makeState({
          uuid: b,
          title: 'alpha python',
          status: 'draft',
          authorId: OTHER_AUTHOR,
          tags: ['python'],
          createdAt: at(3),
          updatedAt: at(3),
        }),
        makeState({
          uuid: c,
          title: 'Gamma',
          status: 'published',
          tags: undefined,
          createdAt: at(1),
          updatedAt: at(1),
        }),
      ],
    };
  };
  const uuids = (modules: ModuleAr[]) => modules.map((m) => m.uuid);

  test('без фильтра — все модули в порядке файла; пустой файл — []', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-all.json', rows);

    expect(uuids(await repo.findAll())).toEqual([ids.a, ids.b, ids.c]);
    expect(uuids(await repo.findAll({}))).toEqual([ids.a, ids.b, ids.c]);
    expect(await (await repoWith('modules-empty.json', [])).findAll()).toEqual(
      [],
    );
  });

  test('отсутствие файла — []', async () => {
    const repo = new ModuleJsonRepo(filePath('modules-nofile.json'));

    expect(await repo.findAll()).toEqual([]);
  });

  test('фильтр status', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-status.json', rows);

    expect(uuids(await repo.findAll({ status: 'published' }))).toEqual([
      ids.a,
      ids.c,
    ]);
    expect(uuids(await repo.findAll({ status: 'draft' }))).toEqual([ids.b]);
    expect(await repo.findAll({ status: 'archived' })).toEqual([]);
  });

  test('фильтр authorId', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-author.json', rows);

    expect(uuids(await repo.findAll({ authorId: OTHER_AUTHOR }))).toEqual([
      ids.b,
    ]);
  });

  test('фильтр title — подстрока без учёта регистра', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-title.json', rows);

    expect(uuids(await repo.findAll({ title: 'JS' }))).toEqual([ids.a]);
    expect(uuids(await repo.findAll({ title: 'ALPHA' }))).toEqual([ids.b]);
    expect(await repo.findAll({ title: 'нет такого' })).toEqual([]);
  });

  test('фильтр tags — пересечение; модуль без тегов не проходит; пустой массив — без фильтра', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-tags.json', rows);

    expect(uuids(await repo.findAll({ tags: ['web', 'python'] }))).toEqual([
      ids.a,
      ids.b,
    ]);
    expect(uuids(await repo.findAll({ tags: ['js'] }))).toEqual([ids.a]);
    expect(await repo.findAll({ tags: ['rust'] })).toEqual([]);
    expect(await repo.findAll({ tags: [] })).toHaveLength(3);
  });

  test('условия объединяются по «и»', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-and.json', rows);

    expect(
      uuids(await repo.findAll({ status: 'published', title: 'gamma' })),
    ).toEqual([ids.c]);
    expect(await repo.findAll({ status: 'draft', authorId: AUTHOR })).toEqual(
      [],
    );
  });

  test('sort title:asc и title:desc', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-sort-title.json', rows);

    // 'Beta JS' < 'Gamma' < 'alpha python' (порядок кодов символов)
    expect(uuids(await repo.findAll({ sort: 'title:asc' }))).toEqual([
      ids.a,
      ids.c,
      ids.b,
    ]);
    expect(uuids(await repo.findAll({ sort: 'title:desc' }))).toEqual([
      ids.b,
      ids.c,
      ids.a,
    ]);
  });

  test('sort createdAt:asc и createdAt:desc', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-sort-created.json', rows);

    expect(uuids(await repo.findAll({ sort: 'createdAt:asc' }))).toEqual([
      ids.c,
      ids.a,
      ids.b,
    ]);
    expect(uuids(await repo.findAll({ sort: 'createdAt:desc' }))).toEqual([
      ids.b,
      ids.a,
      ids.c,
    ]);
  });

  test('направление не asc (или не задано) — по убыванию', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-sort-desc-default.json', rows);

    expect(uuids(await repo.findAll({ sort: 'createdAt:down' }))).toEqual([
      ids.b,
      ids.a,
      ids.c,
    ]);
    expect(uuids(await repo.findAll({ sort: 'createdAt' }))).toEqual([
      ids.b,
      ids.a,
      ids.c,
    ]);
  });

  test('limit — срез после сортировки и после фильтра', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('modules-limit.json', rows);

    expect(
      uuids(await repo.findAll({ sort: 'createdAt:asc', limit: 2 })),
    ).toEqual([ids.c, ids.a]);
    expect(uuids(await repo.findAll({ limit: 1 }))).toEqual([ids.a]);
    expect(await repo.findAll({ limit: 0 })).toEqual([]);
    expect(
      uuids(await repo.findAll({ status: 'published', limit: 1 })),
    ).toEqual([ids.a]);
  });
});

describe('ModuleJsonRepo — битая запись', () => {
  test('невалидная запись — ValiError, файл не изменён', async () => {
    const path = filePath('modules-broken.json');
    const text = JSON.stringify([
      makeState(),
      { uuid: 'not-a-uuid', status: 'nonsense' },
    ]);
    await Bun.write(path, text);
    const repo = new ModuleJsonRepo(path);

    await expect(repo.findAll({})).rejects.toBeInstanceOf(ValiError);
    await expect(
      repo.save(ModuleAr.restore(makeState())),
    ).rejects.toBeInstanceOf(ValiError);

    expect(await Bun.file(path).text()).toBe(text);
  });

  test('невалидный JSON — исключение, файл не изменён', async () => {
    const path = filePath('modules-bad-json.json');
    const text = '[{"uuid": ';
    await Bun.write(path, text);
    const repo = new ModuleJsonRepo(path);

    await expect(repo.findById(crypto.randomUUID())).rejects.toThrow();
    await expect(repo.save(ModuleAr.restore(makeState()))).rejects.toThrow();

    expect(await Bun.file(path).text()).toBe(text);
  });
});
