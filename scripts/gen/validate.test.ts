import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { type GenArgs, GenError, parseArgs } from './cli.ts';
import { validate } from './validate.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gen-validate-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

function touch(rel: string) {
  const path = join(root, 'domain', rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, '');
}

function args(argv: string[]): GenArgs {
  return parseArgs([
    ...argv,
    '--domain-root',
    join(root, 'domain'),
    '--packages-root',
    join(root, 'packages'),
  ]);
}

function message(argv: string[]): string {
  try {
    validate(args(argv));
  } catch (e) {
    expect(e).toBeInstanceOf(GenError);
    return (e as Error).message;
  }
  throw new Error('ожидалась ошибка');
}

test('имена не в kebab-case отклоняются', () => {
  expect(message(['module', 'Stream'])).toContain('kebab-case');
  touch('stream/stream.module.ts');
  expect(message(['aggregate', 'stream.My_Agg'])).toContain('kebab-case');
  touch('stream/student/student.ar.ts');
  expect(message(['uc', 'stream.student', 'CompleteStudent'])).toContain(
    'kebab-case',
  );
});

test('module: модуль не должен существовать', () => {
  validate(args(['module', 'stream']));
  touch('stream/stream.module.ts');
  expect(message(['module', 'stream'])).toContain('уже существует');
});

test('aggregate: нужен модуль, агрегат не должен существовать', () => {
  expect(message(['aggregate', 'stream.student'])).toContain(
    'Модуль «stream» не найден',
  );
  touch('stream/stream.module.ts');
  validate(args(['aggregate', 'stream.student']));
  touch('stream/student/student.state.ts');
  expect(message(['aggregate', 'stream.student'])).toContain(
    'Агрегат «stream.student» уже существует',
  );
});

test('uc/er/job: нужен агрегат', () => {
  touch('stream/stream.module.ts');
  expect(message(['uc', 'stream.student', 'complete-student'])).toContain(
    'Агрегат «stream.student» не найден',
  );
  touch('stream/student/student.state.ts');
  validate(args(['uc', 'stream.student', 'complete-student']));
});

test('uc/er/job: имя уникально в модуле (Def и класс не двоятся)', () => {
  touch('stream/stream.module.ts');
  touch('stream/student/student.state.ts');
  touch('stream/group/group.state.ts');
  touch('stream/group/uc/complete-student.uc.ts');
  expect(message(['uc', 'stream.student', 'complete-student'])).toContain(
    'уже занято',
  );
  // другой вид с тем же именем — другой класс, допустимо
  validate(args(['er', 'stream.student', 'complete-student']));
});

test('dcs/dqs: нужен модуль, топик уникален', () => {
  expect(message(['dcs', 'stream', 'progress'])).toContain('не найден');
  touch('stream/stream.module.ts');
  validate(args(['dcs', 'stream', 'progress']));
  touch('stream/progress.dcs.ts');
  expect(message(['dcs', 'stream', 'progress'])).toContain('уже занято');
});
