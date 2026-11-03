import { describe, expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

/** Номера решений берутся из общего счётчика проекта и пакета (шапка decisions.md). */
const PROJECT = 'conductor/architecture/decisions.md';
const PACKAGE = 'node_modules/dmg-core/docs/decisions.md';

async function numbersOf(path: string): Promise<string[]> {
  const text = await readFile(path, 'utf8');
  return [...text.matchAll(/^\*\*(D-\d+)\./gm)].map((m) => m[1] as string);
}

describe('decisions: общая нумерация проекта и пакета', () => {
  it('номер решения занят только в одном реестре', async () => {
    const project = await numbersOf(PROJECT);
    const pkg = new Set(await numbersOf(PACKAGE));
    expect(project.filter((n) => pkg.has(n))).toEqual([]);
  });
});
