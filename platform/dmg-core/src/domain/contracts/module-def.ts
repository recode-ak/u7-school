import { Def } from '#core/kernel/def/def';
import type { AnyAggregateDef } from '../aggregate/aggregate-def';
import type { ModuleSpec, NormalizedModule } from './module-def.types';
import type { AnyOperationDef } from './operation-def.types';

export type {
  AnyModuleDef,
  ModuleSpec,
  NormalizedModule,
} from './module-def.types';

/**
 * Паспорт модуля: зависимости и состав. Фасада здесь нет — это рантайм-
 * граница модуля, связи объявляет `calls` операций (D-42).
 */
export class ModuleDef<const S extends ModuleSpec = ModuleSpec> extends Def<
  S['name']
> {
  readonly dmg = 'module';
  /** Реализован вне приложения — только контракт (D-37); по умолчанию нет. */
  readonly external: boolean;
  readonly dependsOn: S['dependsOn'];
  readonly aggregates: S['aggregates'];
  readonly useCases: S['useCases'];
  readonly reactions: S['reactions'];
  readonly jobs: S['jobs'];

  constructor(spec: S) {
    super(spec);
    this.external = spec.external ?? false;
    this.dependsOn = spec.dependsOn;
    this.aggregates = spec.aggregates;
    this.useCases = spec.useCases;
    this.reactions = spec.reactions;
    this.jobs = spec.jobs;
  }

  static define<const S extends ModuleSpec>(spec: S): ModuleDef<S> {
    return new ModuleDef(spec);
  }

  /** Операции модуля: UC, ER, Job — в этом порядке. */
  operations(): readonly AnyOperationDef[] {
    return [...this.useCases, ...this.reactions, ...this.jobs];
  }

  /** Id агрегата или операции модуля в графе: `module.name`. */
  localId(def: AnyAggregateDef | AnyOperationDef): string {
    return `${this.name}.${def.name}`;
  }

  normalize(): NormalizedModule {
    return {
      dmg: this.dmg,
      ...this.texts(),
      external: this.external,
      dependsOn: this.dependsOn.map((m) => m.name),
      aggregates: this.aggregates.map((a) => a.name),
      useCases: this.useCases.map((u) => u.name),
      reactions: this.reactions.map((r) => r.name),
      jobs: this.jobs.map((j) => j.name),
    };
  }
}
