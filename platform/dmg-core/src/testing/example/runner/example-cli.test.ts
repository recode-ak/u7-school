import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MemoryLogger } from '#core/testing/index';
import { ExampleApp } from '../app/example-app';
import { ExampleCli } from './example-cli';
import type { CliIo } from './example-cli.types';

// CLI-раннер учебного приложения: argv → резолвер Caller → UC todo →
// Result в stdout. Вывод — в буфер `io`, данные — во временном каталоге.

const OWNER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const T0 = Date.UTC(2026, 9, 1);
const CREATE_BREAD = ['create-task', '--title', 'Хлеб'];
const TASK_ID = expect.any(String);

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'example-cli-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Буфер вывода: строки stdout и stderr. */
class BufferIo implements CliIo {
  readonly stdout: string[] = [];
  readonly stderr: string[] = [];
  out(line: string): void {
    this.stdout.push(line);
  }
  err(line: string): void {
    this.stderr.push(line);
  }
}

function makeCli() {
  const app = new ExampleApp(
    { mode: 'test', dataDir: dir, users: [OWNER] },
    { logger: new MemoryLogger(), clock: () => T0 },
  );
  return new ExampleCli(app);
}

async function run(cli: ExampleCli, ...argv: string[]) {
  const io = new BufferIo();
  const code = await cli.run(argv, io);
  return { code, io, json: () => JSON.parse(io.stdout.join('\n')) };
}

function oplog(): { op: string; trace: { cause: { requestId: string } } }[] {
  const file = join(dir, 'oplog', '2026-10-01.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
}

describe('ExampleCli: команды todo', () => {
  it('create-task от пользователя — код 0, taskId; list-tasks её показывает', async () => {
    const cli = makeCli();

    const created = await run(cli, ...CREATE_BREAD, '--user', OWNER);
    const listed = await run(cli, 'list-tasks', '--user', OWNER);

    expect([created.code, listed.code]).toEqual([0, 0]);
    expect(created.json()).toEqual({ ok: true, value: { taskId: TASK_ID } });
    const { taskId } = created.json().value;
    expect(listed.json()).toEqual({
      ok: true,
      value: [{ uuid: taskId, title: 'Хлеб', status: 'open' }],
    });
  });

  it('гость (без --user) — Err в stdout, код 2', async () => {
    const res = await run(makeCli(), ...CREATE_BREAD);

    expect(res.code).toBe(2);
    expect(res.json()).toMatchObject({
      ok: false,
      error: { code: 'UNAUTHORIZED' },
    });
    expect(res.io.stderr).toEqual([]);
  });

  it('канал cli и новый requestId на каждый запуск', async () => {
    const cli = makeCli();
    await run(cli, 'list-tasks', '--user', OWNER);
    await run(cli, 'list-tasks', '--user', OWNER);

    const lists = oplog().filter((r) => r.op === 'listTasks');
    expect(lists).toHaveLength(2);
    expect(lists[0]?.trace).toMatchObject({ channel: { name: 'cli' } });
    expect(lists[0]?.trace.cause.requestId).not.toBe(
      lists[1]?.trace.cause.requestId,
    );
  });
});

describe('ExampleCli: ошибка ввода — код 1, stderr, UC не вызван', () => {
  const cases: [string, string[]][] = [
    ['нет команды', []],
    ['неизвестная команда', ['drop-all', '--user', OWNER]],
    ['нет --title', ['create-task', '--user', OWNER]],
    ['у опции нет значения', ['create-task', '--user', OWNER, '--title']],
    ['неизвестная опция', ['list-tasks', '--user', OWNER, '--force', 'да']],
    ['--user не uuid', ['list-tasks', '--user', 'not-a-uuid']],
    ['повтор опции', ['list-tasks', '--user', OWNER, '--user', OWNER]],
  ];

  for (const [name, argv] of cases) {
    it(name, async () => {
      const res = await run(makeCli(), ...argv);

      expect(res.code).toBe(1);
      expect(res.io.stdout).toEqual([]);
      expect(res.io.stderr.join('\n')).toContain('Использование:');
      expect(oplog()).toEqual([]);
    });
  }
});
