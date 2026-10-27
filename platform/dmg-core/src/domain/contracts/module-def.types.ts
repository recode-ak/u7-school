import type { DefTexts } from '#core/kernel/def/def';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { AnyEventReactionDef } from './event-reaction-def.types';
import type { AnyJobDef } from './job-def.types';
import type { ModuleDef } from './module-def';
import type { AnyUseCaseDef } from './use-case-def.types';

export type ModuleSpec = DefTexts & {
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

/** Любой Def модуля — структурный тип публичных членов (как `AnyUseCaseDef`). */
export type AnyModuleDef = { readonly [K in keyof ModuleDef]: ModuleDef[K] };

/** Сериализуемая форма модуля. */
export type NormalizedModule = DefTexts & {
  readonly dmg: 'module';
  /** Реализован вне приложения — только контракт (D-37). */
  readonly external: boolean;
  readonly dependsOn: readonly string[];
  readonly aggregates: readonly string[];
  readonly useCases: readonly string[];
  readonly reactions: readonly string[];
  readonly jobs: readonly string[];
};
