/**
 * Порядок импортов, как у biome (`organizeImports`): встроенные модули
 * (`bun:`, `node:`), пакеты, затем относительные пути; внутри группы — по
 * пути источника. Генератор пишет заготовки сразу в этом порядке, чтобы
 * biome их не правил. Функции без состояния — общий порядок для шаблонов
 * (`sortImports`) и вставки по маркеру (`importBefore`).
 */

/** Источник импорта или реэкспорта (в том числе многострочного). */
const SOURCE = /^(?:import|export)\b.*\bfrom '([^']+)';$/s;

/** Ключ сортировки: группа (встроенные, пакеты, пути) и путь источника. */
type Key = [number, string];

function keyOf(statement: string): Key | undefined {
  const source = SOURCE.exec(statement.trim())?.[1];
  if (source === undefined) return undefined;
  const group = /^(?:bun|node):/.test(source)
    ? 0
    : source.startsWith('.')
      ? 2
      : 1;
  return [group, source];
}

/** Biome ставит `.` раньше `-` в путях (`./a.facade` < `./a-b.dcs`). */
const pathKey = (path: string) =>
  path.replaceAll('.', '\u0001').replaceAll('-', '\u0002');

function before(a: Key, b: Key): boolean {
  if (a[0] !== b[0]) return a[0] < b[0];
  return pathKey(a[1]) < pathKey(b[1]);
}

/** Строка — импорт или реэкспорт с источником */
export const isImportSource = (line: string): boolean =>
  keyOf(line) !== undefined;

/** a раньше b; undefined — у одной из строк нет источника */
export function importBefore(a: string, b: string): boolean | undefined {
  const [ka, kb] = [keyOf(a), keyOf(b)];
  return ka && kb ? before(ka, kb) : undefined;
}

/** Блок импортов в порядке biome, по одному на строку (многострочные — как есть) */
export function sortImports(statements: readonly string[]): string {
  return [...statements]
    .sort((a, b) => (importBefore(a, b) ? -1 : importBefore(b, a) ? 1 : 0))
    .join('\n');
}
