import { describe, expect, test } from 'bun:test';
import { DATA_FILES, DATA_MODULES } from './data-layout';

const MODULES = DATA_MODULES;

describe('DATA_FILES', () => {
  test('покрыты все агрегаты всех модулей, кроме агрегатов без репозитория', () => {
    const names = MODULES.flatMap((m) => m.aggregates.map((a) => a.name));
    const missing = names.filter((n) => !(n in DATA_FILES));
    expect(missing).toEqual([]);
  });

  test('нет лишних ключей: каждый ключ — имя агрегата какого-то модуля', () => {
    const names = new Set<string>(
      MODULES.flatMap((m) => m.aggregates.map((a) => a.name)),
    );
    expect(Object.keys(DATA_FILES).filter((k) => !names.has(k))).toEqual([]);
  });
});
