import type { AnyAggregateDef } from '../aggregate/define-aggregate';
import type { AnyEventReactionDef } from './define-event-reaction';
import type { AnyFacadeDef } from './define-facade';
import type { AnyJobDef } from './define-job';
import type { AnyUseCaseDef } from './define-use-case';

export type ModuleSpec = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
  /** Модули, от которых этот зависит (ARC: DAG, проверяет `arch:check`). */
  readonly dependsOn: readonly AnyModuleDef[];
  readonly aggregates: readonly AnyAggregateDef[];
  readonly useCases: readonly AnyUseCaseDef[];
  readonly reactions: readonly AnyEventReactionDef[];
  readonly jobs: readonly AnyJobDef[];
  readonly facade?: AnyFacadeDef;
};

export type ModuleDef<S extends ModuleSpec> = S & { readonly dmg: 'module' };

export type AnyModuleDef = ModuleDef<ModuleSpec>;

/** Паспорт модуля: зависимости и состав. */
export function defineModule<const S extends ModuleSpec>(
  spec: S,
): ModuleDef<S> {
  return { ...spec, dmg: 'module' };
}
