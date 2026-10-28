/**
 * `gen module <m>` с `gen.package` — пакет workspaces прикладного слоя
 * модуля над каталогом `src` (D-52): `package.json` с входом
 * `src/index.ts` и зависимостями, `tsconfig.json` поверх корневого. Без
 * `gen.package` пакета нет: заготовку пакета пишет проект.
 */
import { join } from 'node:path';
import { type GenArgs, PackageDefectError } from '../cli';
import type { GenPlan } from '../plan';

/** Внешние зависимости пакета модуля: платформа и схемы JSON-репозиториев. */
const EXTERNAL = ['dmg-core', 'valibot'];

/** Скрипт тестов пакета workspaces: пакет без тестов — не ошибка. */
export const PACKAGE_TEST = 'bun test --pass-with-no-tests';

export function planModulePackage(args: GenArgs): GenPlan {
  const pkg = args.layout.package(args.module);
  if (pkg === undefined) return { files: [], edits: [] };
  const dependencies: Record<string, string> = {};
  for (const name of EXTERNAL) {
    const version = args.dependencies?.[name];
    if (version === undefined) {
      throw new PackageDefectError(
        `gen.package: нет версии ${name} для пакета модуля`,
      );
    }
    dependencies[name] = version;
  }
  const manifest = {
    name: pkg.name,
    private: true,
    type: 'module',
    exports: { '.': './src/index.ts' },
    scripts: { test: PACKAGE_TEST },
    dependencies: { ...dependencies, [pkg.domain]: 'workspace:*' },
  };
  // Форма biome: короткий массив — в одну строку.
  const tsconfig = `{
  "extends": "${pkg.root}/tsconfig.json",
  "include": ["src"]
}
`;
  return {
    files: [
      {
        path: join(pkg.dir, 'package.json'),
        content: `${JSON.stringify(manifest, null, 2)}\n`,
      },
      { path: join(pkg.dir, 'tsconfig.json'), content: tsconfig },
    ],
    edits: [],
  };
}
