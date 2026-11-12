import { afterAll, describe, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { type Logger, LogLevel } from '@u7-scl/core/shared';
import { JobRunJsonRepo } from './job-run-json-repo';

/** Логгер-заглушка: помнит предупреждения (`источник: сообщение`). */
function recordingLogger(): Logger & { readonly warnings: string[] } {
  const warnings: string[] = [];
  const noop = () => {};
  return {
    warnings,
    debug: noop,
    info: noop,
    warn: (source: string, message: string) => {
      warnings.push(`${source}: ${message}`);
    },
    error: noop,
    setLogLevel: noop,
    getLogLevel: () => LogLevel.INFO,
    setSourceLevel: noop,
  };
}

describe('JobRunJsonRepo', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'job-run-store-'));
  const filePath = join(tmpDir, 'sub', 'last-runs.json');

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test('get без записи — undefined', () => {
    const logger = recordingLogger();
    const store = new JobRunJsonRepo(filePath, logger);
    expect(store.getLastRunAt('job-a')).toBeUndefined();
    expect(logger.warnings).toEqual([]);
  });

  test('set → новый экземпляр читает записанное (переживание перезагрузки)', () => {
    const at = Date.UTC(2026, 0, 1, 12);
    const writer = new JobRunJsonRepo(filePath, recordingLogger());
    writer.setLastRunAt('job-a', at);

    const reader = new JobRunJsonRepo(filePath, recordingLogger());
    expect(reader.getLastRunAt('job-a')).toBe(at);
  });

  test('повреждённый файл — история начинается заново, без падения; предупреждение с путём', () => {
    writeFileSync(filePath, 'не-json{{{');

    const logger = recordingLogger();
    const store = new JobRunJsonRepo(filePath, logger);
    expect(store.getLastRunAt('job-a')).toBeUndefined();
    expect(logger.warnings).toHaveLength(1);
    expect(logger.warnings[0]).toContain('job-run-repo:');
    expect(logger.warnings[0]).toContain(filePath);

    const at = Date.UTC(2026, 1, 1);
    store.setLastRunAt('job-b', at);
    expect(
      new JobRunJsonRepo(filePath, recordingLogger()).getLastRunAt('job-b'),
    ).toBe(at);
  });

  test('set пишет в файл ISO-строку формата { version: 1, lastRuns }', () => {
    const path = join(tmpDir, 'format', 'last-runs.json');
    new JobRunJsonRepo(path, recordingLogger()).setLastRunAt(
      'job-a',
      Date.UTC(2026, 0, 1, 12),
    );

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      version: 1,
      lastRuns: { 'job-a': '2026-01-01T12:00:00.000Z' },
    });
  });

  test('set по существующему файлу сохраняет ключи других заданий', () => {
    const path = join(tmpDir, 'keep-keys', 'last-runs.json');
    mkdirSync(join(tmpDir, 'keep-keys'), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        lastRuns: {
          'job-a': '2026-01-01T12:00:00.000Z',
          'job-b': '2026-02-01T12:00:00.000Z',
        },
      }),
    );

    new JobRunJsonRepo(path, recordingLogger()).setLastRunAt(
      'job-a',
      Date.UTC(2026, 2, 1),
    );

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      version: 1,
      lastRuns: {
        'job-a': '2026-03-01T00:00:00.000Z',
        'job-b': '2026-02-01T12:00:00.000Z',
      },
    });
  });

  test('get читает ISO-строку прежнего файла как число; нечитаемая дата — undefined и предупреждение', () => {
    const path = join(tmpDir, 'legacy-file.json');
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        lastRuns: {
          'job-a': '2026-01-01T12:00:00.000Z',
          'job-bad': 'не-дата',
        },
      }),
    );

    const logger = recordingLogger();
    const store = new JobRunJsonRepo(path, logger);
    expect(store.getLastRunAt('job-a')).toBe(Date.UTC(2026, 0, 1, 12));
    expect(logger.warnings).toEqual([]);

    expect(store.getLastRunAt('job-bad')).toBeUndefined();
    expect(logger.warnings).toHaveLength(1);
    expect(logger.warnings[0]).toContain('job-run-repo:');
    expect(logger.warnings[0]).toContain('job-bad');
    expect(logger.warnings[0]).toContain(path);
  });
});
