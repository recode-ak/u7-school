import { afterEach, beforeEach, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXIT_CONFIG } from './example-cli';

// Точка входа целиком: окружение процесса → приложение → код выхода.

const MAIN = join(import.meta.dir, 'main.ts');
const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'example-main-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function main(...args: string[]) {
  return run({ EXAMPLE_DATA_DIR: dir, EXAMPLE_USERS: OWNER }, args);
}

function run(vars: Record<string, string>, args: readonly string[]) {
  const proc = Bun.spawnSync(['bun', MAIN, ...args], {
    env: { ...process.env, ...vars },
  });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

it('EXAMPLE_USERS и EXAMPLE_DATA_DIR доходят до приложения: задача создана и видна', () => {
  expect(main('create-task', '--title', 'Хлеб', '--user', OWNER).code).toBe(0);

  const listed = main('list-tasks', '--user', OWNER);
  expect(listed.code).toBe(0);
  expect(JSON.parse(listed.stdout)).toMatchObject({
    ok: true,
    value: [{ title: 'Хлеб' }],
  });
});

it('ошибка ввода — код 1 у процесса', () => {
  expect(main('drop-all')).toMatchObject({ code: 1, stdout: '' });
});

it('ошибка окружения — код EXIT_CONFIG, сообщение без стека в stderr', () => {
  const res = run({ EXAMPLE_DATA_DIR: dir, EXAMPLE_USERS: 'bob' }, [
    'list-tasks',
  ]);
  expect(EXIT_CONFIG).toBe(3);
  expect(res.code).toBe(EXIT_CONFIG);
  expect(res.stdout).toBe('');
  expect(res.stderr.trim()).toBe('EXAMPLE_USERS: «bob» — не uuid');
});
