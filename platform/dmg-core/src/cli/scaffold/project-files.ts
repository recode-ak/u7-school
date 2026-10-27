import { CliConfig } from '../cli-config';
import type { Dependencies, PackageSource } from '../package-source';
import type { LintMap } from './lint-map';
import type { ScaffoldFile } from './project-scaffold.types';

/** Зависимости проекта из `peerDependencies` пакета (кроме самого dmg-core). */
const PEERS = ['valibot', '@valibot/to-json-schema'];

/** Инструменты `check` проекта из `devDependencies` пакета. */
const TOOLS = ['@biomejs/biome', 'typescript', '@types/bun'];

/** Ширина строки форматтера biome по умолчанию. */
const LINE_WIDTH = 80;

/**
 * Конфиги корня проекта: `.gitignore` (зависимости и каталог данных
 * `APP_DATA_DIR=data`), `package.json` (скрипты `check`, версии из пакета),
 * `tsconfig.json`, `biome.json` (по карте линтера), `dmg-core.json`
 * (значения `CliConfig` по умолчанию) и `scripts/arch-check.ts` (раскладка
 * из `GenLayout`). Пути — от корня проекта.
 */
export class ProjectFiles {
  constructor(
    private readonly name: string,
    private readonly pkg: PackageSource,
    private readonly lint: LintMap,
  ) {}

  files(): ScaffoldFile[] {
    return [
      { path: '.gitignore', content: 'node_modules/\ndata/\n' },
      { path: 'package.json', content: this.json(this.packageJson()) },
      { path: 'tsconfig.json', content: this.json(this.tsconfig()) },
      { path: 'biome.json', content: this.json(this.biome()) },
      {
        path: CliConfig.file,
        content: this.json(new CliConfig(this.pkg).defaults()),
      },
      { path: 'scripts/arch-check.ts', content: this.archCheck() },
    ];
  }

  private packageJson(): object {
    return {
      name: this.name,
      private: true,
      type: 'module',
      scripts: {
        'arch:check': 'bun scripts/arch-check.ts',
        check:
          'dmg-core sync --check && biome check . && tsc --noEmit && bun run arch:check && bun test',
        lint: 'biome check .',
        format: 'biome check . --write',
      },
      dependencies: {
        'dmg-core': `^${this.pkg.version}`,
        ...this.versions(this.pkg.peerDependencies, PEERS, 'peerDependencies'),
      },
      devDependencies: this.versions(
        this.pkg.devDependencies,
        TOOLS,
        'devDependencies',
      ),
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
      include: ['src', 'scripts'],
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
        ...this.lint.overrides(),
      ],
    };
  }

  private archCheck(): string {
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
  // Корни Def — модули, которые собирает src/app/app.ts; их зависимости
  // по dependsOn проверяются сами.
  modules: [],
  layout: (m) => layout.module(m),
  root: join(root, 'src/app'),
  runners: [join(root, 'src/runner')],
};

process.exitCode = reportArchCheck([app], (line) => console.log(line));
`;
  }

  /**
   * JSON в форме biome: объекты раскрыты, массив простых значений —
   * в одну строку, если она укладывается в ширину строки форматтера.
   */
  private json(data: object): string {
    const text = JSON.stringify(data, null, 2).replace(
      /^(.*)\[\n([^[\]{}]*?)\n\s*\](,?)$/gm,
      (whole, head: string, items: string, comma: string) => {
        const values = items.split('\n').map((item) => item.trim());
        const line = `${head}[${values.join(' ')}]${comma}`;
        return line.length <= LINE_WIDTH ? line : whole;
      },
    );
    return `${text}\n`;
  }
}
