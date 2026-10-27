import { dirname, join, relative, sep } from 'node:path';
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
 * - раннер (ARC-08): прикладной пакет — никогда, домен — только `entry`;
 * - прикладной пакет модуля (ARC-06, D-53): не импортирует файлы корня
 *   сборки и раннеров — модуль не зависит от собирающего его приложения.
 *
 * Платформа и прочие пути не проверяются. У внешнего модуля (`external`)
 * прикладной пакет не проверяется (реализован вне приложения, D-37),
 * домен — проверяется. Отдельно от `FileChecker`: тот проверяет файлы
 * модулей между собой, этот — связи с приложением вокруг них.
 *
 * Место нарушения в корне сборки и раннере — путь файла от общего предка
 * их каталогов: раннеры `runners/a/src` и `runners/b/src` не сливаются.
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
    const from = this.ancestor(sides.map((side) => dirname(side.base)));
    return [
      ...sides.flatMap((side) => this.checkSide(side, modules, from)),
      ...modules.flatMap(([m, dir]) =>
        m.external === true ? [] : this.checkApp(m, dir.app, sides),
      ),
    ];
  }

  private checkSide(
    side: Side,
    modules: readonly (readonly [AnyModuleDef, ModuleLayout])[],
    from: string,
  ): Violation[] {
    const out: Violation[] = [];
    for (const f of this.scan.files(side.base)) {
      const file = join(side.base, f);
      if (side.skip.some((dir) => this.scan.inside(file, dir))) continue;
      const where = `${side.title} ${this.path(from, file)}`;
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

  /** ARC-06: файлы прикладного пакета `m` не импортируют корень и раннеры. */
  private checkApp(
    m: AnyModuleDef,
    app: string,
    sides: readonly Side[],
  ): Violation[] {
    const out: Violation[] = [];
    for (const f of this.scan.files(app)) {
      for (const { spec, target } of this.scan.imports(join(app, f))) {
        // Пакеты модулей и раннеры внутри корня — в `skip` корня.
        const side = sides.find(
          (s) =>
            this.scan.inside(target, s.base) &&
            !s.skip.some((dir) => this.scan.inside(target, dir)),
        );
        if (side !== undefined) {
          out.push(
            new Violation(
              'ARC-06',
              `${m.name}/${f} импортирует ${side.title}: ${spec}`,
            ),
          );
        }
      }
    }
    return out;
  }

  /** Путь файла от `from` через `/` — место в сообщении. */
  private path(from: string, file: string): string {
    return relative(from, file).split(sep).join('/');
  }

  /** Общий предок каталогов (`dirs` не пуст, иначе — корень ФС). */
  private ancestor(dirs: readonly string[]): string {
    const [first = [], ...rest] = dirs.map((d) => d.split(sep));
    let n = first.length;
    for (const parts of rest) {
      let i = 0;
      while (i < n && parts[i] === first[i]) i++;
      n = i;
    }
    return first.slice(0, n).join(sep) || sep;
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
