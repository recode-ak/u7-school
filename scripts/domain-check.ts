/**
 * Проверки домена `@u7-scl/domain` (ARC-02/04/05/06).
 *
 *   bun run arch:check
 *
 * Чистые функции над файлами в памяти; чтение диска — в `readDomainFiles`.
 * Долг сверяет `DebtChecker` пакета (ARC-12) — раскладка в `arch-check.ts`.
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
// Корень сборки `@u7-scl/app` — не платформа: домену запрещён (ARC-06).
const PLATFORM = /^@u7-scl\/core(\/|$)/;
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
        // ARC-02: допустим только как учтённый долг — проверяет `DebtChecker` (ARC-12)
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
 * ARC-04 (D-45): чужой модуль — только через `contract`. `scripts/` здесь не
 * проверяются: полный вход модуля в скрипте — учтённый долг, его сверяет
 * `DebtChecker` пакета по записи в `conductor/debt/code.md`.
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
