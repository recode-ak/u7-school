import { describe, expect, test } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { TempDir } from 'dmg-core/testing';
import { readSubagentModel } from './subagent-config';

async function withPiDir(fn: (dir: string) => Promise<void>): Promise<void> {
  using tmp = TempDir.create('subagent-config-');
  const dir = tmp.path;
  await fn(dir);
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
