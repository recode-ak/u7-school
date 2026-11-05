import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { StepAr, type StepState } from '@u7-scl/domain/course';
import { VersionConflict } from 'dmg-core/app';
import { ValiError } from 'valibot';
import { StepJsonRepo } from './step.json-repo';

// Репозиторий шагов (`<dbDir>/courses/steps.json`, D-36). Перенос
// `infra/db/step-json-repo.test.ts` (save/getByUuid, getByIds) + контракт
// новой записи: legacy-запись (ISO без секунд → число, version 0, нет
// `updatedAt` → `createdAt`), три вида шага (`kind: file` в данных нет —
// только в схеме), round-trip, устаревшая версия, битая запись — исключение,
// файл цел. Каталог — mkdtemp: до Ф5 писать в `data/` нельзя (Т11).

const tmpDir = mkdtempSync(join(tmpdir(), 'step-json-repo-test-'));
afterAll(() => rmSync(tmpDir, { recursive: true, force: true }));

const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const FILE = '99999999-9999-4999-8999-999999999999';
const T0 = Date.UTC(2026, 6, 8, 18, 35);

const filePath = (name: string) => join(tmpDir, name);

const makeState = (
  extra: Partial<Extract<StepState, { kind: 'text' }>> = {},
): StepState => ({
  uuid: crypto.randomUUID(),
  moduleId: MODULE,
  kind: 'text',
  description: 'Тестовый шаг',
  content: 'Текст',
  status: 'draft',
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

/** Записывает строки «как есть» (не через агрегат). */
async function repoWith(name: string, rows: unknown[]): Promise<StepJsonRepo> {
  const path = filePath(name);
  await Bun.write(path, JSON.stringify(rows));
  return new StepJsonRepo(path);
}

describe('StepJsonRepo — save и findById', () => {
  test('round-trip: сохранённый шаг читается тем же состоянием', async () => {
    const state = makeState();
    const repo = await repoWith('steps-roundtrip.json', [state]);

    const loaded = await repo.findById(state.uuid);
    if (!loaded) throw new Error('шаг не найден');
    await repo.save(loaded);
    const found = await repo.findById(state.uuid);

    expect(found?.snapshot()).toEqual(loaded.snapshot());
    expect(found?.snapshot()).toMatchObject({
      uuid: state.uuid,
      kind: 'text',
      description: 'Тестовый шаг',
      content: 'Текст',
    });
  });

  test('findById несуществующего — undefined, файл не создаётся', async () => {
    const path = filePath('steps-missing.json');
    const repo = new StepJsonRepo(path);

    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
    expect(await Bun.file(path).exists()).toBe(false);
  });

  test('findById в файле с другими записями — undefined', async () => {
    const repo = await repoWith('steps-other.json', [makeState()]);

    expect(await repo.findById(crypto.randomUUID())).toBeUndefined();
  });

  test('save перезаписывает существующий шаг, соседние записи целы', async () => {
    const a = makeState();
    const b = makeState({ description: 'Соседний' });
    const path = filePath('steps-update.json');
    const repo = await repoWith('steps-update.json', [a, b]);

    await repo.save(StepAr.restore({ ...a, description: 'Обновлённый' }));

    const rows = JSON.parse(await Bun.file(path).text()) as StepState[];
    expect(rows).toHaveLength(2);
    expect((await repo.findById(a.uuid))?.snapshot().description).toBe(
      'Обновлённый',
    );
    expect((await repo.findById(b.uuid))?.snapshot().description).toBe(
      'Соседний',
    );
  });

  test('save пишет даты числами', async () => {
    const state = makeState();
    const path = filePath('steps-numbers.json');
    const repo = await repoWith('steps-numbers.json', [state]);
    const loaded = await repo.findById(state.uuid);
    if (!loaded) throw new Error('шаг не найден');

    await repo.save(loaded);

    const [row] = JSON.parse(await Bun.file(path).text()) as StepState[];
    expect(row?.createdAt).toBe(T0);
    expect(row?.updatedAt).toBe(T0);
  });
});

describe('StepJsonRepo — виды шага', () => {
  test('code без content (так в данных у 44 шагов): читается и сохраняется', async () => {
    const id = crypto.randomUUID();
    const state: StepState = {
      uuid: id,
      moduleId: MODULE,
      kind: 'code',
      description: 'Код',
      code: 'console.log(1)',
      language: 'js',
      status: 'published',
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    };
    const repo = await repoWith('steps-code.json', [state]);

    const loaded = await repo.findById(id);
    if (!loaded) throw new Error('шаг не найден');
    await repo.save(loaded);

    expect((await repo.findById(id))?.snapshot()).toEqual(state);
  });

  test('file с описанием и без: round-trip', async () => {
    const withDescription = crypto.randomUUID();
    const without = crypto.randomUUID();
    const file = {
      uuid: FILE,
      name: 'doc.pdf',
      mimeType: 'application/pdf',
      size: 2048,
    };
    const state = (uuid: string, extra: Record<string, unknown>): StepState =>
      ({
        uuid,
        moduleId: MODULE,
        kind: 'file',
        description: 'Файл',
        file: { ...file, ...extra },
        status: 'published',
        createdAt: T0,
        updatedAt: T0,
        version: 0,
      }) as StepState;
    const rows = [
      state(withDescription, { description: 'Описание файла' }),
      state(without, {}),
    ];
    const repo = await repoWith('steps-file.json', rows);

    const loaded = await repo.findById(withDescription);
    if (!loaded) throw new Error('шаг не найден');
    await repo.save(loaded);

    expect((await repo.findById(withDescription))?.snapshot()).toEqual(rows[0]);
    expect((await repo.findById(without))?.snapshot()).toEqual(rows[1]);
  });
});

describe('StepJsonRepo — findByIds', () => {
  const uuids = (steps: StepAr[]) => steps.map((s) => s.uuid);

  test('возвращает шаги по списку ID (перенос getByIds)', async () => {
    const [a, b] = [crypto.randomUUID(), crypto.randomUUID()];
    const repo = await repoWith('steps-ids.json', [
      makeState({ uuid: a }),
      makeState({ uuid: b }),
    ]);

    expect(uuids(await repo.findByIds([a]))).toEqual([a]);
  });

  test('порядок — как в файле, а не как в запросе', async () => {
    const [a, b, c] = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
    const repo = await repoWith('steps-ids-order.json', [
      makeState({ uuid: a }),
      makeState({ uuid: b }),
      makeState({ uuid: c }),
    ]);

    expect(uuids(await repo.findByIds([c, a]))).toEqual([a, c]);
  });

  test('отсутствующие ID пропускаются', async () => {
    const a = crypto.randomUUID();
    const repo = await repoWith('steps-ids-missing.json', [
      makeState({ uuid: a }),
    ]);

    expect(uuids(await repo.findByIds([crypto.randomUUID(), a]))).toEqual([a]);
  });

  test('повтор ID в запросе не дублирует шаг', async () => {
    const a = crypto.randomUUID();
    const repo = await repoWith('steps-ids-dup.json', [makeState({ uuid: a })]);

    expect(uuids(await repo.findByIds([a, a]))).toEqual([a]);
  });

  test('пустой список — []; нет файла — []', async () => {
    const repo = await repoWith('steps-ids-empty.json', [makeState()]);

    expect(await repo.findByIds([])).toEqual([]);
    expect(
      await new StepJsonRepo(filePath('steps-ids-nofile.json')).findByIds([
        crypto.randomUUID(),
      ]),
    ).toEqual([]);
  });
});

describe('StepJsonRepo — версия (D-36)', () => {
  test('запись по устаревшей версии — VersionConflict, файл не изменён', async () => {
    const state = makeState();
    const path = filePath('steps-stale.json');
    const repo = await repoWith('steps-stale.json', [{ ...state, version: 5 }]);
    const before = await Bun.file(path).text();

    await expect(repo.save(StepAr.restore(state))).rejects.toBeInstanceOf(
      VersionConflict,
    );

    expect(await Bun.file(path).text()).toBe(before);
  });
});

describe('StepJsonRepo — legacy-записи', () => {
  const legacy = (uuid: string, extra: Record<string, unknown> = {}) => ({
    uuid,
    moduleId: MODULE,
    kind: 'text',
    description: 'Шаг',
    content: 'Текст',
    status: 'published',
    createdAt: '2026-07-08T18:35',
    updatedAt: '2026-07-08T18:35',
    ...extra,
  });

  test('ISO без секунд → число (UTC), version = 0', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('steps-legacy.json', [legacy(id)]);

    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      uuid: id,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
      status: 'published',
    });
  });

  test('запись без updatedAt (так в данных у 457 шагов): updatedAt = createdAt', async () => {
    const id = crypto.randomUUID();
    const { updatedAt: _u, ...noUpdated } = legacy(id);
    const repo = await repoWith('steps-legacy-no-updated.json', [noUpdated]);

    expect((await repo.findById(id))?.snapshot()).toMatchObject({
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  test('запись с числовыми датами и version читается как есть', async () => {
    const id = crypto.randomUUID();
    const repo = await repoWith('steps-numeric.json', [
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
    const path = filePath('steps-legacy-save.json');
    const repo = await repoWith('steps-legacy-save.json', [
      legacy(id),
      legacy(neighbour),
    ]);

    const loaded = await repo.findById(id);
    if (!loaded) throw new Error('шаг не найден');
    await repo.save(loaded);

    const rows = JSON.parse(await Bun.file(path).text()) as StepState[];
    expect(rows.find((r) => r.uuid === id)).toMatchObject({
      createdAt: T0,
      version: 0,
    });
    expect((await repo.findById(neighbour))?.snapshot().createdAt).toBe(T0);
  });
});

describe('StepJsonRepo — битая запись', () => {
  test('невалидная запись — ValiError на чтении и на save, файл не изменён', async () => {
    const path = filePath('steps-broken.json');
    const text = JSON.stringify([
      makeState(),
      { uuid: 'not-a-uuid', kind: 'text', status: 'nonsense' },
    ]);
    await Bun.write(path, text);
    const repo = new StepJsonRepo(path);

    await expect(repo.findByIds([crypto.randomUUID()])).rejects.toBeInstanceOf(
      ValiError,
    );
    await expect(repo.save(StepAr.restore(makeState()))).rejects.toBeInstanceOf(
      ValiError,
    );

    expect(await Bun.file(path).text()).toBe(text);
  });

  test('неизвестный kind — ValiError', async () => {
    const repo = await repoWith('steps-bad-kind.json', [
      { ...makeState(), kind: 'video' },
    ]);

    await expect(repo.findById(crypto.randomUUID())).rejects.toBeInstanceOf(
      ValiError,
    );
  });

  test('code без code — ValiError', async () => {
    const repo = await repoWith('steps-no-code.json', [
      { ...makeState(), kind: 'code' },
    ]);

    await expect(repo.findById(crypto.randomUUID())).rejects.toBeInstanceOf(
      ValiError,
    );
  });

  test('невалидный JSON — исключение, файл не изменён', async () => {
    const path = filePath('steps-bad-json.json');
    const text = '[{"uuid": ';
    await Bun.write(path, text);
    const repo = new StepJsonRepo(path);

    await expect(repo.findById(crypto.randomUUID())).rejects.toThrow();
    await expect(repo.save(StepAr.restore(makeState()))).rejects.toThrow();

    expect(await Bun.file(path).text()).toBe(text);
  });

  test('корень файла не массив — ValiError, файл не изменён', async () => {
    const path = filePath('steps-not-array.json');
    const text = JSON.stringify({ steps: [] });
    await Bun.write(path, text);
    const repo = new StepJsonRepo(path);

    await expect(repo.findById(crypto.randomUUID())).rejects.toBeInstanceOf(
      ValiError,
    );
    expect(await Bun.file(path).text()).toBe(text);
  });
});
