import { afterEach, beforeEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
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

const snapshot = (dir: string) =>
  Object.fromEntries(
    readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .filter((f) => statSync(join(dir, f)).isFile())
      .sort()
      .map((f) => [f, readFileSync(join(dir, f), 'utf8')]),
  );

const slice = [
  ['module', 'stream'],
  ['aggregate', 'stream.student'],
  ['uc', 'stream.student', 'complete-student'],
  ['er', 'stream.student', 'react-student'],
  ['job', 'stream.student', 'sweep-students'],
  ['dcs', 'stream', 'progress'],
  ['dqs', 'stream', 'navigation'],
];

test('детерминизм: два прогона среза дают побайтно одинаковые деревья', () => {
  for (const step of slice) gen(...step, '--write');
  const first = snapshot(root);
  rmSync(root, { recursive: true, force: true });
  mkdirSync(root);
  for (const step of slice) gen(...step, '--write');
  expect(snapshot(root)).toEqual(first);
});

test('повтор команды не меняет файлы: код 1 и дерево прежнее', () => {
  for (const step of slice) gen(...step, '--write');
  const before = snapshot(root);
  for (const step of slice) expect(gen(...step, '--write')).toBe(1);
  expect(snapshot(root)).toEqual(before);
});

test('module --adopt поверх legacy: точки входа не тронуты, паспорт создан', () => {
  mkdirSync(join(root, 'd/wish'), { recursive: true });
  mkdirSync(join(root, 'p/wish/src'), { recursive: true });
  writeFileSync(join(root, 'd/wish/index.ts'), '// legacy\n');
  writeFileSync(join(root, 'p/wish/package.json'), '{}');
  expect(gen('module', 'wish', '--adopt', '--write')).toBe(0);
  expect(existsSync(join(root, 'd/wish/wish.module.ts'))).toBe(true);
  expect(existsSync(join(root, 'p/wish/src/wish.module.ts'))).toBe(true);
  expect(readFileSync(join(root, 'd/wish/index.ts'), 'utf8')).toBe(
    '// legacy\n',
  );
  expect(readFileSync(join(root, 'p/wish/package.json'), 'utf8')).toBe('{}');
  expect(out.join('\n')).toContain(
    `Пропущен: ${join(root, 'd/wish/index.ts')}`,
  );
});
