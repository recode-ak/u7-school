import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPlan } from '../../gen/apply';
import type { GenPlan } from '../../gen/plan';
import { CliConfig } from '../cli-config';
import { PackageSource } from '../package-source';
import { ProjectScaffold } from './project-scaffold';

// Каркас проекта `monorepo` — план файлов: корень с workspaces, пакеты
// домена, корня сборки и раннера CLI; конфиги и применение `applyPlan`.

const PACKAGE_ROOT = join(import.meta.dir, '../../..');
const NAME = 'acme';

const MONOREPO_FILES = [
  '.gitignore',
  'package.json',
  'tsconfig.json',
  'biome.json',
  'dmg-core.json',
  'scripts/arch-check.ts',
  'domain/package.json',
  'domain/tsconfig.json',
  'domain/src/index.ts',
  'domain/src/shared/index.ts',
  'domain/src/shared/app-user.ts',
  'app/package.json',
  'app/tsconfig.json',
  'app/src/index.ts',
  'app/src/app.ts',
  'app/src/app.types.ts',
  'app/src/app-caller-resolver.ts',
  'app/src/app.test.ts',
  'runners/cli/package.json',
  'runners/cli/tsconfig.json',
  'runners/cli/src/main.ts',
  'runners/cli/src/main.test.ts',
  'runners/cli/src/runner-cli.ts',
  'runners/cli/src/runner-cli.types.ts',
  'runners/cli/src/runner-cli.test.ts',
  'runners/cli/src/runner-env.ts',
  'runners/cli/src/runner-env.types.ts',
  'runners/cli/src/runner-env.test.ts',
];

let pkg: PackageSource;
beforeAll(async () => {
  pkg = await PackageSource.load(PACKAGE_ROOT);
});

function plan(name = NAME, root?: string): GenPlan {
  return new ProjectScaffold({ profile: 'monorepo', name, pkg, root }).plan();
}

function file(path: string, name = NAME): string {
  const found = plan(name).files.find((f) => f.path === path);
  if (found === undefined) throw new Error(`Нет файла в плане: ${path}`);
  return found.content;
}

function json(path: string, name = NAME) {
  return JSON.parse(file(path, name));
}

describe('ProjectScaffold monorepo: состав плана', () => {
  it('все файлы каркаса, правок нет; каталога modules в плане нет', () => {
    const res = plan();

    expect(res.files.map((f) => f.path).sort()).toEqual(
      [...MONOREPO_FILES].sort(),
    );
    expect(res.edits).toEqual([]);
  });

  it('пути — от переданного root', () => {
    const paths = plan(NAME, '/work/acme').files.map((f) => f.path);

    expect(paths).toContain('/work/acme/runners/cli/src/main.ts');
    expect(paths.every((p) => p.startsWith('/work/acme/'))).toBe(true);
  });
});

describe('ProjectScaffold monorepo: scope пакетов', () => {
  it('имя без scope: acme → @acme/*', () => {
    expect(json('package.json').name).toBe('acme');
    expect(json('domain/package.json').name).toBe('@acme/domain');
    expect(json('app/package.json').name).toBe('@acme/app');
    expect(json('runners/cli/package.json').name).toBe('@acme/cli');
  });

  it('имя со scope: @acme/school → @acme/*, корень — имя как есть', () => {
    const name = '@acme/school';

    expect(json('package.json', name).name).toBe('@acme/school');
    expect(json('domain/package.json', name).name).toBe('@acme/domain');
    expect(json('runners/cli/package.json', name).name).toBe('@acme/cli');
  });
});

describe('ProjectScaffold monorepo: package.json', () => {
  it('корень: private, type module, workspaces, скрипты check', () => {
    expect(json('package.json')).toMatchObject({
      private: true,
      type: 'module',
      workspaces: ['domain', 'app', 'modules/*', 'runners/*'],
      scripts: {
        'arch:check': 'bun scripts/arch-check.ts',
        check:
          'dmg-core sync --check && biome check . && tsc --noEmit && bun run arch:check && bun test',
        lint: 'biome check .',
        format: 'biome check . --write',
      },
    });
  });

  it('корень: dmg-core, его peer-зависимости и инструменты check — dev', () => {
    const manifest = json('package.json');

    expect(manifest.dependencies).toBeUndefined();
    expect(manifest.devDependencies).toEqual({
      'dmg-core': `^${pkg.version}`,
      valibot: pkg.peerDependencies.valibot,
      '@valibot/to-json-schema':
        pkg.peerDependencies['@valibot/to-json-schema'],
      '@biomejs/biome': pkg.devDependencies['@biomejs/biome'],
      typescript: pkg.devDependencies.typescript,
      '@types/bun': pkg.devDependencies['@types/bun'],
    });
  });

  it('домен: exports входов модулей, зависимости dmg-core и valibot', () => {
    expect(json('domain/package.json')).toEqual({
      name: '@acme/domain',
      private: true,
      type: 'module',
      exports: {
        '.': './src/index.ts',
        './*/contract': './src/*/contract.ts',
        './*': './src/*/index.ts',
      },
      scripts: { test: 'bun test --pass-with-no-tests' },
      dependencies: {
        'dmg-core': `^${pkg.version}`,
        valibot: pkg.peerDependencies.valibot,
      },
    });
  });

  it('корень сборки: вход src/index.ts, домен — workspace:*', () => {
    expect(json('app/package.json')).toEqual({
      name: '@acme/app',
      private: true,
      type: 'module',
      exports: { '.': './src/index.ts' },
      scripts: { test: 'bun test --pass-with-no-tests' },
      dependencies: {
        'dmg-core': `^${pkg.version}`,
        '@acme/domain': 'workspace:*',
      },
    });
  });

  it('раннер CLI: домен и корень сборки — workspace:*', () => {
    expect(json('runners/cli/package.json')).toEqual({
      name: '@acme/cli',
      private: true,
      type: 'module',
      scripts: { test: 'bun test --pass-with-no-tests' },
      dependencies: {
        'dmg-core': `^${pkg.version}`,
        '@acme/domain': 'workspace:*',
        '@acme/app': 'workspace:*',
      },
    });
  });
});

describe('ProjectScaffold monorepo: tsconfig', () => {
  it('корень: src всех пакетов и scripts', () => {
    const tsconfig = json('tsconfig.json');

    expect(tsconfig.include).toEqual([
      'domain/src',
      'app/src',
      'modules/*/src',
      'runners/*/src',
      'scripts',
    ]);
    expect(tsconfig.compilerOptions).toMatchObject({
      strict: true,
      noEmit: true,
      moduleResolution: 'bundler',
    });
  });

  it('пакеты: extends корневого, include src', () => {
    for (const dir of ['domain', 'app']) {
      expect(json(`${dir}/tsconfig.json`)).toEqual({
        extends: '../tsconfig.json',
        include: ['src'],
      });
    }
    expect(json('runners/cli/tsconfig.json')).toEqual({
      extends: '../../tsconfig.json',
      include: ['src'],
    });
  });
});

describe('ProjectScaffold monorepo: прочие конфиги', () => {
  it('dmg-core.json — раскладка gen пакетов (с package) и разбирается parse', () => {
    const config = new CliConfig(pkg);
    const data = json('dmg-core.json');
    const gen = {
      domain: 'domain/src/{m}',
      app: 'modules/{m}/src',
      domainImport: '@acme/domain/{m}',
      package: '@acme/{m}',
    };

    expect(data).toEqual({ ...config.defaults(), gen });
    expect(config.parse(data).gen).toEqual(gen);
  });

  it('arch-check.ts — корень сборки app/src, раннер runners/cli/src', () => {
    const src = file('scripts/arch-check.ts');

    expect(src).toContain('await GenLayout.read(');
    expect(src).toContain('modules: []');
    expect(src).toContain("root: join(root, 'app/src')");
    expect(src).toContain("runners: [join(root, 'runners/cli/src')]");
    expect(src).toContain(`name: '${NAME}'`);
  });

  it('biome.json — плагины на каталогах пакетов', () => {
    const overrides: { includes: string[]; plugins?: string[] }[] =
      json('biome.json').overrides;
    const includesOf = (plugin: string) =>
      overrides.find((o) => o.plugins?.some((p) => p.endsWith(`/${plugin}`)))
        ?.includes;

    expect(includesOf('dom-14-no-clock.grit')).toEqual([
      'domain/src/**',
      '!**/*.test.ts',
    ]);
    expect(includesOf('arc-09-no-env.grit')).toEqual([
      'domain/src/**',
      'app/src/**',
      'modules/*/src/**',
      'runners/*/src/**',
      '!runners/*/src/main.ts',
      '!**/*.test.ts',
    ]);
    expect(includesOf('err-01-no-throw.grit')).toContain(
      'modules/*/src/**/*.uc.ts',
    );
  });
});

describe('ProjectScaffold monorepo: исходники', () => {
  it('тип пользователя — из пакета домена, корень сборки — из @acme/app', () => {
    expect(file('app/src/app.ts')).toContain(
      "import type { AppUser } from '@acme/domain/shared';",
    );
    expect(file('runners/cli/src/main.ts')).toContain(
      "import { App, type AppEnv } from '@acme/app';",
    );
    expect(file('runners/cli/src/runner-cli.ts')).toContain(
      "import type { App } from '@acme/app';",
    );
  });

  it('входы пакетов реэкспортируют их API', () => {
    expect(file('domain/src/shared/index.ts')).toContain(
      "export type { AppUser } from './app-user';",
    );
    expect(file('app/src/index.ts')).toContain("export { App } from './app';");
  });
});

describe('ProjectScaffold monorepo: применение', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'scaffold-monorepo-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('план записывается во временный каталог целиком', () => {
    const res = applyPlan(plan(NAME, dir), { write: true });

    expect(res.written).toHaveLength(MONOREPO_FILES.length);
    for (const path of MONOREPO_FILES) {
      expect(existsSync(join(dir, path))).toBe(true);
    }
  });
});
