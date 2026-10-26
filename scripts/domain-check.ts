/**
 * Проверки домена `@u7-scl/domain` (ARC-02/04/05/06) и реестра долга.
 *
 *   bun run arch:check
 *
 * Чистые функции над файлами в памяти; чтение диска — в `readDomainFiles`.
 * Долг: маркер `// DEBT-<n>` в коде ↔ запись в `conductor/architecture/debt.md`.
 */
import { posix } from 'node:path';
import type { AnyModuleDef } from 'dmg-core';
import { normalize } from 'dmg-core/graph';

export interface DomainFile {
  path: string;
  text: string;
}

/** Граф `dependsOn` модулей домена (прямые зависимости). */
export type DomainGraph = Readonly<Record<string, readonly string[]>>;

const DOMAIN_SRC = 'domain/src/';
const PLATFORM = /^@u7-scl\/(app|core)(\/|$)/;
const DOMAIN_PKG = /^@u7-scl\/domain(?:\/([^/]+)(?:\/(.+))?)?$/;
const PUBLIC_SUBPATHS = new Set(['contract']);
const DEBT_RE = /\bDEBT-\d+\b/;
const IMPORT_RE =
  /(?:\b(?:import|export)\b[^;'"]*?\bfrom\s*|\bimport\s*(?:\(\s*)?)(['"])([^'"\n]+)\1/g;

interface ImportRef {
  spec: string;
  line: number;
  marked: boolean;
}

function importsOf(text: string): ImportRef[] {
  const lines = text.split('\n');
  const refs: ImportRef[] = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    const at = (m.index ?? 0) + m[0].length;
    const line = text.slice(0, at).split('\n').length;
    const near = `${lines[line - 2] ?? ''}\n${lines[line - 1] ?? ''}`;
    refs.push({ spec: m[2] ?? '', line, marked: DEBT_RE.test(near) });
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
      } else if (sub && sub !== 'index' && !PUBLIC_SUBPATHS.has(sub)) {
        fail(
          'ARC-04',
          `чужой модуль ${other} — только через contract, index — по DEBT-34 (import '${spec}')`,
        );
      }
    };

    for (const { spec, marked } of importsOf(f.text)) {
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
        const other = first ?? '';
        if (other === own) continue;
        const sub = rest.join('/');
        // относительным путём публичны только корень модуля и index
        if (sub && sub !== 'index') {
          if (!deps.includes(other)) crossModule(other, sub, spec);
          else
            fail(
              'ARC-04',
              `чужой модуль ${other} — только через contract, index — по DEBT-34 (import '${spec}')`,
            );
        } else crossModule(other, '', spec);
      } else if (PLATFORM.test(spec)) {
        if (!marked) fail('ARC-02', `импорт '${spec}' без // DEBT-<n>`);
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

/** Модули домена для ARC-04 (D-45): все и переведённые на Def. */
export interface DomainModules {
  all: readonly string[];
  dmg: readonly string[];
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

// DEBT-34: пары legacy-модулей импортируют чужой `index` — проверка ждёт
// их миграции на Def
/**
 * ARC-04 (D-45): чужой модуль — только через `contract`. Блокирует, если
 * модуль на Def импортирует или импортируется; пары legacy-модулей — по
 * долгу до миграции.
 */
export function checkContractImports(
  files: readonly DomainFile[],
  modules: DomainModules,
): string[] {
  const out: string[] = [];
  for (const f of files) {
    const own = ownerOf(f.path, modules.all);
    for (const { spec } of importsOf(f.text)) {
      const m = DOMAIN_PKG.exec(spec);
      const other = m?.[1];
      if (!other || other === own || m?.[2] === 'contract') continue;
      const dmg =
        modules.dmg.includes(other) || modules.dmg.includes(own ?? '');
      if (dmg)
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

/** Сверка маркеров `DEBT-<n>` в коде с записями `debt.md`. */
export function checkDebt(input: {
  code: readonly DomainFile[];
  debtMd: string;
}): string[] {
  const inCode = new Map<string, string>();
  for (const f of input.code)
    for (const m of f.text.matchAll(/\b(DEBT-\d+)\b/g)) {
      const id = m[1] ?? '';
      if (!inCode.has(id)) inCode.set(id, f.path);
    }
  const inMd = new Set(
    [...input.debtMd.matchAll(/^###\s+(DEBT-\d+)\b/gm)].map((m) => m[1] ?? ''),
  );

  const out: string[] = [];
  for (const [id, path] of inCode)
    if (!inMd.has(id))
      out.push(`DEBT: ${id} есть в коде (${path}), но нет записи в debt.md`);
  for (const id of inMd)
    if (!inCode.has(id))
      out.push(`DEBT: ${id} есть в debt.md, но нет маркера в коде`);
  return out;
}
