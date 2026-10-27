import { type ArchApp, archCheck } from './arch-check';

/** Каталог правил установленного пакета — от корня проекта-потребителя. */
export const RULES_DOC = 'node_modules/dmg-core/docs/rules.md';

/**
 * Отчёт `arch:check` по приложениям: строка на приложение, нарушения с ID
 * правила в начале, итог и — если нарушения есть — где искать правило по
 * ID. Возвращает код выхода (1 — есть нарушения).
 */
export function reportArchCheck(
  apps: readonly ArchApp[],
  print: (line: string) => void,
): number {
  let total = 0;
  for (const app of apps) {
    const violations = archCheck(app);
    print(`arch:check ${app.name}: нарушений — ${violations.length}`);
    for (const v of violations) print(v.format());
    total += violations.length;
  }
  if (total === 0) {
    print('arch:check: нарушений нет');
    return 0;
  }
  print(`arch:check: нарушений — ${total}`);
  print(`Правила по ID: ${RULES_DOC}`);
  return 1;
}
