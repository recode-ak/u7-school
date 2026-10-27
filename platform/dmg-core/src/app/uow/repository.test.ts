import { describe, expect, test } from 'bun:test';
import { TaskAr, TaskArDef } from '#core/testing/example/todo/index';
import { expectOk } from '#core/testing/index';
import {
  type StoredRecord,
  VersionConflict,
  VersionedRepository,
} from './repository';

const A = 'a1b2c3d4-0000-4000-8000-00000000000a';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const AT = Date.UTC(2026, 9, 20);

const created = () =>
  expectOk(TaskAr.create({ uuid: A, ownerId: OWNER, title: 'Задача' }, AT));

const restored = (version: number) =>
  TaskAr.restore({ ...created().snapshot(), version });

/** Хранилище с одной записью `stored`; записанное — в `written`. */
class OneRowRepo extends VersionedRepository<TaskAr> {
  readonly aggregate = TaskArDef;
  readonly written: TaskAr[] = [];

  constructor(private readonly row: StoredRecord | undefined) {
    super();
  }

  protected async stored(): Promise<StoredRecord | undefined> {
    return this.row;
  }

  protected async write(ar: TaskAr): Promise<void> {
    this.written.push(ar);
  }
}

const save = (ar: TaskAr, stored: StoredRecord | undefined) =>
  new OneRowRepo(stored).save(ar);

describe('VersionedRepository', () => {
  test('новый агрегат, записи нет — ок', async () => {
    await expect(save(created(), undefined)).resolves.toBeUndefined();
  });

  test('новый агрегат, запись с тем же uuid есть — VersionConflict', async () => {
    await expect(save(created(), { version: 0 })).rejects.toThrow(
      VersionConflict,
    );
  });

  test('новый агрегат, legacy-запись без version — VersionConflict', async () => {
    await expect(save(created(), {})).rejects.toThrow(VersionConflict);
  });

  test('восстановленный, записи нет — VersionConflict', async () => {
    await expect(save(restored(2), undefined)).rejects.toThrow(VersionConflict);
  });

  test('восстановленный, версия совпала — ок', async () => {
    await expect(save(restored(2), { version: 2 })).resolves.toBeUndefined();
  });

  test('восстановленный, версия иная — VersionConflict', async () => {
    await expect(save(restored(2), { version: 3 })).rejects.toThrow(
      VersionConflict,
    );
  });

  test('восстановленный legacy (0), запись без version — ок', async () => {
    await expect(save(restored(0), {})).resolves.toBeUndefined();
  });

  test('новый после отметки записи — сверяется как восстановленный', async () => {
    const ar = created();
    ar.markStored();
    await expect(save(ar, { version: 0 })).resolves.toBeUndefined();
    await expect(save(ar, undefined)).rejects.toThrow(VersionConflict);
  });

  test('сверка прошла — агрегат записан; конфликт — не записан', async () => {
    const ok = new OneRowRepo(undefined);
    const ar = created();
    await ok.save(ar);
    expect(ok.written).toEqual([ar]);
    const conflict = new OneRowRepo({ version: 0 });
    await expect(conflict.save(created())).rejects.toThrow(VersionConflict);
    expect(conflict.written).toEqual([]);
  });

  test('save по одному: чтение → сверка → запись не перемежаются', async () => {
    const log: string[] = [];
    const rows = new Map<string, StoredRecord>();
    const repo = new (class extends VersionedRepository<TaskAr> {
      readonly aggregate = TaskArDef;
      protected async stored(uuid: string) {
        log.push('read');
        await Bun.sleep(1);
        return rows.get(uuid);
      }
      protected async write(ar: TaskAr) {
        log.push('write');
        rows.set(ar.uuid, ar.snapshot());
      }
    })();
    const results = await Promise.allSettled([
      repo.save(created()),
      repo.save(created()),
    ]);
    expect(log).toEqual(['read', 'write', 'read']);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
  });
});
