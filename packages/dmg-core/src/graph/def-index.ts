import type { AnyAggregateDef } from '../domain/aggregate/define-aggregate';
import type { AnyEventReactionDef } from '../domain/contracts/define-event-reaction';
import type { AnyJobDef } from '../domain/contracts/define-job';
import type { AnyModuleDef } from '../domain/contracts/define-module';
import type { AnyUseCaseDef } from '../domain/contracts/define-use-case';
import type { AnyEventDef } from '../domain/events/define-events';
import type { AnyDomainRule } from '../domain/rules/domain-rule';
import type { AnyErrorDef } from '../kernel/errors/define-errors';

/** Def операции модуля: UC, ER или Job. */
export type AnyOperationDef = AnyUseCaseDef | AnyEventReactionDef | AnyJobDef;

/**
 * Def приложения по ссылкам, с владельцами. Модули — замыкание корней по
 * `dependsOn` (цикл не мешает обходу). Сравнение по ссылке на Def: два
 * разных Def с одним именем — разные Def (их ловит `arch:check`).
 */
export type DefIndex = {
  readonly modules: readonly AnyModuleDef[];
  readonly aggregateOwner: ReadonlyMap<AnyAggregateDef, AnyModuleDef>;
  readonly eventOwner: ReadonlyMap<AnyEventDef, AnyAggregateDef>;
  readonly errorOwner: ReadonlyMap<AnyErrorDef, AnyAggregateDef>;
  readonly operationOwner: ReadonlyMap<AnyOperationDef, AnyModuleDef>;
};

export function indexDefs(roots: readonly AnyModuleDef[]): DefIndex {
  const modules: AnyModuleDef[] = [];
  const visit = (m: AnyModuleDef): void => {
    if (modules.includes(m)) return;
    modules.push(m);
    for (const dep of m.dependsOn) visit(dep);
  };
  for (const m of roots) visit(m);

  const aggregateOwner = new Map<AnyAggregateDef, AnyModuleDef>();
  const eventOwner = new Map<AnyEventDef, AnyAggregateDef>();
  const errorOwner = new Map<AnyErrorDef, AnyAggregateDef>();
  const operationOwner = new Map<AnyOperationDef, AnyModuleDef>();
  for (const m of modules) {
    for (const a of m.aggregates) {
      aggregateOwner.set(a, m);
      for (const e of Object.values(a.events)) eventOwner.set(e, a);
      for (const e of Object.values(a.errors)) errorOwner.set(e, a);
    }
    for (const op of operationsOf(m)) operationOwner.set(op, m);
  }
  return {
    modules,
    aggregateOwner,
    eventOwner,
    errorOwner,
    operationOwner,
  };
}

export function operationsOf(m: AnyModuleDef): readonly AnyOperationDef[] {
  return [...m.useCases, ...m.reactions, ...m.jobs];
}

/** UC других модулей, которые операция вызывает через фасады (D-42). */
export function callsOf(op: AnyOperationDef): readonly AnyUseCaseDef[] {
  return op.dmg === 'useCase' ? (op.calls ?? []) : op.calls;
}

/** Id агрегата и операции в графе: `module.name`. */
export function localId(module: AnyModuleDef, def: { name: string }): string {
  return `${module.name}.${def.name}`;
}

/**
 * Id доменного правила: `module.aggregate.name` по агрегату-владельцу его
 * ошибки (D-40, DOM-16), а не по модулю ссылающегося UC. Правила с одним
 * `name` у разных агрегатов модуля различаются. Ошибка вне модулей
 * индекса — `?.?.name`.
 */
export function ruleId(
  index: DefIndex,
  rule: AnyDomainRule,
): { readonly id: string; readonly module: string } {
  const aggregate = index.errorOwner.get(rule.error);
  const owner = aggregate && index.aggregateOwner.get(aggregate);
  if (!aggregate || !owner) return { id: `?.?.${rule.name}`, module: '?' };
  return {
    id: `${localId(owner, aggregate)}.${rule.name}`,
    module: owner.name,
  };
}
