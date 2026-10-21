import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import { JsonlOperationLog, type TruncatedValue } from './jsonl-operation-log';
import type { OperationRecord } from './operation-record';

const DAY_1 = Date.UTC(2026, 9, 21, 23, 59);
const DAY_2 = Date.UTC(2026, 9, 22, 0, 1);

const record = (patch: Partial<OperationRecord> = {}): OperationRecord => ({
  at: DAY_1,
  module: 'todo',
  op: 'completeTask',
  kind: 'useCase',
  caller: { kind: 'user', subjectId: 'u-1' },
  trace: { cause: { kind: 'request', requestId: 'r-1' }, correlationId: 'r-1' },
  input: { taskId: 't-1' },
  result: { ok: true, output: {} },
  events: [{ name: 'todo.task.completed', eventId: 'e-1' }],
  durationMs: 3,
  ...patch,
});

let root: string;
let dir: string;

/** Записи файла дня — по строке JSON на запись. */
function lines(day: string): unknown[] {
  return readFileSync(join(dir, `${day}.jsonl`), 'utf8')
    .trimEnd()
    .split('\n')
    .map((line) => JSON.parse(line));
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'oplog-'));
  dir = join(root, 'oplog');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('JsonlOperationLog', () => {
  test('каталог создаётся только при первой записи', async () => {
    const log = new JsonlOperationLog(dir);
    expect(existsSync(dir)).toBe(false);
    await log.append(record());
    expect(existsSync(dir)).toBe(true);
  });

  test('запись — строка JSON в файле своего дня (UTC)', async () => {
    const log = new JsonlOperationLog(dir);
    await log.append(record({ at: DAY_1, op: 'a' }));
    await log.append(record({ at: DAY_1, op: 'b' }));
    await log.append(record({ at: DAY_2, op: 'c' }));
    expect(lines('2026-10-21').map((r) => (r as OperationRecord).op)).toEqual([
      'a',
      'b',
    ]);
    expect(lines('2026-10-22')).toEqual([record({ at: DAY_2, op: 'c' })]);
  });

  test('параллельные записи не перемешиваются', async () => {
    const log = new JsonlOperationLog(dir);
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        log.append(record({ op: `op${i}` })),
      ),
    );
    expect(lines('2026-10-21')).toHaveLength(20);
  });

  test('отказ пишется целиком', async () => {
    const log = new JsonlOperationLog(dir);
    const error = CoreErrors.UNAUTHORIZED.make({ callerKind: 'guest' });
    await log.append(record({ result: { ok: false, error } }));
    expect(lines('2026-10-21')).toEqual([
      record({ result: { ok: false, error } }),
    ]);
  });

  test('большой вход обрезается по порогу с пометкой', async () => {
    const log = new JsonlOperationLog(dir, { maxBytes: 100 });
    const input = { text: 'я'.repeat(500) };
    await log.append(record({ input }));
    const [written] = lines('2026-10-21') as OperationRecord[];
    const size = new TextEncoder().encode(JSON.stringify(input)).length;
    const truncated = written?.input as TruncatedValue;
    expect(truncated).toEqual({
      truncated: true,
      bytes: size,
      head: expect.any(String),
    });
    expect(new TextEncoder().encode(truncated.head).length).toBeLessThanOrEqual(
      100,
    );
    expect(JSON.stringify(input).startsWith(truncated.head)).toBe(true);
  });

  test('большой выход обрезается, малый вход — как есть', async () => {
    const log = new JsonlOperationLog(dir, { maxBytes: 100 });
    const output = { items: Array.from({ length: 50 }, (_, i) => i) };
    await log.append(record({ result: { ok: true, output } }));
    const [written] = lines('2026-10-21') as OperationRecord[];
    expect(written?.input).toEqual({ taskId: 't-1' });
    expect(written?.result).toEqual({
      ok: true,
      output: {
        truncated: true,
        bytes: expect.any(Number),
        head: expect.any(String),
      },
    });
  });

  test('порог по умолчанию — 8 КБ', async () => {
    const log = new JsonlOperationLog(dir);
    await log.append(record({ input: { text: 'a'.repeat(8000) } }));
    await log.append(record({ input: { text: 'a'.repeat(9000) } }));
    const [small, big] = lines('2026-10-21') as OperationRecord[];
    expect(small?.input).toEqual({ text: 'a'.repeat(8000) });
    expect(big?.input).toMatchObject({ truncated: true });
  });
});
