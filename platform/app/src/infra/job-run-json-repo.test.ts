import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { type Logger, LogLevel } from '@u7-scl/core/shared';
import { TempDir } from 'dmg-core/testing';
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
  let tmpDir: TempDir;
  let filePath: string;

  beforeAll(() => {
    tmpDir = TempDir.create('job-run-store-');
    filePath = tmpDir.file('sub', 'last-runs.json');
  });

  afterAll(() => tmpDir.dispose());

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

  test('set пишет в файл число формата { version: 1, lastRuns }', () => {
    const path = tmpDir.file('format', 'last-runs.json');
    new JobRunJsonRepo(path, recordingLogger()).setLastRunAt(
      'job-a',
      Date.UTC(2026, 0, 1, 12),
    );

    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
      version: 1,
      lastRuns: { 'job-a': Date.UTC(2026, 0, 1, 12) },
    });
  });

  test('set по существующему файлу сохраняет ключи других заданий', () => {
    const path = tmpDir.file('keep-keys', 'last-runs.json');
    mkdirSync(tmpDir.file('keep-keys'), { recursive: true });
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        lastRuns: {
          'job-a': Date.UTC(2026, 0, 1, 12),
          'job-b': Date.UTC(2026, 1, 1, 12),
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
        'job-a': Date.UTC(2026, 2, 1),
        'job-b': Date.UTC(2026, 1, 1, 12),
      },
    });
  });

  test('get: ISO-строка → undefined и предупреждение; соседние числовые ключи читаются', () => {
    const path = tmpDir.file('legacy-file.json');
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        lastRuns: {
          'job-a': Date.UTC(2026, 0, 1, 12),
          'job-iso': '2026-01-01T12:00:00.000Z',
        },
      }),
    );

    const logger = recordingLogger();
    const store = new JobRunJsonRepo(path, logger);
    expect(store.getLastRunAt('job-a')).toBe(Date.UTC(2026, 0, 1, 12));
    expect(logger.warnings).toEqual([]);

    expect(store.getLastRunAt('job-iso')).toBeUndefined();
    expect(logger.warnings).toHaveLength(1);
    expect(logger.warnings[0]).toContain('job-run-repo:');
    expect(logger.warnings[0]).toContain('job-iso');
    expect(logger.warnings[0]).toContain(path);
  });

  test('get: отрицательное, дробное и не-число → undefined и предупреждение', () => {
    const path = tmpDir.file('invalid-values.json');
    writeFileSync(
      path,
      JSON.stringify({
        version: 1,
        lastRuns: { 'job-neg': -1, 'job-frac': 1.5, 'job-null': null },
      }),
    );

    const logger = recordingLogger();
    const store = new JobRunJsonRepo(path, logger);
    for (const name of ['job-neg', 'job-frac', 'job-null']) {
      expect(store.getLastRunAt(name)).toBeUndefined();
    }
    expect(logger.warnings).toHaveLength(3);
    expect(logger.warnings[0]).toContain('job-neg');
    expect(logger.warnings[1]).toContain('job-frac');
    expect(logger.warnings[2]).toContain('job-null');
  });

  test('get: ноль — корректный Timestamp', () => {
    const path = tmpDir.file('zero.json');
    writeFileSync(
      path,
      JSON.stringify({ version: 1, lastRuns: { 'job-z': 0 } }),
    );

    const logger = recordingLogger();
    expect(new JobRunJsonRepo(path, logger).getLastRunAt('job-z')).toBe(0);
    expect(logger.warnings).toEqual([]);
  });
});
