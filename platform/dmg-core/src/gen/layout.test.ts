import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GenLayout } from './layout';

const layout = (domainImport?: string) =>
  new GenLayout(
    {
      domain: 'packages/domain/src/{m}',
      app: 'packages/{m}/src',
      domainImport,
    },
    '/repo',
  );

test('каталоги модуля — шаблоны с {m} от корня проекта', () => {
  expect(layout().domainDir('stream')).toBe('/repo/packages/domain/src/stream');
  expect(layout().appDir('stream')).toBe('/repo/packages/stream/src');
});

test('абсолютный шаблон не зависит от корня', () => {
  const abs = new GenLayout({ domain: '/d/{m}', app: '/p/{m}/src' }, '/repo');
  expect(abs.domainDir('stream')).toBe('/d/stream');
  expect(abs.appDir('stream')).toBe('/p/stream/src');
});

test('корень «.» оставляет пути относительными', () => {
  const rel = new GenLayout(GenLayout.defaults, '.');
  expect(rel.domainDir('todo')).toBe('src/domain/todo');
  expect(rel.appDir('todo')).toBe('src/app/todo');
});

test('domainImport задан — спецификатор по шаблону', () => {
  expect(
    new GenLayout(
      { ...GenLayout.defaults, domainImport: '@acme/domain/{m}' },
      '.',
    ).domainImport('stream', 'src/app/stream/student/uc'),
  ).toBe('@acme/domain/stream');
});

test('domainImport не задан — относительный путь к каталогу домена', () => {
  const rel = new GenLayout(GenLayout.defaults, '/repo');
  expect(rel.domainImport('todo', '/repo/src/app/todo')).toBe(
    '../../domain/todo',
  );
  expect(rel.domainImport('todo', '/repo/src/app/todo/task/uc')).toBe(
    '../../../../domain/todo',
  );
});

test('относительный путь внутри каталога начинается с ./', () => {
  const nested = new GenLayout({ domain: 'm/{m}/domain', app: 'm/{m}' }, '.');
  expect(nested.domainImport('todo', 'm/todo')).toBe('./domain');
});

test('module — обе стороны модуля для ArchApp.layout', () => {
  expect(layout().module('stream')).toEqual({
    domain: '/repo/packages/domain/src/stream',
    app: '/repo/packages/stream/src',
  });
});

test('describe — применяемая раскладка одной строкой', () => {
  expect(layout('@acme/domain/{m}').describe()).toBe(
    'Раскладка: домен — packages/domain/src/{m}, прикладной слой — packages/{m}/src, импорт домена — @acme/domain/{m}',
  );
  expect(new GenLayout(GenLayout.defaults, '.').describe()).toBe(
    'Раскладка: домен — src/domain/{m}, прикладной слой — src/app/{m}, импорт домена — относительный',
  );
});

test('settingsFrom — шаблоны поверх значений по умолчанию', () => {
  expect(GenLayout.settingsFrom({ app: 'p/{m}' })).toEqual({
    domain: 'src/domain/{m}',
    app: 'p/{m}',
  });
});

test('settingsFrom — ошибки с полем', () => {
  const error = (json: unknown) => () => GenLayout.settingsFrom(json);
  expect(error([])).toThrow('dmg-core.json: gen — объект');
  expect(error({ domain: 'src/domain' })).toThrow(
    'dmg-core.json: gen.domain — шаблон пути с {m}',
  );
  expect(error({ domainImport: 1 })).toThrow(
    'dmg-core.json: gen.domainImport — шаблон с {m}',
  );
  expect(error({ root: '.' })).toThrow(
    'dmg-core.json: неизвестное поле «gen.root»',
  );
});

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gen-layout-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

test('read — раскладка из секции gen dmg-core.json проекта', async () => {
  writeFileSync(
    join(root, 'dmg-core.json'),
    JSON.stringify({ instructions: null, gen: { domain: 'd/{m}' } }),
  );
  expect((await GenLayout.read(root)).module('todo')).toEqual({
    domain: join(root, 'd/todo'),
    app: join(root, 'src/app/todo'),
  });
});

test('read — без файла или без секции gen значения по умолчанию', async () => {
  expect((await GenLayout.read(root)).domainDir('todo')).toBe(
    join(root, 'src/domain/todo'),
  );
  writeFileSync(join(root, 'dmg-core.json'), '{}');
  expect((await GenLayout.read(root)).appDir('todo')).toBe(
    join(root, 'src/app/todo'),
  );
});

const MONOREPO = {
  domain: 'domain/src/{m}',
  app: 'modules/{m}/src',
  domainImport: '@acme/domain/{m}',
  package: '@acme/{m}',
};

test('settingsFrom — gen.package: шаблон имени пакета модуля', () => {
  expect(GenLayout.settingsFrom(MONOREPO)).toEqual(MONOREPO);
});

test('settingsFrom — ошибки gen.package', () => {
  const error = (json: unknown) => () => GenLayout.settingsFrom(json);
  expect(error({ ...MONOREPO, package: '@acme/todo' })).toThrow(
    'dmg-core.json: gen.package — шаблон имени пакета с {m}',
  );
  expect(error({ ...MONOREPO, app: 'modules/{m}' })).toThrow(
    'dmg-core.json: gen.package — gen.app должен оканчиваться на /src',
  );
  const { domainImport: _, ...noImport } = MONOREPO;
  expect(error(noImport)).toThrow(
    'dmg-core.json: gen.package — нужен gen.domainImport',
  );
});

test('package — пакет модуля над каталогом прикладного слоя', () => {
  expect(new GenLayout(MONOREPO, '.').package('todo')).toEqual({
    dir: 'modules/todo',
    name: '@acme/todo',
    domain: '@acme/domain',
    root: '../..',
  });
  expect(new GenLayout(MONOREPO, '/repo').package('todo')).toEqual({
    dir: '/repo/modules/todo',
    name: '@acme/todo',
    domain: '@acme/domain',
    root: '../..',
  });
});

test('package — пакет домена без scope: первый сегмент domainImport', () => {
  const plain = { ...MONOREPO, domainImport: 'domain/{m}', package: '{m}' };
  expect(new GenLayout(plain, '.').package('todo')).toMatchObject({
    name: 'todo',
    domain: 'domain',
  });
});

test('package — без gen.package пакета нет', () => {
  expect(new GenLayout(GenLayout.defaults, '.').package('todo')).toBe(
    undefined,
  );
});

test('describe — с пакетом модуля', () => {
  expect(new GenLayout(MONOREPO, '.').describe()).toBe(
    'Раскладка: домен — domain/src/{m}, прикладной слой — modules/{m}/src, импорт домена — @acme/domain/{m}, пакет модуля — @acme/{m}',
  );
});
