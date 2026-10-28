/**
 * Подключение модуля к приложению по маркерам каркаса (`dmg-core init`):
 * `gen module` — фабрика в список модулей корня сборки, корень Def в
 * `scripts/arch-check.ts`, у пакета модуля — зависимость пакета корня
 * сборки; `gen aggregate` — JSON-репозиторий в фабрику модуля. Нет файла
 * или маркера — `applyPlan` вернёт правку как «Вставь вручную». Корень
 * сборки неизвестен (своя раскладка без `gen.compositionRoot`) — правок
 * нет, только общая подсказка в `notes`.
 */
import { dirname, join, relative, sep } from 'node:path';
import type { GenArgs } from '../cli';
import { LINE_WIDTH, namedImport } from '../import-order';
import { toCamel, toPascal } from '../naming';
import type { PlannedDependency, PlannedEdit } from '../plan';

/** Маркеры корня сборки и `arch-check.ts`, которые пишет `dmg-core init`. */
export const WIRING_MARKERS = {
  /** Конец блока импортов. */
  imports: '// gen:imports',
  /** Конец списка модулей (`modules`). */
  modules: '// gen:modules',
  /** Конец объекта зависимостей в фабрике модуля `m`. */
  repos: (m: string) => `// gen:repos:${m}`,
};

/** Отступы вставок — по шаблонам каркаса (`AppSources`, `ProjectFiles`). */
const ELEMENT = '      ';
const REPO = '            ';
const ARCH_ELEMENT = '  ';

/** Правки подключения модуля `args.module` к корню сборки и `arch:check`. */
export class AppWiring {
  private readonly m: string;
  private readonly P: string;
  /** `app.ts` корня сборки; undefined — корень сборки неизвестен. */
  private readonly app: string | undefined;
  private readonly archCheck: string;

  constructor(private readonly args: GenArgs) {
    this.m = args.module;
    this.P = toPascal(args.module);
    const dir = args.layout.compositionDir();
    this.app = dir === undefined ? undefined : join(dir, 'app.ts');
    this.archCheck = args.layout.archCheckFile();
  }

  /** `gen module`: фабрика и Def в корне сборки, Def в `arch-check.ts`. */
  moduleEdits(): PlannedEdit[] {
    const { app, archCheck, m, P } = this;
    if (app === undefined) return [];
    const { imports, modules, repos } = WIRING_MARKERS;
    const def = `${P}ModuleDef`;
    const element = [
      `${ELEMENT}{`,
      `${ELEMENT}  def: ${def},`,
      `${ELEMENT}  create: (deps) =>`,
      `${ELEMENT}    create${P}Module({`,
      `${ELEMENT}      ...deps,`,
      `${ELEMENT}      ${repos(m)}`,
      `${ELEMENT}    }),`,
      `${ELEMENT}},`,
    ].join('\n');
    return [
      { path: app, marker: imports, line: this.importDef(dirname(app)) },
      {
        path: app,
        marker: imports,
        line: namedImport([`create${P}Module`], this.entry(dirname(app))),
      },
      { path: app, marker: modules, line: element },
      {
        path: archCheck,
        marker: imports,
        line: this.importDef(dirname(archCheck)),
      },
      { path: archCheck, marker: modules, line: `${ARCH_ELEMENT}${def},` },
    ];
  }

  /**
   * Пакет модуля (`gen.package`) — зависимость пакета корня сборки; нет его
   * `package.json` в раскладке — пусто (см. `moduleNotes`).
   */
  moduleDependencies(): PlannedDependency[] {
    const pkg = this.args.layout.package(this.m);
    const path = this.args.layout.compositionPackage();
    if (pkg === undefined || path === undefined) return [];
    return [{ path, name: pkg.name, version: 'workspace:*' }];
  }

  /**
   * Что сделать после `gen module`: корень сборки неизвестен — подключить
   * руками; у пакета модуля — зависимость (если не вписана) и `bun install`.
   */
  moduleNotes(): string[] {
    const { layout } = this.args;
    const pkg = layout.package(this.m);
    const dir = layout.compositionDir();
    const install = pkg
      ? ['Затем bun install — чтобы пакет модуля появился в node_modules.']
      : [];
    if (dir === undefined) return [...this.manualWiring(), ...install];
    if (pkg === undefined || layout.compositionPackage() !== undefined) {
      return install;
    }
    return [
      `Вставь вручную в package.json пакета с каталогом ${dir}, dependencies: "${pkg.name}": "workspace:*"`,
      ...install,
    ];
  }

  /**
   * `gen aggregate`: JSON-репозиторий агрегата `a` в фабрику модуля. Файл
   * данных — `<m>.<a>.json`: имя агрегата уникально только в модуле. Импорт
   * и строка репозитория — одна группа: конфликт имени импорта отменяет и
   * строку (иначе она сослалась бы на чужой класс).
   */
  aggregateEdits(a: string): PlannedEdit[] {
    const { app, m } = this;
    if (app === undefined) return [];
    const A = toPascal(a);
    const head = `${REPO}${toCamel(a)}Repo: new ${A}JsonRepo(`;
    const arg = `join(env.dataDir, '${m}.${a}.json')`;
    const line = `${head}${arg}),`;
    const repo =
      line.length <= LINE_WIDTH ? line : `${head}\n${REPO}  ${arg},\n${REPO}),`;
    const group = `repo:${m}.${a}`;
    return [
      {
        path: app,
        marker: WIRING_MARKERS.imports,
        line: namedImport([`${A}JsonRepo`], this.entry(dirname(app))),
        group,
      },
      { path: app, marker: WIRING_MARKERS.repos(m), line: repo, group },
    ];
  }

  /**
   * Общая подсказка, когда корень сборки неизвестен: что вставить, откуда
   * импортировать и какое поле задать, чтобы `gen` подключал модуль сам.
   */
  private manualWiring(): string[] {
    const { m, P } = this;
    const { layout } = this.args;
    const pkg = layout.package(m);
    const entry = pkg ? `'${pkg.name}'` : `${layout.appDir(m)}/index.ts`;
    const contract = layout.hasDomainImport()
      ? `'${layout.domainImport(m, '.')}/contract'`
      : `${layout.domainDir(m)}/contract.ts`;
    return [
      'Корень сборки не задан (gen.compositionRoot в dmg-core.json) — подключи модуль вручную:',
      '  корень сборки, список модулей (репозитории — в create вместе с deps):',
      `    { def: ${P}ModuleDef, create: (deps) => create${P}Module({ ...deps }) }`,
      `    create${P}Module — из входа ${entry}, ${P}ModuleDef — из ${contract}`,
      `  ${this.archCheck}, modules: ${P}ModuleDef (из ${contract})`,
      ...(pkg
        ? [
            `  package.json пакета корня сборки, dependencies: "${pkg.name}": "workspace:*"`,
          ]
        : []),
    ];
  }

  /** Импорт корня Def модуля из файла в каталоге `fromDir` — через contract. */
  private importDef(fromDir: string): string {
    const domain = this.args.layout.domainImport(this.m, fromDir);
    return namedImport([`${this.P}ModuleDef`], `${domain}/contract`);
  }

  /** Вход прикладного слоя модуля из каталога `fromDir`: имя пакета или путь. */
  private entry(fromDir: string): string {
    const pkg = this.args.layout.package(this.m);
    if (pkg !== undefined) return pkg.name;
    const path = relative(fromDir, this.args.layout.appDir(this.m))
      .split(sep)
      .join('/');
    return path.startsWith('.') ? path : `./${path}`;
  }
}
