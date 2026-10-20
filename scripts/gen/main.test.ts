import { afterEach, beforeEach, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGen } from './main.ts';

let root: string;
let out: string[];
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gen-main-'));
  out = [];
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const gen = (...argv: string[]) =>
  runGen(
    [
      ...argv,
      '--domain-root',
      join(root, 'd'),
      '--packages-root',
      join(root, 'p'),
    ],
    (line) => out.push(line),
  );

test('dry-run по умолчанию: печатает план и ничего не пишет', () => {
  expect(gen('module', 'stream')).toBe(0);
  expect(existsSync(join(root, 'd'))).toBe(false);
  expect(out.join('\n')).toContain('stream.module.ts');
  expect(out.join('\n')).toContain('--write');
});

test('module --write создаёт домен и прикладной слой', () => {
  expect(gen('module', 'stream', '--write')).toBe(0);
  expect(existsSync(join(root, 'd/stream/stream.module.ts'))).toBe(true);
  expect(existsSync(join(root, 'p/stream/src/stream.module.ts'))).toBe(true);
});

test('aggregate --write: домен и прикладной слой, правки модулей применены', () => {
  gen('module', 'stream', '--write');
  expect(gen('aggregate', 'stream.student', '--write')).toBe(0);
  expect(existsSync(join(root, 'd/stream/student/student.ar.ts'))).toBe(true);
  expect(
    existsSync(join(root, 'p/stream/src/infra/student.json-repo.ts')),
  ).toBe(true);
  expect(
    readFileSync(join(root, 'd/stream/stream.module.ts'), 'utf8'),
  ).toContain('StudentArDef,');
  expect(
    readFileSync(join(root, 'p/stream/src/stream.module.ts'), 'utf8'),
  ).toContain('readonly studentRepo');
});

test('uc/er/job/dcs/dqs --write', () => {
  gen('module', 'stream', '--write');
  gen('aggregate', 'stream.student', '--write');
  expect(gen('uc', 'stream.student', 'complete-student', '--write')).toBe(0);
  expect(gen('er', 'stream.student', 'react-student', '--write')).toBe(0);
  expect(gen('job', 'stream.student', 'sweep-students', '--write')).toBe(0);
  expect(gen('dcs', 'stream', 'progress', '--write')).toBe(0);
  expect(gen('dqs', 'stream', 'navigation', '--write')).toBe(0);
  expect(
    existsSync(join(root, 'p/stream/src/student/uc/complete-student.uc.ts')),
  ).toBe(true);
  expect(existsSync(join(root, 'd/stream/navigation.dqs.ts'))).toBe(true);
});

test('ошибка ввода: код 1 и сообщение, ничего не создано', () => {
  expect(gen('uc', 'stream.student', 'x')).toBe(1);
  expect(out.join('\n')).toContain('Модуль «stream» не найден');
});

test('коллизия: код 1, ничего не записано второй раз', () => {
  gen('module', 'stream', '--write');
  out = [];
  expect(gen('module', 'stream', '--write')).toBe(1);
  expect(out.join('\n')).toContain('уже существует');
});

test('нет маркера: печатает строку для ручной вставки, код 0', () => {
  gen('module', 'stream', '--write');
  const modulePath = join(root, 'd/stream/stream.module.ts');
  Bun.write(modulePath, 'export {};\n');
  out = [];
  expect(gen('aggregate', 'stream.student', '--write')).toBe(0);
  expect(out.join('\n')).toContain('Вставь вручную');
  expect(out.join('\n')).toContain('StudentArDef');
});
