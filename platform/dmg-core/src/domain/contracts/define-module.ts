import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { AnyEventReactionDef } from './define-event-reaction';
import type { AnyJobDef } from './define-job';
import type { AnyUseCaseDef } from './define-use-case';

export type ModuleSpec = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  /**
   * Модуль реализован вне приложения (legacy-код или другой сервис): здесь
   * только его контракт — агрегаты с событиями и Def UC без реализации
   * (цели `calls` других модулей). События публикует внешняя сторона;
   * ER и Job не объявляются (D-37, D-42).
   */
  readonly external?: boolean;
  /** Модули, от которых этот зависит (ARC: DAG, проверяет `arch:check`). */
  readonly dependsOn: readonly AnyModuleDef[];
  readonly aggregates: readonly AnyAggregateDef[];
  readonly useCases: readonly AnyUseCaseDef[];
  readonly reactions: readonly AnyEventReactionDef[];
  readonly jobs: readonly AnyJobDef[];
};

export type ModuleDef<S extends ModuleSpec> = S & { readonly dmg: 'module' };

export type AnyModuleDef = ModuleDef<ModuleSpec>;

/**
 * Паспорт модуля: зависимости и состав. Фасада здесь нет — это рантайм-
 * граница модуля, связи объявляет `calls` операций (D-42).
 */
export function defineModule<const S extends ModuleSpec>(
  spec: S,
): ModuleDef<S> {
  return { ...spec, dmg: 'module' };
}
