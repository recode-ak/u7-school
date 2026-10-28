import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPlan } from '../../gen/apply';
import { GenError } from '../../gen/cli';
import type { GenPlan } from '../../gen/plan';
import { CliConfig } from '../cli-config';
import { PackageSource } from '../package-source';
import { ProjectScaffold } from './project-scaffold';

// Каркас проекта `single` — план файлов: состав, конфиги и применение
// существующим `applyPlan` (без перезаписи).

const PACKAGE_ROOT = join(import.meta.dir, '../../..');
const NAME = 'acme';

const SINGLE_FILES = [
  '.gitignore',
  'package.json',
  'tsconfig.json',
  'biome.json',
  'dmg-core.json',
  'scripts/arch-check.ts',
  'src/domain/shared/app-user.ts',
  'src/app/app.ts',
  'src/app/app.types.ts',
  'src/app/app-caller-resolver.ts',
  'src/app/app.test.ts',
  'src/runner/main.ts',
  'src/runner/main.test.ts',
  'src/runner/runner-cli.ts',
  'src/runner/runner-cli.types.ts',
  'src/runner/runner-cli.test.ts',
  'src/runner/runner-env.ts',
  'src/runner/runner-env.types.ts',
  'src/runner/runner-env.test.ts',
];

let pkg: PackageSource;
beforeAll(async () => {
  pkg = await PackageSource.load(PACKAGE_ROOT);
});

function plan(root?: string): GenPlan {
  return new ProjectScaffold({
    profile: 'single',
    name: NAME,
    pkg,
    root,
  }).plan();
}

function file(path: string, root?: string): string {
  const found = plan(root).files.find((f) => f.path === path);
  if (found === undefined) throw new Error(`Нет файла в плане: ${path}`);
  return found.content;
}

function json(path: string) {
  return JSON.parse(file(path));
}

describe('ProjectScaffold single: состав плана', () => {
  it('все файлы каркаса, правок нет', () => {
    const res = plan();

    expect(res.files.map((f) => f.path).sort()).toEqual(
      [...SINGLE_FILES].sort(),
    );
    expect(res.edits).toEqual([]);
  });

  it('пути — от переданного root', () => {
    const paths = plan('/work/acme').files.map((f) => f.path);

    expect(paths).toContain('/work/acme/src/app/app.ts');
    expect(paths.every((p) => p.startsWith('/work/acme/'))).toBe(true);
  });

  it('имя проекта не по правилам npm — GenError (ошибка ввода CLI)', () => {
    for (const name of ['', 'Acme', 'a b', '../x']) {
      const create = () =>
        new ProjectScaffold({ profile: 'single', name, pkg });
      expect(create).toThrow(GenError);
      expect(create).toThrow(`Имя проекта «${name}» — не имя пакета npm`);
    }
    expect(
      () =>
        new ProjectScaffold({ profile: 'single', name: '@acme/school', pkg }),
    ).not.toThrow();
  });
});

describe('ProjectScaffold single: package.json', () => {
  it('имя, private, type module', () => {
    expect(json('package.json')).toMatchObject({
      name: NAME,
      private: true,
      type: 'module',
    });
  });

  it('скрипты check, arch:check, lint, format', () => {
    expect(json('package.json').scripts).toEqual({
      'arch:check': 'bun scripts/arch-check.ts',
      check:
        'dmg-core sync --check && biome check . && tsc --noEmit && bun run arch:check && bun test',
      lint: 'biome check .',
      format: 'biome check . --write',
    });
  });

  it('версии зависимостей — из PackageSource', () => {
    const manifest = json('package.json');

    expect(manifest.dependencies).toEqual({
      'dmg-core': `^${pkg.version}`,
      valibot: pkg.peerDependencies.valibot,
      '@valibot/to-json-schema':
        pkg.peerDependencies['@valibot/to-json-schema'],
    });
    expect(manifest.devDependencies).toEqual({
      '@biomejs/biome': pkg.devDependencies['@biomejs/biome'],
      typescript: pkg.devDependencies.typescript,
      '@types/bun': pkg.devDependencies['@types/bun'],
    });
  });
});

describe('ProjectScaffold single: прочие конфиги', () => {
  it('.gitignore — зависимости и каталог данных', () => {
    expect(file('.gitignore')).toBe('node_modules/\ndata/\n');
  });

  it('tsconfig — как у пакета, include src и scripts', () => {
    const tsconfig = json('tsconfig.json');

    expect(tsconfig.include).toEqual(['src', 'scripts']);
    expect(tsconfig.compilerOptions).toMatchObject({
      strict: true,
      noEmit: true,
      moduleResolution: 'bundler',
      verbatimModuleSyntax: true,
      noUncheckedIndexedAccess: true,
    });
  });

  it('dmg-core.json — значения CliConfig по умолчанию с корнем сборки, разбирается parse', () => {
    const config = new CliConfig(pkg);
    const data = json('dmg-core.json');

    const defaults = config.defaults();
    expect(data).toEqual({
      ...defaults,
      gen: { ...defaults.gen, compositionRoot: 'src/app' },
    });
    expect(config.parse(data).gen).toEqual({
      domain: 'src/domain/{m}',
      app: 'src/app/{m}',
      compositionRoot: 'src/app',
    });
  });

  it('arch-check.ts — раскладка из GenLayout, корень сборки и раннер', () => {
    const src = file('scripts/arch-check.ts');

    expect(src).toContain("import { GenLayout } from 'dmg-core/gen'");
    expect(src).toContain('await GenLayout.read(');
    expect(src).toContain('layout: (m) => layout.module(m)');
    expect(src).toContain(
      "export const modules: ArchApp['modules'] = [\n  // gen:modules\n];",
    );
    expect(src).toContain("from 'dmg-core/gen';\n// gen:imports\n");
    expect(src).toContain("root: join(root, 'src/app')");
    expect(src).toContain("runners: [join(root, 'src/runner')]");
    expect(src).toContain(`name: '${NAME}'`);
    expect(src).toContain('reportArchCheck(');
    expect(src).toContain("strict: process.argv.includes('--strict')");
  });

  it('app.ts — маркеры подключения модулей для gen module/aggregate', () => {
    const src = file('src/app/app.ts');

    expect(src).toContain("from './app-caller-resolver';\n// gen:imports\n");
    expect(src).toContain(
      'const modules: ModuleFactory<AppUser>[] = [\n      // gen:modules\n    ];',
    );
  });

  it('biome.json — каталог данных вне проверки: запуск раннера не ломает check', () => {
    expect(json('biome.json').files).toEqual({
      ignoreUnknown: true,
      includes: ['**', '!!data'],
    });
  });

  it('biome.json — схема версии biome пакета', () => {
    expect(json('biome.json').$schema).toBe(
      `https://biomejs.dev/schemas/${pkg.devDependencies['@biomejs/biome']}/schema.json`,
    );
  });
});

describe('ProjectScaffold single: применение', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scaffold-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('план записывается во временный каталог целиком', () => {
    const res = applyPlan(plan(dir), { write: true });

    expect(res.written).toHaveLength(SINGLE_FILES.length);
    for (const path of SINGLE_FILES) {
      expect(existsSync(join(dir, path))).toBe(true);
    }
  });

  it('без write план ничего не пишет', () => {
    applyPlan(plan(dir), { write: false });

    expect(readdirSync(dir)).toEqual([]);
  });

  it('повтор — ошибка коллизии, ничего не записано', () => {
    applyPlan(plan(dir), { write: true });
    rmSync(join(dir, 'src/runner'), { recursive: true });

    expect(() => applyPlan(plan(dir), { write: true })).toThrow(GenError);
    expect(existsSync(join(dir, 'src/runner'))).toBe(false);
  });
});
