/**
 * Проверки домена `@u7-scl/domain` (ARC-02/04/05/06) и реестра долга.
 *
 *   bun run arch:check
 *
 * Чистые функции над файлами в памяти; чтение диска — в `readDomainFiles`.
 * Долг: маркер `// DEBT(D-<n>)` в коде ↔ allowlist `domain-debt.ts` ↔ `debt.md`.
 */
import { posix } from 'node:path';

export interface DomainFile {
  path: string;
  text: string;
}

/** Граф `dependsOn` модулей домена (прямые зависимости). */
export type DomainGraph = Readonly<Record<string, readonly string[]>>;

const DOMAIN_SRC = 'packages/domain/src/';
const PLATFORM = /^@u7-scl\/(app|core)(\/|$)/;
const DOMAIN_PKG = /^@u7-scl\/domain(?:\/([^/]+)(?:\/(.+))?)?$/;
const PUBLIC_SUBPATHS = new Set(['state', 'contract']);
const IMPORT_RE =
  /(?:\b(?:import|export)\b[^;'"]*?\bfrom\s*|\bimport\s*)(['"])([^'"\n]+)\1/g;

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
    refs.push({ spec: m[2] ?? '', line, marked: /DEBT\(D-\d+\)/.test(near) });
  }
  return refs;
}

/** ARC-02/04/06: импорты файлов `packages/domain/src/<m>/**`. */
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
          `чужой модуль ${other} только через index (import '${spec}')`,
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
              `чужой модуль ${other} только через index (import '${spec}')`,
            );
        } else crossModule(other, '', spec);
      } else if (PLATFORM.test(spec)) {
        if (!marked) fail('ARC-02', `импорт '${spec}' без // DEBT(<id>)`);
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

/** Сверка маркеров `DEBT(D-<n>)`, allowlist и `debt.md`. */
export function checkDebt(input: {
  code: readonly DomainFile[];
  allowlist: readonly string[];
  debtMd: string;
}): string[] {
  const inCode = new Map<string, string>();
  for (const f of input.code)
    for (const m of f.text.matchAll(/DEBT\((D-\d+)\)/g)) {
      const id = m[1] ?? '';
      if (!inCode.has(id)) inCode.set(id, f.path);
    }
  const allow = new Set(input.allowlist);
  const inMd = new Set(
    [...input.debtMd.matchAll(/^###\s+(D-\d+)\b/gm)].map((m) => m[1] ?? ''),
  );

  const out: string[] = [];
  for (const [id, path] of inCode)
    if (!allow.has(id))
      out.push(`DEBT: ${id} есть в коде (${path}), но не в allowlist`);
  for (const id of allow) {
    if (!inCode.has(id))
      out.push(`DEBT: ${id} есть в allowlist, но нет маркера в коде`);
    if (!inMd.has(id))
      out.push(`DEBT: ${id} есть в allowlist, но нет записи в debt.md`);
  }
  for (const id of inMd)
    if (!allow.has(id))
      out.push(`DEBT: ${id} есть в debt.md, но нет в allowlist`);
  return out;
}
