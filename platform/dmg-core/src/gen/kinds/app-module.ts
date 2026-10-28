/**
 * `gen module <m>` — прикладной слой модуля (naming.md §3): карта модуля,
 * её тест и вход `index.ts` для корня сборки (D-52). Пакет workspaces —
 * `module-package` (только при `gen.package`). К приложению модуль
 * подключается руками — по подсказкам `notes`.
 */
import { join } from 'node:path';
import type { GenArgs } from '../cli';
import { sortImports } from '../import-order';
import { toCamel, toPascal } from '../naming';
import type { GenPlan } from '../plan';

export function planAppModule(args: GenArgs): GenPlan {
  const { module: m } = args;
  const P = toPascal(m);
  const c = toCamel(m);
  const src = args.layout.appDir(m);
  const domain = args.layout.domainImport(m, src);

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
    edits: [],
    notes: wiringNotes(args),
  };
}

/**
 * Подключение модуля к приложению — руками (маркеров в корне сборки нет):
 * фабрика в список модулей, корень Def в `arch:check`, у пакета модуля —
 * зависимость корня сборки и `bun install`.
 */
function wiringNotes(args: GenArgs): string[] {
  const { module: m, layout } = args;
  const P = toPascal(m);
  const pkg = layout.package(m);
  const entry = pkg ? `'${pkg.name}'` : `${layout.appDir(m)}/index.ts`;
  const contract = layout.hasDomainImport()
    ? `'${layout.domainImport(m, '.')}/contract'`
    : `${layout.domainDir(m)}/contract.ts`;
  return [
    `Вставь вручную — подключение модуля ${m} к приложению:`,
    '  корень сборки, список модулей (репозитории — в create вместе с deps):',
    `    { def: ${P}ModuleDef, create: (deps) => create${P}Module({ ...deps }) }`,
    `    create${P}Module — из входа ${entry}, ${P}ModuleDef — из ${contract}`,
    `  scripts/arch-check.ts, modules: ${P}ModuleDef (из ${contract})`,
    ...(pkg
      ? [
          `  package.json корня сборки, dependencies: "${pkg.name}": "workspace:*", затем bun install`,
        ]
      : []),
  ];
}
