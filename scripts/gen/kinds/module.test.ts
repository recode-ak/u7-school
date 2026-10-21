import { expect, test } from 'bun:test';
import { parseArgs } from '../cli.ts';
import { planDomainModule } from './module.ts';

const plan = planDomainModule(
  parseArgs(['module', 'stream', '--domain-root', '/d']),
);
const file = (path: string) =>
  plan.files.find((f) => f.path === `/d/stream/${path}`)?.content ?? '';

test('паспорт, публичный API и тест — по naming.md §2; фасада нет (D-42)', () => {
  expect(plan.files.map((f) => f.path)).toEqual([
    '/d/stream/stream.module.ts',
    '/d/stream/index.ts',
    '/d/stream/stream.module.test.ts',
  ]);
  expect(plan.edits).toEqual([]);
  for (const f of plan.files) expect(f.content).not.toContain('acade');
});

test('паспорт: defineModule с маркерами для Def', () => {
  const src = file('stream.module.ts');
  expect(src).toContain("import { defineModule } from 'dmg-core';");
  expect(src).toContain('export const StreamModuleDef = defineModule({');
  expect(src).toContain("name: 'stream'");
  for (const m of ['imports', 'aggregates', 'useCases', 'reactions', 'jobs']) {
    expect(src).toContain(`// gen:defs:${m}`);
  }
});

test('index: экспорт модуля, маркер для остального', () => {
  const src = file('index.ts');
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
});
