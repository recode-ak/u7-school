import { expect, test } from 'bun:test';
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
