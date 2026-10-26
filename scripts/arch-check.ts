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
  checkDefs,
  formatViolation,
  RULES_DOC,
  reportArchCheck,
} from 'dmg-core/arch';
import { indexDefs } from 'dmg-core/graph';
import { ExampleArch } from 'dmg-core/testing';
import { DEBT_MD, DOMAIN_MODULES, DomainArch } from './domain-arch';
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
 * Приложения под проверкой по Def и файлам модулей. Правила проекта для
 * домена (импорты D-45, каталоги, граф, долг) — в `runDomainCheck`.
 */
export const ARCH_APPS: readonly ArchApp[] = [ExampleArch, DomainArch];

/**
 * Исходники для проверок домена и долга: все пакеты и скрипты (без тестов
 * скриптов — в них маркеры долга встречаются как данные).
 */
export async function readPackageSources(root = '.'): Promise<DomainFile[]> {
  const files: DomainFile[] = [];
  for (const pattern of [
    '{platform,modules,authoring}/*/src/**/*.ts',
    'domain/src/**/*.ts',
    'scripts/**/*.ts',
  ]) {
    for await (const path of new Glob(pattern).scan(root)) {
      if (path.startsWith('scripts/') && path.endsWith('.test.ts')) continue;
      files.push({ path, text: await Bun.file(`${root}/${path}`).text() });
    }
  }
  return files;
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

/** Проверки домена: Def, импорты, граф, долг. Возвращает строки нарушений. */
export async function runDomainCheck(root = '.'): Promise<string[]> {
  const code = await readPackageSources(root);
  const debtMd = await Bun.file(`${root}/${DEBT_MD}`).text();
  const graph = domainGraphOf(DOMAIN_MODULES);
  const dirs = readdirSync(`${root}/domain/src`, {
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
  const code = reportArchCheck(ARCH_APPS, console.log);
  const domain = await runDomainCheck();
  console.log(`arch:check domain: нарушений — ${domain.length}`);
  for (const line of domain) console.log(line);
  // reportArchCheck уже напечатал ссылку, если нарушения были у приложений.
  if (domain.length > 0 && code === 0)
    console.log(`Правила по ID: ${RULES_DOC}`);
  process.exit(code === 0 && domain.length === 0 ? 0 : 1);
}
