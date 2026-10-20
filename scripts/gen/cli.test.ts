import { expect, test } from 'bun:test';
import { GenError, parseArgs } from './cli.ts';

test('uc: модуль.агрегат + имя; по умолчанию dry-run и корни по умолчанию', () => {
  expect(parseArgs(['uc', 'stream.student', 'complete-student'])).toEqual({
    kind: 'uc',
    module: 'stream',
    aggregate: 'student',
    name: 'complete-student',
    write: false,
    domainRoot: 'packages/domain/src',
    packagesRoot: 'packages',
  });
});

test('module: только имя модуля', () => {
  const a = parseArgs(['module', 'stream']);
  expect(a).toMatchObject({ kind: 'module', module: 'stream' });
  expect(a.aggregate).toBeUndefined();
  expect(a.name).toBeUndefined();
});

test('aggregate: модуль.агрегат без имени', () => {
  expect(parseArgs(['aggregate', 'stream.student'])).toMatchObject({
    kind: 'aggregate',
    module: 'stream',
    aggregate: 'student',
  });
});

test('dcs/dqs: модуль + топик в name', () => {
  expect(parseArgs(['dcs', 'stream', 'stream-progress'])).toMatchObject({
    kind: 'dcs',
    module: 'stream',
    name: 'stream-progress',
  });
});

test('опции: --write, --dry-run, --domain-root, --packages-root', () => {
  const a = parseArgs([
    'module',
    'stream',
    '--write',
    '--domain-root',
    '/tmp/d',
    '--packages-root=/tmp/p',
  ]);
  expect(a).toMatchObject({
    write: true,
    domainRoot: '/tmp/d',
    packagesRoot: '/tmp/p',
  });
  expect(parseArgs(['module', 'stream', '--write', '--dry-run']).write).toBe(
    false,
  );
});

test('ошибки на русском', () => {
  const msg = (argv: string[]) => {
    try {
      parseArgs(argv);
    } catch (e) {
      expect(e).toBeInstanceOf(GenError);
      return (e as Error).message;
    }
    throw new Error('ожидалась ошибка');
  };
  expect(msg([])).toContain('Использование');
  expect(msg(['widget', 'a'])).toContain('Неизвестный вид');
  expect(msg(['uc', 'stream', 'x'])).toContain('<модуль>.<агрегат>');
  expect(msg(['uc', 'stream.student'])).toContain('имя');
  expect(msg(['module', 'stream.student'])).toContain('только имя модуля');
  expect(msg(['module', 'stream', '--bogus'])).toContain('Неизвестная опция');
  expect(msg(['module', 'stream', '--domain-root'])).toContain('значение');
  expect(msg(['module', 'a', 'b'])).toContain('лишний аргумент');
});
