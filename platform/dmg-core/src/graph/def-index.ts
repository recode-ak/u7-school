import type { AnyAggregateDef } from '../domain/aggregate/aggregate-def';
import type { AnyModuleDef } from '../domain/contracts/module-def';
import type { AnyOperationDef } from '../domain/contracts/operation-def.types';
import type { AnyEventDef } from '../domain/events/event-def';
import type { AnyDomainRule } from '../domain/rules/domain-rule-def';
import type { AnyErrorDef } from '../kernel/errors/error-def';

export type { AnyOperationDef };

/**
 * Def приложения по ссылкам, с владельцами. Модули — замыкание корней по
 * `dependsOn` (цикл не мешает обходу). Сравнение по ссылке на Def: два
 * разных Def с одним именем — разные Def (их ловит `arch:check`).
 */
export class DefIndex {
  private readonly moduleOwner = new Map<
    AnyAggregateDef | AnyOperationDef,
    AnyModuleDef
  >();
  private readonly aggregateOwner = new Map<
    AnyEventDef | AnyErrorDef,
    AnyAggregateDef
  >();

  private constructor(readonly modules: readonly AnyModuleDef[]) {
    for (const m of modules) {
      for (const a of m.aggregates) {
        this.moduleOwner.set(a, m);
        for (const e of Object.values(a.events)) this.aggregateOwner.set(e, a);
        for (const e of Object.values(a.errors)) this.aggregateOwner.set(e, a);
      }
      for (const op of m.operations()) this.moduleOwner.set(op, m);
    }
  }

  static from(roots: readonly AnyModuleDef[]): DefIndex {
    const modules: AnyModuleDef[] = [];
    const visit = (m: AnyModuleDef): void => {
      if (modules.includes(m)) return;
      modules.push(m);
      for (const dep of m.dependsOn) visit(dep);
    };
    for (const m of roots) visit(m);
    return new DefIndex(modules);
  }

  /** Операции всех модулей индекса. */
  operations(): readonly AnyOperationDef[] {
    return this.modules.flatMap((m) => m.operations());
  }

  /** Модуль-владелец агрегата или операции; вне индекса — `undefined`. */
  moduleOf(def: AnyAggregateDef | AnyOperationDef): AnyModuleDef | undefined {
    return this.moduleOwner.get(def);
  }

  /** Агрегат-владелец события или ошибки; вне индекса — `undefined`. */
  aggregateOf(def: AnyEventDef | AnyErrorDef): AnyAggregateDef | undefined {
    return this.aggregateOwner.get(def);
  }

  /** Id агрегата или операции в графе: `module.name`; вне индекса — `?.name`. */
  id(def: AnyAggregateDef | AnyOperationDef): string {
    return this.moduleOf(def)?.localId(def) ?? `?.${def.name}`;
  }

  /**
   * Id доменного правила: `module.aggregate.name` по агрегату-владельцу его
   * ошибки (D-40, DOM-16), а не по модулю ссылающегося UC. Правила с одним
   * `name` у разных агрегатов модуля различаются. Ошибка вне модулей
   * индекса — `?.?.name`.
   */
  ruleId(rule: AnyDomainRule): {
    readonly id: string;
    readonly module: string;
  } {
    const aggregate = this.aggregateOf(rule.error);
    const owner = aggregate && this.moduleOf(aggregate);
    if (!aggregate || !owner) return { id: `?.?.${rule.name}`, module: '?' };
    return {
      id: `${owner.localId(aggregate)}.${rule.name}`,
      module: owner.name,
    };
  }
}
