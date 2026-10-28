import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { parseArgs } from '../cli';
import { GenLayout } from '../layout';
import { planAppModule } from './app-module';

const root = '/p';
const plan = (
  gen: { domainImport?: string; package?: string; compositionRoot?: string } = {
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

const MONO = {
  domainImport: '@acme/domain/{m}',
  package: '@acme/{m}',
  compositionRoot: 'app/src',
};

test('подключение к app.ts: импорты Def и фабрики, элемент с маркером репозиториев', () => {
  const edits = plan(MONO).edits.filter((e) => e.path === 'app/src/app.ts');
  expect(edits).toEqual([
    {
      path: 'app/src/app.ts',
      marker: '// gen:imports',
      line: "import { StreamModuleDef } from '@acme/domain/stream/contract';",
    },
    {
      path: 'app/src/app.ts',
      marker: '// gen:imports',
      line: "import { createStreamModule } from '@acme/stream';",
    },
    {
      path: 'app/src/app.ts',
      marker: '// gen:modules',
      line: [
        '      {',
        '        def: StreamModuleDef,',
        '        create: (deps) =>',
        '          createStreamModule({',
        '            ...deps,',
        '            // gen:repos:stream',
        '          }),',
        '      },',
      ].join('\n'),
    },
  ]);
});

test('подключение к arch-check.ts: импорт и корень Def', () => {
  const edits = plan(MONO).edits.filter(
    (e) => e.path === 'scripts/arch-check.ts',
  );
  expect(edits).toEqual([
    {
      path: 'scripts/arch-check.ts',
      marker: '// gen:imports',
      line: "import { StreamModuleDef } from '@acme/domain/stream/contract';",
    },
    {
      path: 'scripts/arch-check.ts',
      marker: '// gen:modules',
      line: '  StreamModuleDef,',
    },
  ]);
});

test('с gen.package — зависимость пакета корня сборки и напоминание bun install', () => {
  const p = plan(MONO);
  expect(p.dependencies).toEqual([
    {
      path: 'app/package.json',
      name: '@acme/stream',
      version: 'workspace:*',
    },
  ]);
  expect(p.notes).toEqual([
    'Затем bun install — чтобы пакет модуля появился в node_modules.',
  ]);
});

test('без gen.package (single): относительные импорты, зависимостей нет', () => {
  const p = planAppModule(
    parseArgs(['module', 'stream'], new GenLayout(GenLayout.defaults, '/r')),
  );
  expect(p.dependencies ?? []).toEqual([]);
  expect(p.notes ?? []).toEqual([]);
  expect(p.edits.filter((e) => e.marker === '// gen:imports')).toEqual([
    {
      path: '/r/src/app/app.ts',
      marker: '// gen:imports',
      line: "import { StreamModuleDef } from '../domain/stream/contract';",
    },
    {
      path: '/r/src/app/app.ts',
      marker: '// gen:imports',
      line: "import { createStreamModule } from './stream';",
    },
    {
      path: '/r/scripts/arch-check.ts',
      marker: '// gen:imports',
      line: "import { StreamModuleDef } from '../src/domain/stream/contract';",
    },
  ]);
});

test('gen.package, корень сборки не на /src — зависимость вручную с каталогом', () => {
  const p = plan({
    domainImport: '@acme/domain/{m}',
    package: '@acme/{m}',
    compositionRoot: 'app',
  });
  expect(p.dependencies ?? []).toEqual([]);
  const text = (p.notes ?? []).join('\n');
  expect(text).toContain('"@acme/stream": "workspace:*"');
  expect(text).toContain('package.json пакета с каталогом app');
  expect(text).toContain(
    'bun install — чтобы пакет модуля появился в node_modules',
  );
});

test('своя раскладка без gen.compositionRoot — правок нет, общая подсказка', () => {
  const p = plan({ domainImport: '@acme/domain/{m}', package: '@acme/{m}' });
  expect(p.edits).toEqual([]);
  expect(p.dependencies ?? []).toEqual([]);
  const text = (p.notes ?? []).join('\n');
  expect(text).toContain('gen.compositionRoot');
  expect(text).toContain(
    '{ def: StreamModuleDef, create: (deps) => createStreamModule({ ...deps }) }',
  );
  expect(text).toContain("'@acme/stream'");
  expect(text).toContain("'@acme/domain/stream/contract'");
  expect(text).toContain('scripts/arch-check.ts');
  expect(text).toContain('"@acme/stream": "workspace:*"');
  expect(text).not.toContain('src/app/app.ts');
});

test('длинные имена: импорт с одним именем biome не переносит — одна строка', () => {
  const p = planAppModule(
    parseArgs(
      ['module', 'notification-settings'],
      new GenLayout(
        {
          domain: 'domain/src/{m}',
          app: 'modules/{m}/src',
          domainImport: '@acme/domain/{m}',
          package: '@acme/{m}',
          compositionRoot: 'app/src',
        },
        '/r',
      ),
    ),
  );
  const imports = p.edits
    .filter((e) => e.path === '/r/app/src/app.ts')
    .filter((e) => e.marker === '// gen:imports')
    .map((e) => e.line);
  expect(imports).toEqual([
    "import { NotificationSettingsModuleDef } from '@acme/domain/notification-settings/contract';",
    "import { createNotificationSettingsModule } from '@acme/notification-settings';",
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
