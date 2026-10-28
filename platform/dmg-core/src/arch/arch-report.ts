import { type ArchApp, ArchChecker } from './arch-checker';

/** Каталог правил установленного пакета — от корня проекта-потребителя. */
export const RULES_DOC = 'node_modules/dmg-core/docs/rules.md';

/** Опции отчёта `arch:check`. */
export type ArchReportOptions = {
  /**
   * Незаполненные `TODO` в описаниях Def — нарушения, а не предупреждения
   * (например, перед выпуском: `bun run arch:check --strict`).
   */
  readonly strict?: boolean;
};

/**
 * Отчёт `arch:check` по приложениям: строка на приложение, нарушения с ID
 * правила в начале, итог и — если нарушения есть — где искать правило по
 * ID. Незаполненные `TODO` в описаниях Def (MAN-01) — предупреждения:
 * печатаются списком и код выхода не меняют; в строгом режиме — нарушения.
 * Возвращает код выхода (1 — есть нарушения).
 */
export function reportArchCheck(
  apps: readonly ArchApp[],
  print: (line: string) => void,
  options: ArchReportOptions = {},
): number {
  let total = 0;
  let todos = 0;
  for (const app of apps) {
    const checker = ArchChecker.of(app);
    const warnings = checker.todos();
    const violations = options.strict
      ? [...checker.check(), ...warnings]
      : checker.check();
    print(`arch:check ${app.name}: нарушений — ${violations.length}`);
    for (const v of violations) print(v.format());
    total += violations.length;
    if (options.strict || warnings.length === 0) continue;
    print(
      `arch:check ${app.name}: незаполненных TODO — ${warnings.length} (предупреждение)`,
    );
    for (const w of warnings) print(`${w.rule} (предупреждение): ${w.message}`);
    todos += warnings.length;
  }
  if (todos > 0) {
    print(
      `arch:check: незаполненных TODO — ${todos}; строгий режим (--strict) считает их нарушениями`,
    );
  }
  if (total === 0) {
    print('arch:check: нарушений нет');
    return 0;
  }
  print(`arch:check: нарушений — ${total}`);
  print(`Правила по ID: ${RULES_DOC}`);
  return 1;
}
