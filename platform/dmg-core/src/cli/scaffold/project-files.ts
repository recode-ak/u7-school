import { PACKAGE_TEST } from '../../gen/kinds/module-package';
import { CliConfig } from '../cli-config';
import type { Dependencies, PackageSource } from '../package-source';
import type {
  ScaffoldFile,
  ScaffoldLayoutData,
  ScaffoldPackage,
} from './project-scaffold.types';
import type { ScaffoldLayout } from './scaffold-layout';

/** Зависимости проекта из `peerDependencies` пакета (кроме самого dmg-core). */
const PEERS = ['valibot', '@valibot/to-json-schema'];

/** Инструменты `check` проекта из `devDependencies` пакета. */
const TOOLS = ['@biomejs/biome', 'typescript', '@types/bun'];

/** Ширина строки форматтера biome по умолчанию — для всех шаблонов каркаса. */
export const LINE_WIDTH = 80;

/**
 * Конфиги проекта. Корень: `.gitignore` (зависимости и каталог данных
 * `APP_DATA_DIR=data`), `package.json` (скрипты `check`, версии из пакета;
 * у monorepo — workspaces), `tsconfig.json`, `biome.json` (по карте
 * линтера), `dmg-core.json` (значения `CliConfig` по умолчанию, `gen` —
 * раскладка профиля) и `scripts/arch-check.ts` (раскладка из `GenLayout`).
 * Пакеты workspaces: `package.json` (зависимости, `workspace:*`) и
 * `tsconfig.json` поверх корневого. Пути — от корня проекта.
 */
export class ProjectFiles {
  private readonly layout: ScaffoldLayoutData;

  constructor(
    private readonly name: string,
    private readonly pkg: PackageSource,
    layout: ScaffoldLayout,
  ) {
    this.layout = layout.data;
  }

  files(): ScaffoldFile[] {
    return [
      ...this.root(),
      ...this.layout.packages.flatMap((p) => this.packageFiles(p)),
    ];
  }

  private root(): ScaffoldFile[] {
    return [
      { path: '.gitignore', content: 'node_modules/\ndata/\n' },
      { path: 'package.json', content: this.manifest(this.packageJson()) },
      { path: 'tsconfig.json', content: this.json(this.tsconfig()) },
      { path: 'biome.json', content: this.json(this.biome()) },
      {
        path: CliConfig.file,
        content: this.json({
          ...new CliConfig(this.pkg).defaults(),
          gen: this.layout.gen,
        }),
      },
      { path: 'scripts/arch-check.ts', content: this.archCheck() },
    ];
  }

  private packageFiles(p: ScaffoldPackage): ScaffoldFile[] {
    const up = p.dir
      .split('/')
      .map(() => '..')
      .join('/');
    const workspace: Record<string, string> = {};
    for (const name of p.workspace) workspace[name] = 'workspace:*';
    const manifest = {
      name: p.name,
      private: true,
      type: 'module',
      ...(p.exports === undefined ? {} : { exports: p.exports }),
      scripts: { test: PACKAGE_TEST },
      dependencies: { ...this.dependencies(p.dependencies), ...workspace },
    };
    return [
      { path: `${p.dir}/package.json`, content: this.manifest(manifest) },
      {
        path: `${p.dir}/tsconfig.json`,
        content: this.json({
          extends: `${up}/tsconfig.json`,
          include: ['src'],
        }),
      },
    ];
  }

  /** Версии внешних зависимостей: dmg-core — версия пакета, прочие — его peer. */
  private dependencies(names: readonly string[]): Record<string, string> {
    const peers = names.filter((name) => name !== 'dmg-core');
    return {
      ...(names.includes('dmg-core')
        ? { 'dmg-core': `^${this.pkg.version}` }
        : {}),
      ...this.versions(this.pkg.peerDependencies, peers, 'peerDependencies'),
    };
  }

  private packageJson(): object {
    const dependencies = this.dependencies(['dmg-core', ...PEERS]);
    const tools = this.versions(
      this.pkg.devDependencies,
      TOOLS,
      'devDependencies',
    );
    // Корень workspaces ничего не исполняет сам: dmg-core (бинарь
    // `dmg-core sync`, плагины biome, `arch:check`) с его peer-зависимостями
    // и инструменты check — dev; пакеты объявляют свои зависимости сами.
    const workspaces = this.layout.workspaces;
    return {
      name: this.name,
      private: true,
      type: 'module',
      ...(workspaces === undefined ? {} : { workspaces }),
      scripts: {
        'arch:check': 'bun scripts/arch-check.ts',
        check:
          'dmg-core sync --check && biome check . && tsc --noEmit && bun run arch:check && bun test',
        lint: 'biome check .',
        format: 'biome check . --write',
      },
      ...(workspaces === undefined
        ? { dependencies, devDependencies: tools }
        : { devDependencies: { ...dependencies, ...tools } }),
    };
  }

  /** Версии `names` из секции пакета; нет версии — дефект поставки пакета. */
  private versions(
    from: Dependencies,
    names: readonly string[],
    section: string,
  ): Record<string, string> {
    const versions: Record<string, string> = {};
    for (const name of names) {
      const version = from[name];
      if (version === undefined) {
        throw new Error(`В ${section} пакета dmg-core нет версии ${name}`);
      }
      versions[name] = version;
    }
    return versions;
  }

  private tsconfig(): object {
    return {
      compilerOptions: {
        lib: ['ESNext'],
        target: 'ESNext',
        module: 'Preserve',
        moduleDetection: 'force',
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        verbatimModuleSyntax: true,
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        noFallthroughCasesInSwitch: true,
        noUncheckedIndexedAccess: true,
        noImplicitOverride: true,
        types: ['bun'],
      },
      include: this.layout.include,
    };
  }

  private biome(): object {
    const version = this.pkg.devDependencies['@biomejs/biome'];
    return {
      $schema: `https://biomejs.dev/schemas/${version}/schema.json`,
      root: true,
      vcs: { enabled: false },
      files: { ignoreUnknown: true },
      formatter: { enabled: true, indentStyle: 'space', indentWidth: 2 },
      linter: { enabled: true, rules: { preset: 'recommended' } },
      javascript: { formatter: { quoteStyle: 'single' } },
      assist: {
        enabled: true,
        actions: { source: { organizeImports: 'on' } },
      },
      overrides: [
        {
          includes: ['**/*.test.ts'],
          linter: {
            rules: {
              correctness: { noUnusedVariables: 'off' },
              suspicious: {
                noExplicitAny: 'off',
                noNonNullAssertedOptionalChain: 'off',
              },
              style: { noNonNullAssertion: 'off' },
            },
          },
        },
        ...this.layout.lint.overrides(),
      ],
    };
  }

  private archCheck(): string {
    const { app, runner } = this.layout;
    return `/**
 * \`bun run arch:check\` — контрактные проверки архитектуры (\`ArchChecker\`):
 * корни Def приложения, раскладка модулей из \`dmg-core.json\` (\`GenLayout\`),
 * корень сборки и раннер. Выход 1 — есть нарушения.
 */
import { join } from 'node:path';
import { type ArchApp, reportArchCheck } from 'dmg-core/arch';
import { GenLayout } from 'dmg-core/gen';

const root = join(import.meta.dir, '..');
const layout = await GenLayout.read(root);

const app: ArchApp = {
  name: '${this.name}',
  entry: 'contract',
  // Корни Def — модули, которые собирает ${app}/app.ts; их зависимости
  // по dependsOn проверяются сами.
  modules: [],
  layout: (m) => layout.module(m),
  root: join(root, '${app}'),
  runners: [join(root, '${runner}')],
};

process.exitCode = reportArchCheck([app], (line) => console.log(line));
`;
  }

  /**
   * JSON в форме biome: объекты раскрыты, массив простых значений —
   * в одну строку, если она укладывается в ширину строки форматтера.
   */
  private json(data: object): string {
    return this.manifest(data).replace(
      /^(.*)\[\n([^[\]{}]*?)\n\s*\](,?)$/gm,
      (whole, head: string, items: string, comma: string) => {
        const values = items.split('\n').map((item) => item.trim());
        const line = `${head}[${values.join(' ')}]${comma}`;
        return line.length <= LINE_WIDTH ? line : whole;
      },
    );
  }

  /** `package.json` в форме biome: массивы всегда раскрыты (как у npm). */
  private manifest(data: object): string {
    return `${JSON.stringify(data, null, 2)}\n`;
  }
}
