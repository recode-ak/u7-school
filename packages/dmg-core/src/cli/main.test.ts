import { afterEach, beforeEach, expect, test } from 'bun:test';
import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAIN = join(import.meta.dir, 'main.ts');
let root: string;

function run(...args: string[]) {
  const proc = Bun.spawnSync(['bun', MAIN, ...args], { cwd: root });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dmg-core-main-'));
});

afterEach(() => rm(root, { recursive: true, force: true }));

test('init → sync --check зелёный; правка копии — код 1 и подсказка', async () => {
  expect(run('init').code).toBe(0);
  expect(run('sync', '--check')).toMatchObject({ code: 0, stderr: '' });

  await appendFile(join(root, '.claude/agents/reviewer.md'), 'правка\n');
  const check = run('sync', '--check');
  expect(check.code).toBe(1);
  expect(check.stderr).toContain('.claude/agents/reviewer.md');
  expect(check.stderr).toContain('Обнови копии: dmg-core sync');
  expect(run('sync').code).toBe(0);
  expect(run('sync', '--check').code).toBe(0);
});

test('неизвестная команда — код 2 и справка', () => {
  const result = run('deploy');
  expect(result.code).toBe(2);
  expect(result.stderr).toContain('dmg-core init | sync [--check] | gen');
});

test('gen: план по умолчанию — dry-run, пути от корня проекта', () => {
  const result = run('gen', 'module', 'todo');
  expect(result.code).toBe(0);
  expect(result.stdout).toContain('Будет создан: src/app/todo/todo.module.ts');
  expect(result.stdout).toContain('Это dry-run.');
});

test('gen: ошибка ввода — код 1', () => {
  const result = run('gen', 'widget', 'todo');
  expect(result.code).toBe(1);
  expect(result.stderr).toContain('Неизвестный вид «widget»');
});
