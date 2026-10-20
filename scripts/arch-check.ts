/**
 * Контрактные проверки архитектуры (TST-06): граф Def и файлы модулей.
 *
 *   bun run arch:check
 *
 * Каждое нарушение — строка, начинающаяся с ID правила из
 * `conductor/architecture/rules.md`. Код выхода 1, если нарушения есть.
 */

import { Glob } from 'bun';
import { type ArchApp, archCheck, formatViolation } from 'dmg-core/arch';
import { ExampleArch } from 'dmg-core/testing';
import {
  checkDebt,
  checkDomainGraph,
  checkDomainImports,
  type DomainFile,
} from './domain-check';
import { DEBT_MD, DOMAIN_GRAPH } from './domain-debt';

/**
 * Приложения под проверкой по Def. Модули `@u7-scl/domain` ещё без
 * `defineModule` (их импорты и граф проверяет `runDomainCheck`); приложение
 * домена добавляется с первым модулем на Def (`golden-wish`, Ф12).
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

/** Проверки домена: импорты, граф, долг. Возвращает строки нарушений. */
export async function runDomainCheck(root = '.'): Promise<string[]> {
  const code = await readPackageSources(root);
  const debtMd = await Bun.file(`${root}/${DEBT_MD}`).text();
  return [
    ...checkDomainGraph(DOMAIN_GRAPH),
    ...checkDomainImports(code, DOMAIN_GRAPH),
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
