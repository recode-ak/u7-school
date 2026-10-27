import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AnyOperationDef, DefIndex } from '../graph/def-index';
import { SourceScan } from './source-scan';
import { type ArchRule, Violation } from './violation';

/** Каталоги модуля: домен (`domain/src/<m>`) и прикладной пакет (`<m>/src`). */
export type ModuleLayout = { readonly domain: string; readonly app: string };

/**
 * Проверки по файлам модулей: 1:1 домена и прикладного пакета (ARC-06),
 * пары контракт ↔ реализация и место ER/Job (MAN-10), файлы операций вне
 * модуля (MAN-06), импорты других модулей (ARC-04, ARC-06). У внешнего
 * модуля (`external`) прикладной слой не проверяется — ни файлы, ни импорты.
 *
 * `entry` — вход модуля домена для других модулей: имя файла без `.ts`
 * в корне каталога модуля (`index` — также сам каталог). Импорт чужого
 * модуля мимо входа — ARC-04, кроме импорта между двумя внешними модулями:
 * их связи реализованы вне приложения. `dependsOn` (ARC-04) проверяется
 * для всех модулей.
 */
export class FileChecker {
  private readonly scan = new SourceScan();

  constructor(
    private readonly index: DefIndex,
    private readonly layout: (module: string) => ModuleLayout,
    private readonly entry = 'index',
  ) {}

  check(): Violation[] {
    const dirs = new Map(
      this.index.modules.map((m) => [m, this.layout(m.name)]),
    );
    const out: Violation[] = [];
    const add = (rule: ArchRule, message: string): void => {
      out.push(new Violation(rule, message));
    };

    for (const [m, dir] of dirs) {
      // Внешний модуль реализован вне приложения: прикладного пакета у него
      // нет, в домене — только контракт (D-37, D-42).
      const sides = m.external ? [dir.domain] : [dir.domain, dir.app];
      for (const base of sides) {
        const file = join(base, `${m.name}.module.ts`);
        if (!existsSync(file)) add('ARC-06', `модуль ${m.name}: нет ${file}`);
      }

      const domainOps = this.operationFiles(dir.domain);
      if (!m.external) {
        const appOps = this.operationFiles(dir.app);
        for (const f of appOps) {
          if (!domainOps.includes(f)) {
            add(
              'MAN-10',
              `${m.name}/${f} есть в прикладном слое, нет в домене`,
            );
          }
        }
        for (const f of domainOps) {
          if (!appOps.includes(f)) {
            add(
              'MAN-10',
              `${m.name}/${f} есть в домене, нет в прикладном слое`,
            );
          }
        }
      }

      const claimed = new Set<string>();
      for (const op of m.operations()) {
        const found = this.findOperationFile(op, domainOps);
        if (found.file === undefined) {
          add('MAN-10', `${op.title(m)}: ожидается файл ${found.expected}`);
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

      const scanned: (readonly [string, boolean])[] = m.external
        ? [[dir.domain, false]]
        : [
            [dir.domain, false],
            [dir.app, true],
          ];
      for (const [base, isApp] of scanned) {
        for (const f of this.scan.files(base)) {
          for (const { spec, target } of this.scan.imports(join(base, f))) {
            for (const [x, xDir] of dirs) {
              if (x === m) continue;
              const where = `${m.name}/${f}`;
              if (isApp && this.scan.inside(target, xDir.app)) {
                add(
                  'ARC-06',
                  `${where} импортирует прикладной пакет ${x.name}: ${spec}`,
                );
              }
              if (!this.scan.inside(target, xDir.domain)) continue;
              // Связи двух внешних модулей реализованы вне приложения:
              // вход платформа не проверяет, `dependsOn` — проверяет.
              const bothExternal = m.external === true && x.external === true;
              if (
                !bothExternal &&
                !this.scan.isEntry(target, xDir.domain, this.entry)
              ) {
                add(
                  'ARC-04',
                  `${where} импортирует ${x.name} мимо ${this.entry}.ts: ${spec}`,
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

  /**
   * Файл операции в домене: `<агрегат>/<uc|er|job>/<имя>.<вид>.ts`. Агрегат —
   * агрегат UC или основной (первый в `touches`/`scans`) у ER/Job; без него
   * подходит папка любого агрегата.
   */
  private findOperationFile(
    op: AnyOperationDef,
    files: readonly string[],
  ): { readonly file: string | undefined; readonly expected: string } {
    const kind = op.fileKind;
    const name = `${kind}/${this.kebab(op.name)}.${kind}.ts`;
    const main = op.mainAggregate();
    if (main === undefined) {
      const file = files.find((f) => f.endsWith(`/${name}`));
      return { file, expected: `<агрегат>/${name}` };
    }
    const expected = `${this.kebab(main.name)}/${name}`;
    return { file: files.includes(expected) ? expected : undefined, expected };
  }

  private operationFiles(base: string): string[] {
    return this.scan.files(base).filter((f) => /\.(uc|er|job)\.ts$/.test(f));
  }

  /** `archiveDoneTasks` → `archive-done-tasks`. */
  private kebab(name: string): string {
    return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }
}
