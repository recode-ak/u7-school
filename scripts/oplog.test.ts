import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// `bun run oplog` (F-111, Ф4): запуск CLI пакета над `${DB_DIR}/oplog`.
// DB_DIR всегда временный — живой `data/` скрипт здесь не читает.

const SCRIPT = join(import.meta.dir, 'oplog.ts');

const record = (op: string, correlationId: string, at: number) => ({
  at,
  module: 'wish',
  op,
  kind: 'useCase',
  caller: { kind: 'user', subjectId: '10000000-0000-4000-8000-000000000001' },
  trace: {
    cause: { kind: 'request', requestId: correlationId },
    correlationId,
  },
  input: {},
  result: { ok: true, output: {} },
  events: [],
  writes: [],
  durationMs: 1,
});

let dbDir: string;

beforeAll(async () => {
  dbDir = await mkdtemp(join(tmpdir(), 'u7-oplog-script-'));
  await mkdir(join(dbDir, 'oplog'), { recursive: true });
  const day = Date.UTC(2026, 10, 14, 10);
  await Bun.write(
    join(dbDir, 'oplog', '2026-11-14.jsonl'),
    `${[
      record('createCourseWish', 'req-alpha', day),
      record('cancelWish', 'req-beta', day + 1000),
    ]
      .map((r) => JSON.stringify(r))
      .join('\n')}\n`,
  );
});

afterAll(() => rm(dbDir, { recursive: true, force: true }));

function run(args: string[], env: Record<string, string> = { DB_DIR: dbDir }) {
  const proc = Bun.spawnSync(['bun', 'run', SCRIPT, ...args], {
    env: { ...process.env, ...env },
  });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

describe('scripts/oplog.ts', () => {
  test('--request <id>: лента цепочки из DB_DIR/oplog — только нужная операция', () => {
    const res = run(['--request', 'req-alpha']);

    expect(res.code).toBe(0);
    expect(res.stdout).toContain('wish.createCourseWish');
    expect(res.stdout).not.toContain('wish.cancelWish');
  });

  test('--json: исходные записи построчно', () => {
    const res = run(['--request', 'req-beta', '--json']);

    expect(res.code).toBe(0);
    const rows = res.stdout
      .trimEnd()
      .split('\n')
      .map((l) => JSON.parse(l) as { op: string });
    expect(rows.map((r) => r.op)).toEqual(['cancelWish']);
  });

  test('без аргументов — подсказка (код 2), а не вся лента', () => {
    const res = run([]);

    expect(res.code).toBe(2);
    expect(res.stdout).not.toContain('wish.createCourseWish');
    expect(`${res.stdout}${res.stderr}`).toContain('--request');
  });

  test('нет каталога лога — код 2 и сообщение', () => {
    const res = run(['--request', 'x'], { DB_DIR: join(dbDir, 'нет-такого') });

    expect(res.code).toBe(2);
    expect(`${res.stdout}${res.stderr}`).toContain('нет каталога');
  });
});

describe('package.json', () => {
  test('скрипт oplog зарегистрирован', async () => {
    const pkg = (await Bun.file(
      join(import.meta.dir, '../package.json'),
    ).json()) as { scripts: Record<string, string> };

    expect(pkg.scripts.oplog).toBe('bun run scripts/oplog.ts');
  });
});
