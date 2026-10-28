/**
 * `gen module <m>` — прикладной слой модуля (naming.md §3): карта модуля,
 * её тест и вход `index.ts` для корня сборки (D-52). Пакет workspaces —
 * `module-package` (только при `gen.package`). К приложению модуль
 * подключается по маркерам каркаса — `AppWiring`.
 */
import { join } from 'node:path';
import type { GenArgs } from '../cli';
import { sortImports } from '../import-order';
import { toCamel, toPascal } from '../naming';
import type { GenPlan } from '../plan';
import { AppWiring } from './app-wiring';

export function planAppModule(args: GenArgs): GenPlan {
  const { module: m } = args;
  const P = toPascal(m);
  const c = toCamel(m);
  const src = args.layout.appDir(m);
  const domain = args.layout.domainImport(m, src);
  const wiring = new AppWiring(args);

  const moduleSrc = `${sortImports([
    `import { ${P}ModuleDef } from '${domain}';`,
    "import type { Identified } from 'dmg-core';",
    "import { type ModuleDeps, ModuleFromDef, type ModuleMap } from 'dmg-core/app';",
  ])}
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
} satisfies ModuleMap<typeof ${P}ModuleDef, ${P}Deps, Identified>;

/** Модуль ${m} с зависимостями — для сборки приложения. */
export function create${P}Module(deps: ${P}Deps) {
  return new ModuleFromDef<typeof ${P}ModuleDef, ${P}Deps, Identified>(
    ${P}ModuleDef,
    ${c}Map,
    deps,
  );
}
`;

  const testSrc = `import { describe, expect, it } from 'bun:test';
import { ModuleFacades } from 'dmg-core/app';
import { testAppContext } from 'dmg-core/testing';
import { create${P}Module, type ${P}Deps } from './${m}.module';

describe('create${P}Module', () => {
  it('собирает модуль по карте Def', () => {
    const { app } = testAppContext();
    const deps = { app, facades: new ModuleFacades() } as ${P}Deps;
    expect(create${P}Module(deps).def.name).toBe('${m}');
  });
});
`;

  // Вход пополняет `gen aggregate` (репозитории) по маркеру.
  const indexSrc = `// Вход прикладного пакета ${m} для корня сборки (ARC-07, D-52): фабрика
// модуля и репозитории. UC, ER и Job снаружи не видны.
export { create${P}Module, type ${P}Deps } from './${m}.module';
// gen:exports
`;

  return {
    files: [
      { path: join(src, `${m}.module.ts`), content: moduleSrc },
      { path: join(src, `${m}.module.test.ts`), content: testSrc },
      { path: join(src, 'index.ts'), content: indexSrc },
    ],
    edits: wiring.moduleEdits(),
    dependencies: wiring.moduleDependencies(),
    notes: wiring.moduleNotes(),
  };
}
