import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { parseArgs } from '../cli';
import { GenLayout } from '../layout';
import { planAppModule } from './app-module';

const root = '/p';
const plan = (
  gen: { domainImport?: string; package?: string } = {
    domainImport: '@acme/domain/{m}',
  },
) =>
  planAppModule(
    parseArgs(
      ['module', 'stream'],
      new GenLayout({ domain: '/d/{m}', app: '/p/{m}/src', ...gen }, '.'),
    ),
  );
const content = (p: ReturnType<typeof plan>, rel: string) =>
  p.files.find((f) => f.path === join(root, 'stream', rel))?.content ?? '';

test('исходники модуля и вход прикладного пакета (пакет — module-package)', () => {
  expect(plan().files.map((f) => f.path.slice(root.length + 1))).toEqual([
    'stream/src/stream.module.ts',
    'stream/src/stream.module.test.ts',
    'stream/src/index.ts',
  ]);
});

test('index.ts — вход для корня сборки (D-52): фабрика, Deps и маркер', () => {
  expect(content(plan(), 'src/index.ts')).toBe(
    `// Вход прикладного пакета stream для корня сборки (ARC-07, D-52): фабрика
// модуля и репозитории. UC, ER и Job снаружи не видны.
export { createStreamModule, type StreamDeps } from './stream.module';
// gen:exports
`,
  );
});

test('notes — подключение к приложению вручную: фабрика и arch-check', () => {
  const notes = plan().notes ?? [];
  const text = notes.join('\n');
  expect(text).toContain(
    '{ def: StreamModuleDef, create: (deps) => createStreamModule({ ...deps }) }',
  );
  expect(text).toContain('/p/stream/src/index.ts');
  expect(text).toContain("'@acme/domain/stream/contract'");
  expect(text).toContain('scripts/arch-check.ts');
  expect(text).not.toContain('workspace:*');
});

test('notes — с gen.package: вход по имени пакета и зависимость корня сборки', () => {
  const text = (
    plan({ domainImport: '@acme/domain/{m}', package: '@acme/{m}' }).notes ?? []
  ).join('\n');
  expect(text).toContain("'@acme/stream'");
  expect(text).toContain('"@acme/stream": "workspace:*"');
  expect(text).toContain('bun install');
});

test('без domainImport — относительный импорт домена', () => {
  expect(content(plan({}), 'src/stream.module.ts')).toContain(
    "import { StreamModuleDef } from '../../../d/stream';",
  );
});

test('module: карта Def → класс с маркерами и фабрика', () => {
  const src = content(plan(), 'src/stream.module.ts');
  expect(src).toContain(
    "import { StreamModuleDef } from '@acme/domain/stream';",
  );
  expect(src).toContain('export type StreamDeps = ModuleDeps & {');
  expect(src).toContain('// gen:deps');
  expect(src).toContain('export const streamMap = {');
  for (const m of ['imports', 'useCases', 'reactions', 'jobs']) {
    expect(src).toContain(`// gen:defs:${m}`);
  }
  expect(src).not.toContain('acade');
  expect(src).toContain(
    'satisfies ModuleMap<typeof StreamModuleDef, StreamDeps, Identified>',
  );
  expect(src).toContain('export function createStreamModule(deps: StreamDeps)');
});

test('тест модуля: резолвер с пустыми фасадами (ModuleDeps, D-43)', () => {
  const src = content(plan(), 'src/stream.module.test.ts');
  expect(src).toContain("import { ModuleFacades } from 'dmg-core/app';");
  expect(src).toContain('facades: new ModuleFacades()');
});
