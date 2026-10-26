import type { AnyModuleDef } from '../domain/contracts/define-module';
import { indexDefs } from '../graph/def-index';
import { checkDefs } from './check-defs';
import { checkFiles, type ModuleLayout } from './check-files';
import type { Violation } from './violation';

/**
 * Приложение для `arch:check`: корневые модули, где лежат их файлы и вход
 * модуля домена для других (`entry`, по умолчанию `index`; см. `checkFiles`).
 */
export type ArchApp = {
  readonly name: string;
  readonly modules: readonly AnyModuleDef[];
  readonly layout: (module: string) => ModuleLayout;
  readonly entry?: string;
};

/** Все контрактные проверки приложения: по Def и по файлам модулей. */
export function archCheck(app: ArchApp): Violation[] {
  const index = indexDefs(app.modules);
  return [...checkDefs(index), ...checkFiles(index, app.layout, app.entry)];
}
