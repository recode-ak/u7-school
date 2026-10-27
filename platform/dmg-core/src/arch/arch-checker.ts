import type { AnyModuleDef } from '../domain/contracts/module-def';
import { DefIndex } from '../graph/def-index';
import { AssemblyChecker } from './assembly-checker';
import type { AssemblyPlaces } from './assembly-checker.types';
import { DefChecker } from './def-checker';
import { FileChecker, type ModuleLayout } from './file-checker';
import type { Violation } from './violation';

/**
 * Приложение для `arch:check`: корневые модули, где лежат их файлы и вход
 * модуля домена для других (`entry`, по умолчанию `index`; см. `FileChecker`);
 * необязательно — каталог корня сборки (`root`) и каталоги раннеров
 * (`runners`), их импорты проверяет `AssemblyChecker` (D-52).
 */
export type ArchApp = {
  readonly name: string;
  readonly modules: readonly AnyModuleDef[];
  readonly layout: (module: string) => ModuleLayout;
  readonly entry?: string;
  readonly root?: string;
  readonly runners?: readonly string[];
};

/**
 * Контрактные проверки архитектуры по индексу Def: проверки Def
 * (`DefChecker`), а при заданной раскладке модулей — и по файлам модулей
 * (`FileChecker`), корня сборки и раннеров (`AssemblyChecker`). Без
 * раскладки — только Def: так проверяют модуль домена в его тесте.
 */
export class ArchChecker {
  private readonly defs: DefChecker;
  private readonly files: FileChecker | undefined;
  private readonly assembly: AssemblyChecker | undefined;

  constructor(
    index: DefIndex,
    layout?: (module: string) => ModuleLayout,
    entry = 'index',
    places: AssemblyPlaces = {},
  ) {
    this.defs = new DefChecker(index);
    this.files = layout && new FileChecker(index, layout, entry);
    this.assembly = layout && new AssemblyChecker(index, layout, entry, places);
  }

  /** Все проверки приложения: по Def, по файлам модулей и вокруг них. */
  static of(app: ArchApp): ArchChecker {
    return new ArchChecker(DefIndex.from(app.modules), app.layout, app.entry, {
      root: app.root,
      runners: app.runners,
    });
  }

  /** Только проверки Def по корневым модулям — для теста модуля домена. */
  static defsOf(roots: readonly AnyModuleDef[]): ArchChecker {
    return new ArchChecker(DefIndex.from(roots));
  }

  check(): Violation[] {
    return [
      ...this.defs.check(),
      ...(this.files?.check() ?? []),
      ...(this.assembly?.check() ?? []),
    ];
  }

  /** Строки отчёта: `<ID правила>: <сообщение>`. */
  report(): string[] {
    return this.check().map((v) => v.format());
  }
}
