import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSubagentModel } from './subagent-config';

async function withPiDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'subagent-config-'));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

describe('readSubagentModel', () => {
  test('модель из subagent.json', () =>
    withPiDir(async (dir) => {
      await writeFile(
        join(dir, 'subagent.json'),
        '{ "model": "deepseek/deepseek-flash" }',
      );
      expect(readSubagentModel(dir)).toBe('deepseek/deepseek-flash');
    }));

  test('нет файла или поля — undefined (модель сессии)', () =>
    withPiDir(async (dir) => {
      expect(readSubagentModel(dir)).toBeUndefined();
      await writeFile(join(dir, 'subagent.json'), '{}');
      expect(readSubagentModel(dir)).toBeUndefined();
    }));

  test('битый файл — ошибка с путём', () =>
    withPiDir(async (dir) => {
      await writeFile(join(dir, 'subagent.json'), '{ "model": 42 }');
      expect(() => readSubagentModel(dir)).toThrow('subagent.json');
      await writeFile(join(dir, 'subagent.json'), '{ model');
      expect(() => readSubagentModel(dir)).toThrow('subagent.json');
    }));
});
