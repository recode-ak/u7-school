import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import {
  type AnyOperationDef,
  type DefIndex,
  localId,
  operationsOf,
} from '../graph/def-index';
import type { ArchRule, Violation } from './violation';

/** Каталоги модуля: домен (`domain/src/<m>`) и прикладной пакет (`<m>/src`). */
export type ModuleLayout = { readonly domain: string; readonly app: string };

/**
 * Проверки по файлам модулей: 1:1 домена и прикладного пакета (ARC-06),
 * пары контракт ↔ реализация и место ER/Job (MAN-10), файлы операций вне
 * модуля (MAN-06), импорты других модулей (ARC-04, ARC-06). У внешнего
 * модуля (`external`) прикладной слой не проверяется.
 */
export function checkFiles(
  index: DefIndex,
  layout: (module: string) => ModuleLayout,
): Violation[] {
  const dirs = new Map(index.modules.map((m) => [m, layout(m.name)]));
  const out: Violation[] = [];
  const add = (rule: ArchRule, message: string): void => {
    out.push({ rule, message });
  };

  for (const [m, dir] of dirs) {
    // Внешний модуль реализован вне приложения: прикладного пакета у него
    // нет, в домене — только контракт (D-37, D-42).
    const sides = m.external ? [dir.domain] : [dir.domain, dir.app];
    for (const base of sides) {
      const file = join(base, `${m.name}.module.ts`);
      if (!existsSync(file)) add('ARC-06', `модуль ${m.name}: нет ${file}`);
    }

    const domainOps = operationFiles(dir.domain);
    if (!m.external) {
      const appOps = operationFiles(dir.app);
      for (const f of appOps) {
        if (!domainOps.includes(f)) {
          add('MAN-10', `${m.name}/${f} есть в прикладном слое, нет в домене`);
        }
      }
      for (const f of domainOps) {
        if (!appOps.includes(f)) {
          add('MAN-10', `${m.name}/${f} есть в домене, нет в прикладном слое`);
        }
      }
    }

    const claimed = new Set<string>();
    for (const op of operationsOf(m)) {
      const found = findOperationFile(op, domainOps);
      if (found.file === undefined) {
        add(
          'MAN-10',
          `${OPERATION_KIND[op.dmg]} ${localId(m, op)}: ожидается файл ${found.expected}`,
        );
      } else {
        claimed.add(found.file);
      }
    }
    for (const f of domainOps) {
      if (!claimed.has(f)) {
        add(
          'MAN-06',
          `${m.name}/${f} — нет такой операции в модуле (Def вне модуля)`,
        );
      }
    }

    for (const [base, isApp] of [
      [dir.domain, false],
      [dir.app, true],
    ] as const) {
      for (const f of sourceFiles(base)) {
        const file = join(base, f);
        for (const spec of importsOf(file)) {
          const target = resolveImport(spec, dirname(file));
          if (target === undefined) continue;
          for (const [x, xDir] of dirs) {
            if (x === m) continue;
            const where = `${m.name}/${f}`;
            if (isApp && inside(target, xDir.app)) {
              add(
                'ARC-06',
                `${where} импортирует прикладной пакет ${x.name}: ${spec}`,
              );
            }
            if (!inside(target, xDir.domain)) continue;
            if (stripIndex(target) !== xDir.domain) {
              add(
                'ARC-04',
                `${where} импортирует ${x.name} мимо index.ts: ${spec}`,
              );
            }
            if (!m.dependsOn.includes(x)) {
              add(
                'ARC-04',
                `${where} импортирует ${x.name}, которого нет в dependsOn ${m.name}`,
              );
            }
          }
        }
      }
    }
  }
  return out;
}

const OPERATION_KIND = { useCase: 'UC', eventReaction: 'ER', job: 'Job' };
const OPERATION_DIR = { useCase: 'uc', eventReaction: 'er', job: 'job' };

/**
 * Файл операции в домене: `<агрегат>/<uc|er|job>/<имя>.<вид>.ts`. Агрегат —
 * агрегат UC или основной (первый в `touches`/`scans`) у ER/Job; без него
 * подходит папка любого агрегата.
 */
function findOperationFile(
  op: AnyOperationDef,
  files: readonly string[],
): { readonly file: string | undefined; readonly expected: string } {
  const kind = OPERATION_DIR[op.dmg];
  const name = `${kind}/${kebab(op.name)}.${kind}.ts`;
  const main =
    op.dmg === 'useCase'
      ? op.aggregate
      : op.dmg === 'eventReaction'
        ? op.touches[0]
        : op.scans[0];
  if (main === undefined) {
    const file = files.find((f) => f.endsWith(`/${name}`));
    return { file, expected: `<агрегат>/${name}` };
  }
  const expected = `${kebab(main.name)}/${name}`;
  return { file: files.includes(expected) ? expected : undefined, expected };
}

function operationFiles(base: string): string[] {
  return sourceFiles(base).filter((f) => /\.(uc|er|job)\.ts$/.test(f));
}

/** `.ts`-файлы каталога, относительные пути через `/`, по алфавиту. */
function sourceFiles(base: string): string[] {
  if (!existsSync(base)) return [];
  return [...new Bun.Glob('**/*.ts').scanSync({ cwd: base })]
    .map((f) => f.split(sep).join('/'))
    .sort();
}

const IMPORT =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  return [...text.matchAll(IMPORT)].flatMap((m) => {
    const spec = m[1] ?? m[2];
    return spec === undefined ? [] : [spec];
  });
}

/** Абсолютный путь цели импорта; пакет, который не разрешается, — пропуск. */
function resolveImport(spec: string, from: string): string | undefined {
  if (spec.startsWith('.')) return resolve(from, spec);
  try {
    return Bun.resolveSync(spec, from);
  } catch {
    return undefined;
  }
}

function inside(path: string, dir: string): boolean {
  return path === dir || path.startsWith(dir + sep);
}

/** `<dir>/index.ts`, `<dir>/index` и `<dir>` — один и тот же вход модуля. */
function stripIndex(path: string): string {
  return path.replace(/\.[jt]s$/, '').replace(/[/\\]index$/, '');
}

/** `archiveDoneTasks` → `archive-done-tasks`. */
function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
