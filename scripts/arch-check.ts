/**
 * Контрактные проверки архитектуры (TST-06): граф Def и файлы модулей.
 *
 *   bun run arch:check
 *
 * Каждое нарушение — строка, начинающаяся с ID правила из
 * `conductor/architecture/rules.md`. Код выхода 1, если нарушения есть.
 */

import { readdirSync } from 'node:fs';
import { Glob } from 'bun';
import {
  type ArchApp,
  archCheck,
  checkDefs,
  formatViolation,
} from 'dmg-core/arch';
import { indexDefs } from 'dmg-core/graph';
import { ExampleArch } from 'dmg-core/testing';
import { DEBT_MD, DOMAIN_MODULES } from './domain-arch';
import {
  checkContractImports,
  checkDebt,
  checkDomainDirs,
  checkDomainGraph,
  checkDomainImports,
  type DomainFile,
  domainGraphOf,
} from './domain-check';

/**
 * Приложения под проверкой по Def. Модули `@u7-scl/domain` проверяет
 * `runDomainCheck`: Def — `checkDefs`, импорты и граф — правилами проекта
 * (DEBT-33).
 */
export const ARCH_APPS: readonly ArchApp[] = [ExampleArch];

/** Проверить приложения, напечатать отчёт; вернуть код выхода. */
export function runArchCheck(
  apps: readonly ArchApp[],
  print: (line: string) => void,
): number {
  let total = 0;
  for (const app of apps) {
    const violations = archCheck(app);
    print(`arch:check ${app.name}: нарушений — ${violations.length}`);
    for (const v of violations) print(formatViolation(v));
    total += violations.length;
  }
  print(
    total === 0
      ? 'arch:check: нарушений нет'
      : `arch:check: нарушений — ${total}`,
  );
  return total === 0 ? 0 : 1;
}

/**
 * Исходники для проверок домена и долга: все пакеты и скрипты (без тестов
 * скриптов — в них маркеры долга встречаются как данные).
 */
export async function readPackageSources(root = '.'): Promise<DomainFile[]> {
  const files: DomainFile[] = [];
  for (const pattern of ['packages/*/src/**/*.ts', 'scripts/**/*.ts']) {
    for await (const path of new Glob(pattern).scan(root)) {
      if (path.startsWith('scripts/') && path.endsWith('.test.ts')) continue;
      files.push({ path, text: await Bun.file(`${root}/${path}`).text() });
    }
  }
  return files;
}

/** Исходники приложений для ARC-04 (D-45): код и тесты `apps/*`. */
async function readAppSources(root: string): Promise<DomainFile[]> {
  const files: DomainFile[] = [];
  for (const pattern of [
    'apps/*/src/**/*.{ts,tsx}',
    'apps/*/tests/**/*.{ts,tsx}',
  ]) {
    for await (const path of new Glob(pattern).scan(root)) {
      files.push({ path, text: await Bun.file(`${root}/${path}`).text() });
    }
  }
  return files;
}

/** Проверки домена: Def, импорты, граф, долг. Возвращает строки нарушений. */
export async function runDomainCheck(root = '.'): Promise<string[]> {
  const code = await readPackageSources(root);
  const debtMd = await Bun.file(`${root}/${DEBT_MD}`).text();
  const graph = domainGraphOf(DOMAIN_MODULES);
  const dirs = readdirSync(`${root}/packages/domain/src`, {
    withFileTypes: true,
  })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const modules = {
    all: DOMAIN_MODULES.map((m) => m.name),
    dmg: DOMAIN_MODULES.filter((m) => !m.external).map((m) => m.name),
  };
  return [
    ...checkDefs(indexDefs(DOMAIN_MODULES)).map(formatViolation),
    ...checkContractImports(
      [...code, ...(await readAppSources(root))],
      modules,
    ),
    ...checkDomainDirs(dirs, graph),
    ...checkDomainGraph(graph),
    ...checkDomainImports(code, graph),
    ...checkDebt({ code, debtMd }),
  ];
}

if (import.meta.main) {
  const code = runArchCheck(ARCH_APPS, console.log);
  const domain = await runDomainCheck();
  console.log(`arch:check domain: нарушений — ${domain.length}`);
  for (const line of domain) console.log(line);
  process.exit(code === 0 && domain.length === 0 ? 0 : 1);
}
