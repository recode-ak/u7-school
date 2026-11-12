/**
 * Проверки домена `@u7-scl/domain` (ARC-02/04/05/06) и реестра долга.
 *
 *   bun run arch:check
 *
 * Чистые функции над файлами в памяти; чтение диска — в `readDomainFiles`.
 * Долг: allowlist `conductor/architecture/debt.md`; в коде `DEBT-<n>` — только в `biome-ignore`;
 * маркеры временности («Временное решение», «ВРЕМЕННЫЙ», «Уходит с миграцией») — только в Месте открытой записи.
 */
import { posix } from 'node:path';
import { Glob } from 'bun';
import type { AnyModuleDef } from 'dmg-core';
import { normalize } from 'dmg-core/graph';

export interface DomainFile {
  path: string;
  text: string;
}

/** Граф `dependsOn` модулей домена (прямые зависимости). */
export type DomainGraph = Readonly<Record<string, readonly string[]>>;

const DOMAIN_SRC = 'domain/src/';
// Корень сборки `@u7-scl/app` — не платформа: домену запрещён (ARC-06).
const PLATFORM = /^@u7-scl\/(app-legacy|core)(\/|$)/;
const DOMAIN_PKG = /^@u7-scl\/domain(?:\/([^/]+)(?:\/(.+))?)?$/;
const PUBLIC_SUBPATHS = new Set(['contract', 'testing']);
const IMPORT_RE =
  /(?:\b(?:import|export)\b[^;'"]*?\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])([^'"\n]+)\1/g;

interface ImportRef {
  spec: string;
  line: number;
}

function importsOf(text: string): ImportRef[] {
  const refs: ImportRef[] = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const at = (m.index ?? 0) + m[0].length;
    const line = text.slice(0, at).split('\n').length;
    refs.push({ spec: m[2] ?? '', line });
  }
  return refs;
}

/** ARC-02/04/06: импорты файлов `domain/src/<m>/**`. */
export function checkDomainImports(
  files: readonly DomainFile[],
  graph: DomainGraph,
): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (!f.path.startsWith(DOMAIN_SRC)) continue;
    const own = f.path.slice(DOMAIN_SRC.length).split('/')[0] ?? '';
    const deps = graph[own] ?? [];
    const fail = (id: string, msg: string) =>
      out.push(`${id}: ${f.path}: ${msg}`);

    const crossModule = (other: string, sub: string, spec: string) => {
      if (other === own) return;
      if (!deps.includes(other)) {
        fail(
          'ARC-04',
          `модуль ${own} не зависит от ${other} (import '${spec}')`,
        );
      } else if (!PUBLIC_SUBPATHS.has(sub)) {
        fail(
          'ARC-04',
          `чужой модуль ${other} — только через contract (import '${spec}')`,
        );
      }
    };

    for (const { spec } of importsOf(f.text)) {
      if (spec.startsWith('.')) {
        const target = posix.join(posix.dirname(f.path), spec);
        if (!target.startsWith(DOMAIN_SRC)) {
          fail(
            'ARC-06',
            `домен не импортирует прикладной слой (import '${spec}')`,
          );
          continue;
        }
        const [first, ...rest] = target.slice(DOMAIN_SRC.length).split('/');
        crossModule(first ?? '', rest.join('/'), spec);
      } else if (PLATFORM.test(spec)) {
        // ARC-02: допустим только как учтённый долг — проверяет `checkDebt`
        // (записи с Корнем `domain/src/**`)
      } else if (DOMAIN_PKG.test(spec)) {
        const m = DOMAIN_PKG.exec(spec);
        if (m?.[1]) crossModule(m[1], m[2] ?? '', spec);
      } else if (spec.startsWith('@u7-scl/')) {
        fail(
          'ARC-06',
          `домен не импортирует прикладной слой (import '${spec}')`,
        );
      }
    }
  }
  return out;
}

const MODULES_DIR = 'modules/';
const SCRIPTS_DIR = 'scripts/';
// Каталоги корня сборки и раннеров — для относительных импортов.
const ASSEMBLY_DIR = /^(platform\/app|runners)\//;

/**
 * ARC-06 (D-53): прикладные пакеты `modules/<m>/**` не импортируют корень
 * сборки и раннеры — пакетом из `packages` (имена — из `package.json`
 * корня и раннеров, `assemblyPackages`) или относительным путём в их
 * каталоги. Для модулей на Def то же ловит `AssemblyChecker`
 * (`DomainArch`), здесь — для всех пакетов.
 * Маркер DEBT не спасает.
 */
export function checkModuleImports(
  files: readonly DomainFile[],
  packages: readonly string[],
): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (!f.path.startsWith(MODULES_DIR)) continue;
    for (const { spec } of importsOf(f.text)) {
      const banned = spec.startsWith('.')
        ? ASSEMBLY_DIR.test(posix.join(posix.dirname(f.path), spec))
        : packages.some((p) => spec === p || spec.startsWith(`${p}/`));
      if (banned) {
        out.push(
          `ARC-06: ${f.path}: прикладной пакет не импортирует корень сборки и раннеры (import '${spec}')`,
        );
      }
    }
  }
  return out;
}

/** Модуль, которому принадлежит файл: домен `domain/src/<m>` или пакет `modules/<m>`. */
function ownerOf(path: string, all: readonly string[]): string | undefined {
  const parts = path.split('/');
  const m =
    parts[0] === 'domain'
      ? parts[2]
      : parts[0] === 'modules'
        ? parts[1]
        : undefined;
  return m && all.includes(m) ? m : undefined;
}

/**
 * ARC-04 (D-45): чужой модуль — только через `contract`. Отступление проекта
 * от D-45: `scripts/` вне проверки — инструменты репозитория берут полный
 * вход модуля (решение Ф7 трека `user-dmg`, запись — `conductor/architecture/debt.md`).
 */
export function checkContractImports(
  files: readonly DomainFile[],
  modules: readonly string[],
): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (f.path.startsWith(SCRIPTS_DIR)) continue;
    const own = ownerOf(f.path, modules);
    for (const { spec } of importsOf(f.text)) {
      const m = DOMAIN_PKG.exec(spec);
      const other = m?.[1];
      if (!other || other === own) continue;
      if (m?.[2] === 'contract' || m?.[2] === 'testing') continue;
      out.push(
        `ARC-04: ${f.path}: модуль ${other} — только через contract (import '${spec}')`,
      );
    }
  }
  return out;
}

/** Граф `dependsOn` из `ModuleDef` модулей домена (D-01). */
export function domainGraphOf(modules: readonly AnyModuleDef[]): DomainGraph {
  return Object.fromEntries(
    modules.map((m) => [m.name, normalize(m).dependsOn]),
  );
}

/** ARC-05: каждый каталог `domain/src/<m>/` — модуль графа. */
export function checkDomainDirs(
  dirs: readonly string[],
  graph: DomainGraph,
): string[] {
  return dirs
    .filter((d) => !(d in graph))
    .map((d) => `ARC-05: ${DOMAIN_SRC}${d}: нет ModuleDef в графе домена`);
}

/** ARC-05: граф `dependsOn` — DAG без неизвестных модулей. */
export function checkDomainGraph(graph: DomainGraph): string[] {
  const out: string[] = [];
  for (const [m, deps] of Object.entries(graph))
    for (const d of deps)
      if (!(d in graph))
        out.push(`ARC-05: модуль ${m} зависит от неизвестного модуля ${d}`);

  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (m: string): boolean => {
    if (state.get(m) === 2) return false;
    if (state.get(m) === 1) {
      const cycle = [...stack.slice(stack.indexOf(m)), m];
      out.push(`ARC-05: цикл в dependsOn: ${cycle.join(' → ')}`);
      return true;
    }
    state.set(m, 1);
    stack.push(m);
    for (const d of graph[m] ?? []) if (d in graph && visit(d)) return true;
    stack.pop();
    state.set(m, 2);
    return false;
  };
  for (const m of Object.keys(graph)) if (visit(m)) break;
  return out;
}

/**
 * Запись реестра долга. Открытая — Место (glob), Признак (регулярка), Корень
 * (glob области поиска; нет — все файлы проверки); закрытая — `mergedInto`.
 */
interface DebtEntry {
  id: string;
  mergedInto?: string;
  places: string[];
  sign?: string;
  root?: string;
}

const HEADING = /^#{1,3}\s/;
const DEBT_HEADING = /^###\s+(DEBT-\d+)\b(.*)$/;
const MERGED = /слит в (DEBT-\d+)/;
const FIELD = /^- \*\*([^*]+):\*\*(.*)$/;
const SUB_ITEM = /^ {2}- (.*)$/;
const FENCE = /^\s*```/;
const TICK = /^`([^`]+)`\s*,?\s*/;
const DEBT_ID = /\bDEBT-\d+\b/g;
// Фразы, а не слово «временный»; `\b` для кириллицы не работает, «ВРЕМЕННЫЙ» — только заглавными.
const TEMP_MARKERS = [/временное решение|уходит с миграцией/gi, /ВРЕМЕННЫЙ/g];

/** Реестр долга `debt.md` как allowlist: записи и их сверка с кодом. */
class DebtRegistry {
  private constructor(
    private readonly entries: ReadonlyMap<string, DebtEntry>,
    private readonly duplicates: readonly string[],
  ) {}

  /**
   * Разбор: запись — заголовок `### DEBT-<n>` до следующего заголовка; блоки
   * кода ``` пропускаются. Место — glob'ы в бэктиках в начале строки поля или
   * пунктов первого уровня под ним до пустой строки (после glob'ов —
   * пояснение); Признак и Корень — первый токен в бэктиках.
   */
  static parse(md: string): DebtRegistry {
    const entries = new Map<string, DebtEntry>();
    const duplicates: string[] = [];
    let entry: DebtEntry | undefined;
    let field: string | undefined;
    let fenced = false;
    for (const line of md.split('\n')) {
      if (FENCE.test(line)) fenced = !fenced;
      if (fenced || FENCE.test(line)) continue;
      if (!line.trim()) {
        field = undefined;
        continue;
      }
      if (HEADING.test(line)) {
        field = undefined;
        const head = DEBT_HEADING.exec(line);
        const id = head?.[1] ?? '';
        entry =
          head && !entries.has(id)
            ? {
                id,
                mergedInto: MERGED.exec(head[2] ?? '')?.[1],
                places: [],
              }
            : undefined;
        if (entry) entries.set(id, entry);
        else if (head) duplicates.push(id);
        continue;
      }
      if (!entry) continue;
      const f = FIELD.exec(line);
      if (f) {
        field = f[1];
        const ticks = DebtRegistry.leadingTicks(f[2] ?? '');
        if (field === 'Место') entry.places.push(...ticks);
        if (field === 'Признак') entry.sign = ticks[0];
        if (field === 'Корень') entry.root = ticks[0];
        continue;
      }
      const item = SUB_ITEM.exec(line);
      if (item && field === 'Место')
        entry.places.push(...DebtRegistry.leadingTicks(item[1] ?? ''));
    }
    return new DebtRegistry(entries, duplicates);
  }

  /** Токены в бэктиках подряд в начале текста (через запятую). */
  private static leadingTicks(text: string): string[] {
    const out: string[] = [];
    let rest = text.trimStart();
    for (let m = TICK.exec(rest); m; m = TICK.exec(rest)) {
      out.push(m[1] ?? '');
      rest = rest.slice(m[0].length);
    }
    return out;
  }

  check(code: readonly DomainFile[], mode: 'transition' | 'strict'): string[] {
    const out = this.duplicates.map((id) => `DEBT: ${id}: дубль записи`);
    for (const e of this.entries.values())
      if (!e.mergedInto) out.push(...this.checkEntry(e, code));
    out.push(...this.checkIds(code, mode));
    out.push(...this.checkTempMarkers(code));
    return out;
  }

  /** Место и Признак записи: устаревший glob, погашенный glob, долг вне Места. */
  private checkEntry(e: DebtEntry, code: readonly DomainFile[]): string[] {
    const fail = (msg: string) => `DEBT: ${e.id}: ${msg}`;
    const missing = [
      ...(e.places.length ? [] : [fail('нет поля Место')]),
      ...(e.sign ? [] : [fail('нет поля Признак')]),
    ];
    if (missing.length || !e.sign) return missing;
    let sign: RegExp;
    try {
      sign = new RegExp(e.sign, 'm');
    } catch {
      return [fail(`Признак \`${e.sign}\` — неверная регулярка`)];
    }

    const out: string[] = [];
    const places = e.places.map((p) => new Glob(p));
    e.places.forEach((place, i) => {
      const files = code.filter((f) => places[i]?.match(f.path));
      if (!files.length)
        out.push(
          fail(`Место \`${place}\` не находит файлов — устаревшее место`),
        );
      else if (!files.some((f) => sign.test(f.text)))
        out.push(
          fail(`долг погашен (\`${place}\`) — сними glob или закрой запись`),
        );
    });

    const root = e.root ? new Glob(e.root) : undefined;
    if (root && !code.some((f) => root.match(f.path)))
      return [...out, fail(`Корень \`${e.root}\` не находит файлов`)];
    for (const f of code) {
      if (root && !root.match(f.path)) continue;
      if (places.some((g) => g.match(f.path))) continue;
      const m = sign.exec(f.text);
      if (m) {
        const line = f.text.slice(0, m.index).split('\n').length;
        out.push(fail(`долг без записи — ${f.path}:${line}`));
      }
    }
    return out;
  }

  /**
   * `DEBT-<n>` в коде: ID открытой записи и только в строке `biome-ignore`.
   * Переходный режим допускает ID открытой записи вне `biome-ignore`.
   */
  private checkIds(
    code: readonly DomainFile[],
    mode: 'transition' | 'strict',
  ): string[] {
    const out: string[] = [];
    for (const f of code)
      f.text.split('\n').forEach((line, i) => {
        for (const [id] of line.matchAll(DEBT_ID)) {
          const at = `DEBT: ${f.path}:${i + 1}: ${id}`;
          const e = this.entries.get(id);
          if (!e) out.push(`${at} — нет записи в debt.md`);
          else if (e.mergedInto)
            out.push(`${at} закрыт (слит в ${e.mergedInto})`);
          else if (mode === 'strict' && !line.includes('biome-ignore'))
            out.push(`${at} вне biome-ignore`);
        }
      });
    return out;
  }

  /**
   * Маркер временности допустим только в файле из Места открытой записи.
   * Область — исходники пакетов (`<пакет>/src`, `domain/src`) по правилу
   * `debt.md`: в `scripts/` те же слова описывают правила и шаблоны проверки.
   */
  private checkTempMarkers(code: readonly DomainFile[]): string[] {
    const places = [...this.entries.values()]
      .filter((e) => !e.mergedInto)
      .flatMap((e) => e.places.map((p) => new Glob(p)));
    const out: string[] = [];
    for (const f of code) {
      if (f.path.startsWith(SCRIPTS_DIR)) continue;
      if (places.some((g) => g.match(f.path))) continue;
      f.text.split('\n').forEach((line, i) => {
        for (const re of TEMP_MARKERS)
          for (const [phrase] of line.matchAll(re))
            out.push(
              `DEBT: ${f.path}:${i + 1}: маркер временности «${phrase}» вне Места открытой записи — заведи запись в debt.md или убери комментарий`,
            );
      });
    }
    return out;
  }
}

/**
 * Сверка кода с реестром долга `debt.md` (allowlist): у каждой открытой
 * записи признак есть в каждом glob Места и нет в Корне вне Места;
 * `DEBT-<n>` в коде — только в `biome-ignore` (`strict`).
 */
export function checkDebt(input: {
  code: readonly DomainFile[];
  debtMd: string;
  mode: 'transition' | 'strict';
}): string[] {
  return DebtRegistry.parse(input.debtMd).check(input.code, input.mode);
}

const TR_ID = /\bTR-\d+\b/g;

/**
 * Записи реестра `TR-<n>` живут в `debt.md` §6: в коде ссылка устаревает
 * вместе с адаптером. Где она объясняла «почему» — «адаптер над
 * legacy-фасадом» (`migration.md` §2.2).
 */
export function checkTrMarkers(code: readonly DomainFile[]): string[] {
  const out: string[] = [];
  for (const f of code)
    f.text.split('\n').forEach((line, i) => {
      for (const [id] of line.matchAll(TR_ID))
        out.push(`TR: ${f.path}:${i + 1}: ${id} — запись реестра в коде`);
    });
  return out;
}
