/** `gen module <m>` — прикладной слой `packages/<m>` (naming.md §3). */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { GenArgs } from '../cli.ts';
import { toCamel, toPascal } from '../naming.ts';
import type { GenPlan, PlannedFile } from '../plan.ts';

export function planAppModule(args: GenArgs): GenPlan {
  const { module: m } = args;
  const P = toPascal(m);
  const c = toCamel(m);
  const pkgDir = join(args.packagesRoot, m);
  const src = join(pkgDir, 'src');
  const isNewPackage = !existsSync(join(pkgDir, 'package.json'));

  const packageJson = `${JSON.stringify(
    {
      name: `@u7-scl/${m}`,
      version: '0.1.0',
      module: 'src/index.ts',
      type: 'module',
      private: true,
      scripts: {
        test: 'bun test',
        lint: 'bunx biome check .',
        tslint: 'tsc --noEmit',
        format: 'bunx biome check . --write',
        check: 'bun run lint && bun run tslint && bun test',
      },
      dependencies: {
        '@u7-scl/domain': 'workspace:*',
        'dmg-core': 'workspace:*',
      },
      exports: { '.': './src/index.ts' },
    },
    undefined,
    2,
  )}\n`;

  const tsconfig = `{
  "extends": "../../tsconfig.json",
  "compilerOptions": {}
}
`;

  const indexSrc = `export { create${P}Module, type ${P}Deps } from './${m}.module';
`;

  const moduleSrc = `import { ${P}ModuleDef } from '@u7-scl/domain/${m}';
import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';
import { ${c}Facade } from './${m}.facade';
// gen:defs:imports

/** Резолвер модуля: платформа + репозитории. */
export type ${P}Deps = ModuleDeps & {
  // gen:deps
};

/** Карта «Def → класс» модуля ${m} (API-05). */
export const ${c}Map = {
  useCases: {
    // gen:defs:useCases
  },
  reactions: {
    // gen:defs:reactions
  },
  jobs: {
    // gen:defs:jobs
  },
  facade: ${c}Facade,
} satisfies ModuleMap<typeof ${P}ModuleDef, ${P}Deps, unknown>;

/** Модуль ${m} с зависимостями — для сборки приложения. */
export function create${P}Module(deps: ${P}Deps) {
  return new ModuleFromDef<typeof ${P}ModuleDef, ${P}Deps, unknown>(
    ${P}ModuleDef,
    ${c}Map,
    deps,
  );
}
`;

  const facadeSrc = `import { ${P}FacadeDef } from '@u7-scl/domain/${m}';
import { implementFacade } from 'dmg-core/app';
import type { ${P}Deps } from './${m}.module';

/** In-proc реализация фасада модуля (API-04). */
export function ${c}Facade(_deps: ${P}Deps) {
  return implementFacade(${P}FacadeDef, {});
}
`;

  const testSrc = `import { describe, expect, it } from 'bun:test';
import { testAppContext } from 'dmg-core/testing';
import { create${P}Module, type ${P}Deps } from './${m}.module';

describe('create${P}Module', () => {
  it('собирает модуль по карте Def', () => {
    const { app } = testAppContext();
    const deps = { app } as ${P}Deps;
    expect(create${P}Module(deps).def.name).toBe('${m}');
  });
});
`;

  const file = (path: string, content: string): PlannedFile => ({
    path,
    content,
  });
  return {
    files: [
      ...(isNewPackage
        ? [
            file(join(pkgDir, 'package.json'), packageJson),
            file(join(pkgDir, 'tsconfig.json'), tsconfig),
            file(join(src, 'index.ts'), indexSrc),
          ]
        : []),
      file(join(src, `${m}.module.ts`), moduleSrc),
      file(join(src, `${m}.facade.ts`), facadeSrc),
      file(join(src, `${m}.module.test.ts`), testSrc),
    ],
    edits: [],
  };
}
