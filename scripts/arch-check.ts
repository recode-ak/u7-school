/**
 * Контрактные проверки архитектуры (TST-06): граф Def и файлы модулей.
 *
 *   bun run arch:check
 *
 * Каждое нарушение — строка, начинающаяся с ID правила из
 * `conductor/architecture/rules.md`. Код выхода 1, если нарушения есть.
 */

import { Glob } from 'bun';
import { type ArchApp, archCheck, formatViolation } from 'dmg-core';
import { ExampleArch } from 'dmg-core/testing';
import {
  checkDebt,
  checkDomainGraph,
  checkDomainImports,
  type DomainFile,
} from './domain-check';
import { DEBT_MD, DOMAIN_DEBT_ALLOWLIST, DOMAIN_GRAPH } from './domain-debt';

/**
 * Приложения под проверкой. Домена школы ещё нет — пока только учебный
 * пример core; `@u7-scl/domain` добавится с первым мигрированным модулем.
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

/** Прочитать исходники всех пакетов (для проверок домена и долга). */
export async function readPackageSources(root = '.'): Promise<DomainFile[]> {
  const files: DomainFile[] = [];
  for await (const path of new Glob('packages/*/src/**/*.ts').scan(root)) {
    files.push({ path, text: await Bun.file(`${root}/${path}`).text() });
  }
  return files;
}

/** Проверки домена: импорты, граф, долг. Возвращает строки нарушений. */
export async function runDomainCheck(root = '.'): Promise<string[]> {
  const code = await readPackageSources(root);
  const debtMd = await Bun.file(`${root}/${DEBT_MD}`).text();
  return [
    ...checkDomainGraph(DOMAIN_GRAPH),
    ...checkDomainImports(code, DOMAIN_GRAPH),
    ...checkDebt({ code, allowlist: DOMAIN_DEBT_ALLOWLIST, debtMd }),
  ];
}

if (import.meta.main) {
  const code = runArchCheck(ARCH_APPS, console.log);
  const domain = await runDomainCheck();
  console.log(`arch:check domain: нарушений — ${domain.length}`);
  for (const line of domain) console.log(line);
  process.exit(code === 0 && domain.length === 0 ? 0 : 1);
}
