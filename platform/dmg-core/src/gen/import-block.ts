import {
  importBefore,
  isImportSource,
  namedImport,
  sortNames,
} from './import-order';

/** Оператор import/export в строках файла: первая и последняя строка, текст. */
type Statement = { start: number; end: number; text: string };

/** Именованный импорт: `import [type] { a, type b } from 's';` (в том числе многострочный). */
const NAMED = /^import (type )?\{([^}]*)\} from '([^']+)';$/s;

/** Последняя строка многострочного оператора: `} from 's';`. */
const TAIL = /^\}.* from '[^']+';$/;

/** Итог вставки оператора в блок. */
export type InsertResult =
  | { kind: 'inserted' }
  | { kind: 'present' }
  | { kind: 'conflict'; name: string; from: string };

/** Локальное имя спецификатора: `type X` → `X`, `X as Y` → `Y`. */
const localName = (name: string) =>
  name
    .replace(/^type /, '')
    .split(/\s+as\s+/)
    .pop() ?? name;

/** Разобранный именованный импорт. */
type Named = { typeOnly: boolean; names: string[]; from: string };

function parseNamed(text: string): Named | undefined {
  const match = NAMED.exec(text.trim());
  if (match === null) return undefined;
  const [, type, list = '', from = ''] = match;
  const names = list
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== '');
  return { typeOnly: type !== undefined, names, from };
}

/**
 * Блок импортов и реэкспортов над маркером — непрерывные операторы, в том
 * числе многострочные. Вставка — как сделал бы biome (`organizeImports`):
 * именованный импорт из уже импортированного источника сливается с ним,
 * прочие — по порядку источников. Меняет переданный массив строк.
 */
export class ImportBlock {
  private constructor(
    private readonly lines: string[],
    private readonly marker: number,
    private readonly statements: Statement[],
  ) {}

  /** Блок операторов, примыкающий к строке маркера сверху. */
  static above(lines: string[], marker: number): ImportBlock {
    const statements: Statement[] = [];
    let i = marker - 1;
    while (i >= 0) {
      const line = (lines[i] ?? '').trim();
      if (isImportSource(line)) {
        statements.unshift({ start: i, end: i, text: line });
        i--;
        continue;
      }
      if (!TAIL.test(line)) break;
      let start = i - 1;
      while (start >= 0 && !/^(?:import|export)\b/.test(lines[start] ?? '')) {
        start--;
      }
      const text = lines.slice(start, i + 1).join('\n');
      if (start < 0 || !isImportSource(text)) break;
      statements.unshift({ start, end: i, text });
      i = start - 1;
    }
    return new ImportBlock(lines, marker, statements);
  }

  /**
   * Вставляет оператор `line`. `present` — он или его имена уже есть;
   * `conflict` — имя уже импортировано из другого источника (вставка дала
   * бы дубль идентификатора), строки не тронуты.
   */
  insert(line: string): InsertResult {
    if (this.statements.some((s) => s.text === line.trim())) {
      return { kind: 'present' };
    }
    const added = parseNamed(line);
    if (added !== undefined) {
      const clash = this.clash(added);
      if (clash !== undefined) return clash;
      for (const s of this.statements) {
        const known = parseNamed(s.text);
        if (
          known === undefined ||
          known.from !== added.from ||
          known.typeOnly !== added.typeOnly
        ) {
          continue;
        }
        const fresh = added.names.filter((n) => !known.names.includes(n));
        if (fresh.length === 0) return { kind: 'present' };
        const names = sortNames([...known.names, ...fresh]);
        const text = namedImport(names, known.from, known.typeOnly);
        this.lines.splice(s.start, s.end - s.start + 1, ...text.split('\n'));
        return { kind: 'inserted' };
      }
    }
    const next = this.statements.find((s) => importBefore(line, s.text));
    this.lines.splice(next?.start ?? this.marker, 0, line);
    return { kind: 'inserted' };
  }

  /** Локальное имя из `added`, уже импортированное из другого источника. */
  private clash(added: Named): InsertResult | undefined {
    for (const s of this.statements) {
      const known = parseNamed(s.text);
      if (known === undefined || known.from === added.from) continue;
      const taken = known.names.map(localName);
      const name = added.names.map(localName).find((n) => taken.includes(n));
      if (name !== undefined) {
        return { kind: 'conflict', name, from: known.from };
      }
    }
    return undefined;
  }
}
