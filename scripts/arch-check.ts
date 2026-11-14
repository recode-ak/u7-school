/**
 * Контрактные проверки архитектуры (TST-06): граф Def и файлы модулей.
 *
 *   bun run arch:check
 *
 * Отчёт по приложениям — `reportArchCheck` пакета: каждое нарушение — строка
 * с ID правила, при нарушениях — путь к каталогу правил пакета. Код выхода 1,
 * если нарушения есть (по приложениям или проверкам домена).
 */

import { readdirSync } from 'node:fs';
import { Glob } from 'bun';
import {
  type ArchApp,
  ArchChecker,
  DebtChecker,
  type DebtLayout,
  RULES_DOC,
  reportArchCheck,
} from 'dmg-core/arch';
import { ExampleArch } from 'dmg-core/testing';
import { DEBT_MD, DOMAIN_MODULES, DomainArch } from './domain-arch';
import {
  checkContractImports,
  checkDomainDirs,
  checkDomainGraph,
  checkDomainImports,
  checkModuleImports,
  type DomainFile,
  domainGraphOf,
} from './domain-check';

/**
 * Приложения под проверкой по Def и файлам модулей. Правила проекта для
 * домена (импорты D-45, каталоги, граф, долг) — в `runDomainCheck`.
 */
export const ARCH_APPS: readonly ArchApp[] = [ExampleArch, DomainArch];

/**
 * Исходники проверок домена и долга: все пакеты и скрипты (без тестов
 * скриптов — в них маркеры долга встречаются как данные).
 */
const SOURCE_GLOBS = [
  '{platform,modules,authoring,runners}/*/src/**/*.ts',
  'domain/src/**/*.ts',
  'scripts/**/*.ts',
];
const SOURCE_EXCLUDE = 'scripts/**/*.test.ts';

/** Исходники по `SOURCE_GLOBS` без `SOURCE_EXCLUDE`. */
export async function readPackageSources(root = '.'): Promise<DomainFile[]> {
  const files: DomainFile[] = [];
  const excluded = new Glob(SOURCE_EXCLUDE);
  for (const pattern of SOURCE_GLOBS) {
    for await (const path of new Glob(pattern).scan(root)) {
      if (excluded.match(path)) continue;
      files.push({ path, text: await Bun.file(`${root}/${path}`).text() });
    }
  }
  return files;
}

/** Имена пакетов корня сборки и раннеров (`platform/app`, `runners/*`) — ARC-06. */
export async function assemblyPackages(root: string): Promise<string[]> {
  // Glob Bun не разворачивает `/` внутри `{…}` — корень и раннеры отдельно.
  const paths = ['platform/app/package.json'];
  for await (const path of new Glob('runners/*/package.json').scan(root)) {
    paths.push(path);
  }
  const names = await Promise.all(
    paths.map(async (p) => (await Bun.file(`${root}/${p}`).json()).name),
  );
  return names.sort();
}

/** Исходники приложений для ARC-04 (D-45): код и тесты `runners/*`. */
async function readAppSources(root: string): Promise<DomainFile[]> {
  const files: DomainFile[] = [];
  for (const pattern of [
    'runners/*/src/**/*.{ts,tsx}',
    'runners/*/tests/**/*.{ts,tsx}',
  ]) {
    for await (const path of new Glob(pattern).scan(root)) {
      files.push({ path, text: await Bun.file(`${root}/${path}`).text() });
    }
  }
  return files;
}

/**
 * Раскладка долга для `DebtChecker` (ARC-12): код — как в `readPackageSources`,
 * реестры — `conductor/debt/` (README долга).
 */
const DEBT_LAYOUT: DebtLayout = {
  code: SOURCE_GLOBS,
  exclude: [SOURCE_EXCLUDE],
  registries: {
    code: DEBT_MD,
    tests: 'conductor/debt/tests.md',
    product: 'conductor/debt/product.md',
  },
};

/** Проверка долга пакета: префикс `C-DEBT`, маркеры временности в `scripts/` не ищутся. */
const DEBT_CHECKER = new DebtChecker({
  idPrefix: 'C-DEBT',
  tempMarkers: { skip: ['scripts/**'] },
  registryPaths: DEBT_LAYOUT.registries,
});

/** Сверка кода с реестрами долга `conductor/debt/` (`DebtChecker` пакета). */
export async function runDebtCheck(root = '.'): Promise<string[]> {
  return DEBT_CHECKER.report(await DebtChecker.read(root, DEBT_LAYOUT));
}

/**
 * Проверки домена: Def, импорты домена и прикладных пакетов, граф, долг.
 * Возвращает строки нарушений.
 */
export async function runDomainCheck(root = '.'): Promise<string[]> {
  const code = await readPackageSources(root);
  const appCode = await readAppSources(root);
  const graph = domainGraphOf(DOMAIN_MODULES);
  const dirs = readdirSync(`${root}/domain/src`, {
    withFileTypes: true,
  })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const modules = DOMAIN_MODULES.map((m) => m.name);
  return [
    ...ArchChecker.defsOf(DOMAIN_MODULES).report(),
    ...checkContractImports([...code, ...appCode], modules),
    ...checkDomainDirs(dirs, graph),
    ...checkDomainGraph(graph),
    ...checkDomainImports(code, graph),
    ...checkModuleImports(code, await assemblyPackages(root)),
    ...(await runDebtCheck(root)),
  ];
}

if (import.meta.main) {
  const code = reportArchCheck(ARCH_APPS, console.log);
  const domain = await runDomainCheck();
  console.log(`arch:check domain: нарушений — ${domain.length}`);
  for (const line of domain) console.log(line);
  // reportArchCheck уже напечатал ссылку, если нарушения были у приложений.
  if (domain.length > 0 && code === 0)
    console.log(`Правила по ID: ${RULES_DOC}`);
  process.exit(code === 0 && domain.length === 0 ? 0 : 1);
}
