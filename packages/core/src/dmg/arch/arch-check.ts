import type { AnyModuleDef } from '../domain/contracts/define-module';
import { indexDefs } from '../graph/def-index';
import { checkDefs } from './check-defs';
import { checkFiles, type ModuleLayout } from './check-files';
import type { Violation } from './violation';

/** Приложение для `arch:check`: корневые модули и где лежат их файлы. */
export type ArchApp = {
  readonly name: string;
  readonly modules: readonly AnyModuleDef[];
  readonly layout: (module: string) => ModuleLayout;
};

/** Все контрактные проверки приложения: по Def и по файлам модулей. */
export function archCheck(app: ArchApp): Violation[] {
  const index = indexDefs(app.modules);
  return [...checkDefs(index), ...checkFiles(index, app.layout)];
}
