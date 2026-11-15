import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { CourseAr, type CourseState } from '@u7-scl/domain/course';
import { TempDir } from 'dmg-core/testing';
import { ValiError } from 'valibot';
import { CourseJsonRepo } from './course.json-repo';

// Репозиторий курсов (`<dbDir>/courses/courses.json`, D-36, D-64). Перенос
// `infra/db/course-json-repo.test.ts` (12: save/getByUuid, не найден,
// перезапись, getAll, фильтры status/authorId/title/combined, sort title asc,
// createdAt desc, limit, нет файла) + контракт нового формата: строгое чтение
// (старый формат `phases[].moduleIds` — ошибка, файл цел), даты числом (ISO
// отвергается), нарушения инвариантов программы — ошибка чтения. Каталог —
// Временный каталог: данные проекта не читаются и не пишутся.

let tmpDir: TempDir;
beforeAll(() => {
  tmpDir = TempDir.create('course-json-repo-test-');
});
afterAll(() => tmpDir.dispose());

const AUTHOR = '660e8400-e29b-41d4-a716-446655440004';
const OTHER_AUTHOR = '880e8400-e29b-41d4-a716-446655440009';
const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const M3 = '33333333-3333-4333-8333-333333333333';
const T0 = Date.UTC(2026, 6, 8, 18, 35);

const filePath = (name: string) => tmpDir.file(name);

const makeState = (extra: Partial<CourseState> = {}): CourseState => ({
  uuid: crypto.randomUUID(),
  title: 'Тестовый курс',
  description: 'Описание',
  authorId: AUTHOR,
  moduleIds: [M1, M2],
  phases: [{ title: 'Основы', track: 'tech', fromModuleId: M1 }],
  status: 'draft',
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

/** Записывает строки «как есть» (не через агрегат). */
async function repoWith(
  name: string,
  rows: unknown[],
): Promise<CourseJsonRepo> {
  const path = filePath(name);
  await Bun.write(path, JSON.stringify(rows));
  return new CourseJsonRepo(path);
}

describe('CourseJsonRepo — save и findById', () => {
  test('round-trip: сохранённый курс читается тем же состоянием', async () => {
    const state = makeState({ title: 'Курс JS' });
    const repo = await repoWith('courses-roundtrip.json', [state]);

    const loaded = await repo.findById(state.uuid);
    if (!loaded) throw new Error('курс не найден');
    await repo.save(loaded);
    const found = await repo.findById(state.uuid);

    expect(found?.snapshot()).toEqual(loaded.snapshot());
    expect(found?.snapshot()).toMatchObject({
      uuid: state.uuid,
      title: 'Курс JS',
      moduleIds: [M1, M2],
      phases: [{ title: 'Основы', track: 'tech', fromModuleId: M1 }],
    });
  });

  test('findById несуществующего — undefined, файл не создаётся', async () => {
    const path = filePath('courses-missing.json');
    const repo = new CourseJsonRepo(path);

    expect(
      await repo.findById('550e8400-e29b-41d4-a716-446655440099'),
    ).toBeUndefined();
    expect(await Bun.file(path).exists()).toBe(false);
  });

  test('findById в файле с другими записями — undefined', async () => {
    const repo = await repoWith('courses-other.json', [makeState()]);

    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
  });

  test('save перезаписывает существующий курс, соседние записи целы', async () => {
    const a = makeState();
    const b = makeState({ title: 'Соседний' });
    const path = filePath('courses-update.json');
    const repo = await repoWith('courses-update.json', [a, b]);

    await repo.save(CourseAr.restore({ ...a, title: 'Обновлённый курс' }));

    const rows = JSON.parse(await Bun.file(path).text()) as CourseState[];
    expect(rows).toHaveLength(2);
    expect((await repo.findById(a.uuid))?.snapshot().title).toBe(
      'Обновлённый курс',
    );
    expect((await repo.findById(b.uuid))?.snapshot().title).toBe('Соседний');
  });

  test('save пишет даты числами и этапы метками', async () => {
    const state = makeState();
    const path = filePath('courses-numbers.json');
    const repo = await repoWith('courses-numbers.json', [state]);
    const loaded = await repo.findById(state.uuid);
    if (!loaded) throw new Error('курс не найден');

    await repo.save(loaded);

    const [row] = JSON.parse(await Bun.file(path).text()) as CourseState[];
    expect(row?.createdAt).toBe(T0);
    expect(row?.updatedAt).toBe(T0);
    expect(row?.phases).toEqual([
      { title: 'Основы', track: 'tech', fromModuleId: M1 },
    ]);
  });
});

describe('CourseJsonRepo — даты записи', () => {
  const record = (uuid: string, extra: Record<string, unknown> = {}) => ({
    uuid,
    title: 'Fullstack JS',
    description: 'Описание',
    authorId: AUTHOR,
    moduleIds: [M1, M2],
    phases: [{ title: 'Основы JS', track: 'tech', fromModuleId: M1 }],
    status: 'published',
    createdAt: T0,
    ...extra,
  });

  test('нет updatedAt и version → updatedAt = createdAt, version = 0', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('courses-legacy-dates.json', [record(id)]);

    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      uuid: id,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
      status: 'published',
    });
  });

  test('запись с числовыми датами и version читается как есть', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('courses-numeric.json', [
      record(id, { createdAt: T0, updatedAt: T0 + 1, version: 2 }),
    ]);

    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      createdAt: T0,
      updatedAt: T0 + 1,
      version: 2,
    });
  });

  test('запись без version после save получает version 0, соседние целы', async () => {
    const id = crypto.randomUUID();
    const neighbour = crypto.randomUUID();
    const path = filePath('courses-legacy-save.json');
    const repo = await repoWith('courses-legacy-save.json', [
      record(id),
      record(neighbour),
    ]);

    const loaded = await repo.findById(id);
    if (!loaded) throw new Error('курс не найден');
    await repo.save(loaded);

    const rows = JSON.parse(await Bun.file(path).text()) as CourseState[];
    expect(rows.find((r) => r.uuid === id)).toMatchObject({
      createdAt: T0,
      version: 0,
    });
    expect((await repo.findById(neighbour))?.snapshot().createdAt).toBe(T0);
  });
});

describe('CourseJsonRepo — строгий формат: старая запись — ошибка, файл цел', () => {
  const oldFormat = (uuid: string) => ({
    uuid,
    title: 'Fullstack JS',
    description: 'Описание',
    authorId: AUTHOR,
    phases: [{ title: 'Основы JS', track: 'tech', moduleIds: [M1, M2] }],
    status: 'published',
    createdAt: T0,
  });

  test('phases[].moduleIds без moduleIds курса — ValiError на чтении и записи', async () => {
    const id = crypto.randomUUID();
    const path = filePath('courses-old-format.json');
    const text = JSON.stringify([oldFormat(id)]);
    await Bun.write(path, text);
    const repo = new CourseJsonRepo(path);

    await expect(repo.findById(id)).rejects.toBeInstanceOf(ValiError);
    await expect(repo.findAll()).rejects.toBeInstanceOf(ValiError);
    await expect(repo.findByIds([id])).rejects.toBeInstanceOf(ValiError);
    await expect(
      repo.save(CourseAr.restore(makeState())),
    ).rejects.toBeInstanceOf(ValiError);

    expect(await Bun.file(path).text()).toBe(text);
  });

  test('одна старая запись среди новых — ошибка чтения всего файла, а не пропуск записи', async () => {
    const path = filePath('courses-mixed-format.json');
    const text = JSON.stringify([makeState(), oldFormat(crypto.randomUUID())]);
    await Bun.write(path, text);
    const repo = new CourseJsonRepo(path);

    await expect(repo.findAll()).rejects.toBeInstanceOf(ValiError);
    expect(await Bun.file(path).text()).toBe(text);
  });
});

describe('CourseJsonRepo — нарушения инвариантов программы (Р2) — ошибка чтения', () => {
  const broken: [string, Partial<CourseState>][] = [
    [
      'дубль заголовков этапов',
      {
        phases: [
          { title: 'Этап', fromModuleId: M1 },
          { title: 'Этап', fromModuleId: M3 },
        ],
        moduleIds: [M1, M2, M3],
      },
    ],
    ['метка вне программы', { phases: [{ title: 'Э', fromModuleId: M3 }] }],
    [
      'метки не в порядке программы',
      {
        moduleIds: [M1, M2, M3],
        phases: [
          { title: 'Второй', fromModuleId: M3 },
          { title: 'Первый', fromModuleId: M1 },
        ],
      },
    ],
    [
      'два этапа на одном модуле',
      {
        phases: [
          { title: 'Первый', fromModuleId: M1 },
          { title: 'Второй', fromModuleId: M1 },
        ],
      },
    ],
    [
      'первая метка не на первом модуле',
      { phases: [{ title: 'Э', fromModuleId: M2 }] },
    ],
    ['повтор модуля в программе', { moduleIds: [M1, M2, M1] }],
    ['этапы при пустой программе', { moduleIds: [] }],
  ];

  for (const [index, [name, extra]] of broken.entries()) {
    test(`${name} — ValiError, файл не изменён`, async () => {
      const state = makeState(extra);
      const path = filePath(`courses-invariant-${index}.json`);
      const text = JSON.stringify([state]);
      await Bun.write(path, text);
      const repo = new CourseJsonRepo(path);

      await expect(repo.findById(state.uuid)).rejects.toBeInstanceOf(ValiError);
      await expect(repo.findAll()).rejects.toBeInstanceOf(ValiError);

      expect(await Bun.file(path).text()).toBe(text);
    });
  }

  test('нарушенная соседняя запись роняет чтение всего файла', async () => {
    const intact = makeState({ title: 'Целый курс' });
    const broken = makeState({ moduleIds: [M1, M2, M1] });
    const path = filePath('courses-invariant-neighbour.json');
    const text = JSON.stringify([intact, broken]);
    await Bun.write(path, text);
    const repo = new CourseJsonRepo(path);

    await expect(repo.findById(intact.uuid)).rejects.toBeInstanceOf(ValiError);
    await expect(repo.findAll()).rejects.toBeInstanceOf(ValiError);

    expect(await Bun.file(path).text()).toBe(text);
  });
});

describe('CourseJsonRepo — findByIds', () => {
  const ids = () =>
    [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()] as [
      string,
      string,
      string,
    ];
  const uuids = (courses: CourseAr[]) => courses.map((c) => c.uuid);

  test('возвращает курсы по списку ID', async () => {
    const [a, b] = ids();
    const repo = await repoWith('courses-ids.json', [
      makeState({ uuid: a }),
      makeState({ uuid: b }),
    ]);

    expect(uuids(await repo.findByIds([a]))).toEqual([a]);
  });

  test('порядок — как в файле, а не как в запросе', async () => {
    const [a, b, c] = ids();
    const repo = await repoWith('courses-ids-order.json', [
      makeState({ uuid: a }),
      makeState({ uuid: b }),
      makeState({ uuid: c }),
    ]);

    expect(uuids(await repo.findByIds([c, a]))).toEqual([a, c]);
  });

  test('неизвестные ID отбрасываются', async () => {
    const [a] = ids();
    const repo = await repoWith('courses-ids-missing.json', [
      makeState({ uuid: a }),
    ]);

    expect(uuids(await repo.findByIds([crypto.randomUUID(), a]))).toEqual([a]);
  });

  test('повтор ID в запросе не дублирует курс', async () => {
    const [a] = ids();
    const repo = await repoWith('courses-ids-dup.json', [
      makeState({ uuid: a }),
    ]);

    expect(uuids(await repo.findByIds([a, a]))).toEqual([a]);
  });

  test('пустой список — []; нет файла — []', async () => {
    const repo = await repoWith('courses-ids-empty.json', [makeState()]);

    expect(await repo.findByIds([])).toEqual([]);
    expect(
      await new CourseJsonRepo(filePath('courses-ids-nofile.json')).findByIds([
        crypto.randomUUID(),
      ]),
    ).toEqual([]);
  });
});

describe('CourseJsonRepo — findAll', () => {
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
          createdAt: at(2),
          updatedAt: at(2),
        }),
        makeState({
          uuid: b,
          title: 'alpha python',
          status: 'draft',
          authorId: OTHER_AUTHOR,
          createdAt: at(3),
          updatedAt: at(3),
        }),
        makeState({
          uuid: c,
          title: 'Gamma',
          status: 'published',
          createdAt: at(1),
          updatedAt: at(1),
        }),
      ],
    };
  };
  const uuids = (courses: CourseAr[]) => courses.map((c) => c.uuid);

  test('без фильтра — все курсы в порядке файла (порядок часть поведения)', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('courses-all.json', rows);

    expect(uuids(await repo.findAll())).toEqual([ids.a, ids.b, ids.c]);
    expect(uuids(await repo.findAll({}))).toEqual([ids.a, ids.b, ids.c]);
    expect(await (await repoWith('courses-empty.json', [])).findAll()).toEqual(
      [],
    );
  });

  test('отсутствие файла — []', async () => {
    const repo = new CourseJsonRepo(filePath('courses-nofile.json'));

    expect(await repo.findAll()).toEqual([]);
  });

  test('фильтр status', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('courses-status.json', rows);

    expect(uuids(await repo.findAll({ status: 'published' }))).toEqual([
      ids.a,
      ids.c,
    ]);
    expect(uuids(await repo.findAll({ status: 'draft' }))).toEqual([ids.b]);
    expect(await repo.findAll({ status: 'archived' })).toEqual([]);
  });

  test('фильтр authorId', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('courses-author.json', rows);

    expect(uuids(await repo.findAll({ authorId: OTHER_AUTHOR }))).toEqual([
      ids.b,
    ]);
  });

  test('фильтр title — подстрока без учёта регистра', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('courses-title.json', rows);

    expect(uuids(await repo.findAll({ title: 'JS' }))).toEqual([ids.a]);
    expect(uuids(await repo.findAll({ title: 'ALPHA' }))).toEqual([ids.b]);
    expect(await repo.findAll({ title: 'нет такого' })).toEqual([]);
  });

  test('условия объединяются по «и»', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('courses-and.json', rows);

    expect(
      uuids(await repo.findAll({ status: 'published', title: 'gamma' })),
    ).toEqual([ids.c]);
    expect(
      uuids(await repo.findAll({ authorId: AUTHOR, status: 'published' })),
    ).toEqual([ids.a, ids.c]);
    expect(await repo.findAll({ status: 'draft', authorId: AUTHOR })).toEqual(
      [],
    );
  });

  test('sort title:asc и title:desc', async () => {
    const { ids, rows } = fixtureRows();
    const repo = await repoWith('courses-sort-title.json', rows);

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
    const repo = await repoWith('courses-sort-created.json', rows);

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
    const repo = await repoWith('courses-sort-desc-default.json', rows);

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
    const repo = await repoWith('courses-limit.json', rows);

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

describe('CourseJsonRepo — битая запись', () => {
  test('невалидная запись — ValiError, файл не изменён', async () => {
    const path = filePath('courses-broken.json');
    const text = JSON.stringify([
      makeState(),
      { uuid: 'not-a-uuid', status: 'nonsense' },
    ]);
    await Bun.write(path, text);
    const repo = new CourseJsonRepo(path);

    await expect(repo.findAll({})).rejects.toBeInstanceOf(ValiError);
    await expect(
      repo.save(CourseAr.restore(makeState())),
    ).rejects.toBeInstanceOf(ValiError);

    expect(await Bun.file(path).text()).toBe(text);
  });

  test('невалидный JSON — исключение, файл не изменён', async () => {
    const path = filePath('courses-bad-json.json');
    const text = '[{"uuid": ';
    await Bun.write(path, text);
    const repo = new CourseJsonRepo(path);

    await expect(repo.findById(crypto.randomUUID())).rejects.toThrow();
    await expect(repo.save(CourseAr.restore(makeState()))).rejects.toThrow();

    expect(await Bun.file(path).text()).toBe(text);
  });
});
