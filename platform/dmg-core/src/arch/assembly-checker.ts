import { basename, join } from 'node:path';
import type { AnyModuleDef } from '../domain/contracts/module-def';
import type { DefIndex } from '../graph/def-index';
import type { AssemblyPlaces } from './assembly-checker.types';
import type { ModuleLayout } from './file-checker';
import { SourceScan } from './source-scan';
import { type ArchRule, Violation } from './violation';

/** Слой приложения, чьи импорты проверяются: правило и имя в сообщении. */
type Side = {
  readonly rule: ArchRule;
  readonly title: string;
  readonly base: string;
  /** Импорт прикладного пакета: можно ли через его `index`. */
  readonly appEntry: boolean;
  /** Каталоги внутри `base`, файлы которых — не этот слой. */
  readonly skip: readonly string[];
};

/**
 * Импорты корня сборки и раннеров (D-52), файлы модулей — по `layout`:
 * - корень сборки (ARC-07): домен модуля — только `entry`, прикладной
 *   пакет — только его `index.ts` (фабрика модуля);
 * - раннер (ARC-08): прикладной пакет — никогда, домен — только `entry`.
 *
 * Платформа и прочие пути не проверяются. У внешнего модуля (`external`)
 * прикладной пакет не проверяется (реализован вне приложения, D-37),
 * домен — проверяется. Отдельно от `FileChecker`: тот проверяет файлы
 * модулей, этот — файлы приложения вокруг них.
 */
export class AssemblyChecker {
  private readonly scan = new SourceScan();

  constructor(
    private readonly index: DefIndex,
    private readonly layout: (module: string) => ModuleLayout,
    private readonly entry: string,
    private readonly places: AssemblyPlaces,
  ) {}

  check(): Violation[] {
    const modules = this.index.modules.map(
      (m) => [m, this.layout(m.name)] as const,
    );
    const runners = this.places.runners ?? [];
    const sides: Side[] = runners.map((base) => ({
      rule: 'ARC-08',
      title: 'раннер',
      base,
      appEntry: false,
      skip: [],
    }));
    if (this.places.root !== undefined) {
      sides.unshift({
        rule: 'ARC-07',
        title: 'корень сборки',
        base: this.places.root,
        appEntry: true,
        skip: [
          ...modules.flatMap(([, dir]) => [dir.domain, dir.app]),
          ...runners,
        ],
      });
    }
    return sides.flatMap((side) => this.checkSide(side, modules));
  }

  private checkSide(
    side: Side,
    modules: readonly (readonly [AnyModuleDef, ModuleLayout])[],
  ): Violation[] {
    const out: Violation[] = [];
    for (const f of this.scan.files(side.base)) {
      const file = join(side.base, f);
      if (side.skip.some((dir) => this.scan.inside(file, dir))) continue;
      const where = `${side.title} ${basename(side.base)}/${f}`;
      for (const { spec, target } of this.scan.imports(file)) {
        for (const [m, dir] of modules) {
          const message = this.misuse(side, m, dir, target);
          if (message !== undefined) {
            out.push(new Violation(side.rule, `${where} ${message}: ${spec}`));
          }
        }
      }
    }
    return out;
  }

  /** Почему импорт `target` модуля `m` запрещён слою, или `undefined`. */
  private misuse(
    side: Side,
    m: AnyModuleDef,
    dir: ModuleLayout,
    target: string,
  ): string | undefined {
    if (this.scan.inside(target, dir.domain)) {
      return this.scan.isEntry(target, dir.domain, this.entry)
        ? undefined
        : `импортирует ${m.name} мимо ${this.entry}.ts`;
    }
    if (m.external === true || !this.scan.inside(target, dir.app)) {
      return undefined;
    }
    if (!side.appEntry) return `импортирует прикладной пакет ${m.name}`;
    return this.scan.isEntry(target, dir.app, 'index')
      ? undefined
      : `импортирует прикладной пакет ${m.name} мимо index.ts`;
  }
}
