import { expect, test } from 'bun:test';
import { parseArgs } from '../cli.ts';
import { planDomainModule } from './module.ts';

const plan = planDomainModule(
  parseArgs(['module', 'stream', '--domain-root', '/d']),
);
const file = (path: string) =>
  plan.files.find((f) => f.path === `/d/stream/${path}`)?.content ?? '';

test('домен модуля: паспорт, фасад, публичный API и тест — по naming.md §2', () => {
  expect(plan.files.map((f) => f.path)).toEqual([
    '/d/stream/stream.module.ts',
    '/d/stream/stream.facade.ts',
    '/d/stream/index.ts',
    '/d/stream/stream.module.test.ts',
  ]);
  expect(plan.edits).toEqual([]);
});

test('паспорт: defineModule с маркерами для Def', () => {
  const src = file('stream.module.ts');
  expect(src).toContain("import { defineModule } from 'dmg-core';");
  expect(src).toContain("import { StreamFacadeDef } from './stream.facade';");
  expect(src).toContain('export const StreamModuleDef = defineModule({');
  expect(src).toContain("name: 'stream'");
  expect(src).toContain('facade: StreamFacadeDef');
  for (const m of ['imports', 'aggregates', 'useCases', 'reactions', 'jobs']) {
    expect(src).toContain(`// gen:defs:${m}`);
  }
});

test('фасад: defineFacade без методов', () => {
  const src = file('stream.facade.ts');
  expect(src).toContain("import { defineFacade } from 'dmg-core';");
  expect(src).toContain('export const StreamFacadeDef = defineFacade({');
  expect(src).toContain("name: 'stream'");
  expect(src).toContain('methods: {}');
});

test('index: экспорт модуля и фасада, маркер для остального', () => {
  const src = file('index.ts');
  expect(src).toContain("export { StreamFacadeDef } from './stream.facade';");
  expect(src).toContain("export { StreamModuleDef } from './stream.module';");
  expect(src).toContain('// gen:exports');
});

test('заготовка теста: паспорт нормализуется', () => {
  const src = file('stream.module.test.ts');
  expect(src).toContain("import { normalize } from 'dmg-core/graph';");
  expect(src).toContain('normalize(StreamModuleDef)');
  expect(src).toContain("name: 'stream'");
});

test('TODO только там, где автор заполняет текст', () => {
  expect(file('stream.module.ts')).toContain('label: ');
  const todo = (s: string) => s.split('\n').filter((l) => l.includes('TODO'));
  expect(todo(file('stream.module.ts'))).toHaveLength(2);
  expect(todo(file('stream.facade.ts'))).toHaveLength(2);
});
