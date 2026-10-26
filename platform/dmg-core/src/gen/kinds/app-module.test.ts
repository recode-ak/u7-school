import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { parseArgs } from '../cli';
import { GenLayout } from '../layout';
import { planAppModule } from './app-module';

const root = '/p';
const plan = (
  gen: { domainImport?: string } = { domainImport: '@acme/domain/{m}' },
) =>
  planAppModule(
    parseArgs(
      ['module', 'stream'],
      new GenLayout({ domain: '/d/{m}', app: '/p/{m}/src', ...gen }, '.'),
    ),
  );
const content = (p: ReturnType<typeof plan>, rel: string) =>
  p.files.find((f) => f.path === join(root, 'stream', rel))?.content ?? '';

test('только исходники модуля: заготовку пакета (package.json) пишет проект', () => {
  expect(plan().files.map((f) => f.path.slice(root.length + 1))).toEqual([
    'stream/src/stream.module.ts',
    'stream/src/stream.module.test.ts',
  ]);
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
