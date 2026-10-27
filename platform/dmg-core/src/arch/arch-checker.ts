import type { AnyModuleDef } from '../domain/contracts/define-module';
import { DefIndex } from '../graph/def-index';
import { DefChecker } from './def-checker';
import { FileChecker, type ModuleLayout } from './file-checker';
import type { Violation } from './violation';

/**
 * Приложение для `arch:check`: корневые модули, где лежат их файлы и вход
 * модуля домена для других (`entry`, по умолчанию `index`; см. `FileChecker`).
 */
export type ArchApp = {
  readonly name: string;
  readonly modules: readonly AnyModuleDef[];
  readonly layout: (module: string) => ModuleLayout;
  readonly entry?: string;
};

/**
 * Контрактные проверки архитектуры по индексу Def: проверки Def
 * (`DefChecker`), а при заданной раскладке модулей — и по файлам
 * (`FileChecker`). Без раскладки — только Def: так проверяют модуль домена
 * в его тесте.
 */
export class ArchChecker {
  private readonly defs: DefChecker;
  private readonly files: FileChecker | undefined;

  constructor(
    index: DefIndex,
    layout?: (module: string) => ModuleLayout,
    entry?: string,
  ) {
    this.defs = new DefChecker(index);
    this.files = layout && new FileChecker(index, layout, entry);
  }

  /** Все проверки приложения: по Def и по файлам модулей. */
  static of(app: ArchApp): ArchChecker {
    return new ArchChecker(DefIndex.from(app.modules), app.layout, app.entry);
  }

  check(): Violation[] {
    return [...this.defs.check(), ...(this.files?.check() ?? [])];
  }
}
