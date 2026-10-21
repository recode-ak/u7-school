import { afterEach, beforeEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from '../cli.ts';
import { planAppModule } from './app-module.ts';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'gen-app-module-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const plan = () =>
  planAppModule(parseArgs(['module', 'stream', '--packages-root', root]));
const content = (p: ReturnType<typeof plan>, rel: string) =>
  p.files.find((f) => f.path === join(root, 'stream', rel))?.content ?? '';

test('новый пакет: каркас пакета и src по naming.md §3', () => {
  expect(plan().files.map((f) => f.path.slice(root.length + 1))).toEqual([
    'stream/package.json',
    'stream/tsconfig.json',
    'stream/src/index.ts',
    'stream/src/stream.module.ts',
    'stream/src/stream.module.test.ts',
  ]);
});

test('существующий пакет (legacy): package.json, tsconfig и index не трогаем', () => {
  mkdirSync(join(root, 'stream'), { recursive: true });
  writeFileSync(join(root, 'stream', 'package.json'), '{}');
  expect(plan().files.map((f) => f.path.slice(root.length + 1))).toEqual([
    'stream/src/stream.module.ts',
    'stream/src/stream.module.test.ts',
  ]);
});

test('package.json: имя, зависимости на domain и dmg-core', () => {
  const pkg = JSON.parse(content(plan(), 'package.json'));
  expect(pkg.name).toBe('@u7-scl/stream');
  expect(pkg.dependencies).toEqual({
    '@u7-scl/domain': 'workspace:*',
    'dmg-core': 'workspace:*',
  });
  expect(pkg.exports).toEqual({ '.': './src/index.ts' });
});

test('module: карта Def → класс с маркерами и фабрика', () => {
  const src = content(plan(), 'src/stream.module.ts');
  expect(src).toContain(
    "import { StreamModuleDef } from '@u7-scl/domain/stream';",
  );
  expect(src).toContain('export type StreamDeps = ModuleDeps & {');
  expect(src).toContain('// gen:deps');
  expect(src).toContain('export const streamMap = {');
  for (const m of ['imports', 'useCases', 'reactions', 'jobs']) {
    expect(src).toContain(`// gen:defs:${m}`);
  }
  expect(src).not.toContain('acade');
  expect(src).toContain(
    'satisfies ModuleMap<typeof StreamModuleDef, StreamDeps, unknown>',
  );
  expect(src).toContain('export function createStreamModule(deps: StreamDeps)');
});

test('index нового пакета публикует фабрику модуля', () => {
  expect(content(plan(), 'src/index.ts')).toContain(
    "export { createStreamModule, type StreamDeps } from './stream.module';",
  );
});
