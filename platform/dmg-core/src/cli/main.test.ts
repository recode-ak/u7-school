import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { appendFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

describe('init --profile', () => {
  async function snapshot(): Promise<string[]> {
    const paths: string[] = [];
    for await (const path of new Bun.Glob('**/*').scan({
      cwd: root,
      dot: true,
    }))
      paths.push(`${path}:${await readFile(join(root, path), 'utf8')}`);
    return paths.sort();
  }

  for (const [profile, entry] of [
    ['single', 'src/runner/main.ts'],
    ['monorepo', 'runners/cli/src/main.ts'],
  ] as const) {
    test(`${profile}: каркас записан, sync выполнен, подсказка`, async () => {
      const result = run('init', '--profile', profile, '--name', 'acme');
      expect(result).toMatchObject({ code: 0, stderr: '' });
      expect(result.stdout).toStartWith(`Каркас ${profile}: acme\n`);
      expect(result.stdout).toContain(`Создан: ${entry}`);
      expect(result.stdout).toContain('bun install');
      expect(result.stdout).toContain('bun run check');
      expect(existsSync(join(root, entry))).toBe(true);
      expect(
        existsSync(join(root, '.claude/skills/dmg-architecture/SKILL.md')),
      ).toBe(true);
      expect(run('sync', '--check')).toMatchObject({ code: 0, stderr: '' });
    });
  }

  test('--dry-run — план в stdout, ничего не записано', async () => {
    const result = run(
      'init',
      '--profile',
      'single',
      '--name',
      'acme',
      '--dry-run',
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toStartWith('Каркас single: acme\n');
    expect(result.stdout).toContain('Будет создан: dmg-core.json');
    expect(await snapshot()).toEqual([]);
  });

  test('коллизия — код 1, каталог как до запуска', async () => {
    await writeFile(join(root, 'dmg-core.json'), '{}\n');
    const before = await snapshot();
    const result = run('init', '--profile', 'single', '--name', 'acme');
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('dmg-core.json');
    expect(await snapshot()).toEqual(before);
  });

  test('ошибка ввода — код 1, stderr, ничего не записано', async () => {
    for (const args of [
      ['--profile', 'web'],
      ['--profile'],
      ['--name', 'acme'],
      ['--profile', 'single', 'extra'],
    ]) {
      const result = run('init', ...args);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Ошибка:');
      expect(await snapshot()).toEqual([]);
    }
  });

  test('package.json после bun add — слит с каркасом', async () => {
    await writeFile(
      join(root, 'package.json'),
      '{\n  "dependencies": {\n    "dmg-core": "^0.1.0"\n  }\n}\n',
    );
    const result = run('init', '--profile', 'single', '--name', 'acme');
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Дополнен: package.json');
    const manifest = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    );
    expect(manifest.name).toBe('acme');
    expect(manifest.dependencies['dmg-core']).toBe('^0.1.0');
    expect(manifest.dependencies.valibot).toBeDefined();
  });
});
