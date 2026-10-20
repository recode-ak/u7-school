/**
 * Контрактные проверки архитектуры (TST-06): граф Def и файлы модулей.
 *
 *   bun run arch:check
 *
 * Каждое нарушение — строка, начинающаяся с ID правила из
 * `conductor/architecture/rules.md`. Код выхода 1, если нарушения есть.
 */
import { type ArchApp, archCheck, formatViolation } from 'dmg-core';
import { ExampleArch } from 'dmg-core/testing';

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

if (import.meta.main) {
  process.exit(runArchCheck(ARCH_APPS, console.log));
}
