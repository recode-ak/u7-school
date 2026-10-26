import { describe, expect, test } from 'bun:test';
import { TaskAr, TaskArDef } from '#core/testing/example/todo/index';
import { expectOk } from '#core/testing/index';
import { assertVersion, VersionConflict } from './repository';

const A = 'a1b2c3d4-0000-4000-8000-00000000000a';
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const AT = Date.UTC(2026, 9, 20);

const created = () =>
  expectOk(TaskAr.create({ uuid: A, ownerId: OWNER, title: 'Задача' }, AT));

const restored = (version: number) =>
  TaskAr.restore({ ...created().snapshot(), version });

const check = (ar: TaskAr, stored: { version?: number } | undefined) => () =>
  assertVersion(TaskArDef, ar, stored);

describe('assertVersion', () => {
  test('новый агрегат, записи нет — ок', () => {
    expect(check(created(), undefined)).not.toThrow();
  });

  test('новый агрегат, запись с тем же uuid есть — VersionConflict', () => {
    expect(check(created(), { version: 0 })).toThrow(VersionConflict);
  });

  test('новый агрегат, legacy-запись без version — VersionConflict', () => {
    expect(check(created(), {})).toThrow(VersionConflict);
  });

  test('восстановленный, записи нет — VersionConflict', () => {
    expect(check(restored(2), undefined)).toThrow(VersionConflict);
  });

  test('восстановленный, версия совпала — ок', () => {
    expect(check(restored(2), { version: 2 })).not.toThrow();
  });

  test('восстановленный, версия иная — VersionConflict', () => {
    expect(check(restored(2), { version: 3 })).toThrow(VersionConflict);
  });

  test('восстановленный legacy (0), запись без version — ок', () => {
    expect(check(restored(0), {})).not.toThrow();
  });

  test('новый после отметки записи — сверяется как восстановленный', () => {
    const ar = created();
    ar.markStored();
    expect(check(ar, { version: 0 })).not.toThrow();
    expect(check(ar, undefined)).toThrow(VersionConflict);
  });
});
