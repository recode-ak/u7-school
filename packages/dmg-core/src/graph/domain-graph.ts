import type { AnyAggregateDef } from '../domain/aggregate/define-aggregate';
import type { AnyModuleDef } from '../domain/contracts/define-module';
import type { AnyEventDef } from '../domain/events/define-events';
import type { AnyDomainRule } from '../domain/rules/domain-rule';
import type { AnyErrorDef } from '../kernel/errors/define-errors';
import { type DefIndex, indexDefs, localId, ruleId } from './def-index';
import {
  type NormalizedAggregate,
  type NormalizedDomainRule,
  type NormalizedError,
  type NormalizedEvent,
  type NormalizedEventReaction,
  type NormalizedFacade,
  type NormalizedJob,
  type NormalizedModule,
  type NormalizedUseCase,
  normalize,
} from './normalize';

/** Связь L0 между модулями. */
export type ModuleLink =
  | { readonly kind: 'dependsOn'; readonly from: string; readonly to: string }
  | {
      readonly kind: 'event';
      readonly from: string;
      readonly to: string;
      readonly event: string;
      readonly reaction: string;
    }
  | {
      readonly kind: 'calls';
      readonly from: string;
      readonly to: string;
      readonly facade: string;
      readonly reaction: string;
    };

export type ModuleNode = {
  readonly def: NormalizedModule;
  readonly facade: NormalizedFacade | undefined;
};

type Owned<N> = {
  readonly id: string;
  readonly module: string;
  readonly def: N;
};

/** L1/L2: статусы, переходы и ошибки — в `def`; обратные связи — здесь. */
export type AggregateNode = Owned<NormalizedAggregate> & {
  readonly useCases: readonly string[];
  readonly reactions: readonly string[];
  readonly jobs: readonly string[];
};

export type UseCaseNode = Owned<NormalizedUseCase> & {
  readonly aggregate: string;
  /** Id доменных правил UC. */
  readonly rules: readonly string[];
};

/**
 * Доменное правило (D-40). Id — `module.aggregate.name`, модуль — по
 * агрегату-владельцу ошибки правила (ошибка своей группы, DOM-16), а не по
 * UC; `?` — ошибка вне модулей графа.
 */
export type DomainRuleNode = Owned<NormalizedDomainRule> & {
  /** UC, которые ссылаются на правило. */
  readonly usedBy: readonly string[];
};

export type ReactionNode = Owned<NormalizedEventReaction> & {
  readonly touches: readonly string[];
};

export type JobNode = Owned<NormalizedJob> & {
  readonly scans: readonly string[];
};

export type EventNode = {
  readonly def: NormalizedEvent;
  /** Id агрегата-владельца; `?.<имя>` — событие вне модулей графа. */
  readonly aggregate: string | undefined;
  readonly publishers: readonly string[];
  readonly subscribers: readonly string[];
};

export type ErrorNode = {
  readonly def: NormalizedError;
  /** `undefined` — базовая ошибка ядра или ошибка вне модулей графа. */
  readonly aggregate: string | undefined;
  /** UC и фасады (id = имя модуля), которые объявляют ошибку. */
  readonly usedBy: readonly string[];
};

/**
 * Граф домена (D-11): L0 — `modules` и `links`, L1 — узлы модуля и их
 * связи, L2 — статусы, переходы и ошибки в узлах агрегатов и UC. Ключи
 * узлов — id: `module.name` для агрегатов и операций, FQN для событий, код
 * для ошибок. Порядок — порядок объявления, JSON детерминирован.
 */
export type DomainGraph = {
  readonly modules: Readonly<Record<string, ModuleNode>>;
  readonly links: readonly ModuleLink[];
  readonly aggregates: Readonly<Record<string, AggregateNode>>;
  readonly useCases: Readonly<Record<string, UseCaseNode>>;
  readonly rules: Readonly<Record<string, DomainRuleNode>>;
  readonly reactions: Readonly<Record<string, ReactionNode>>;
  readonly jobs: Readonly<Record<string, JobNode>>;
  readonly events: Readonly<Record<string, EventNode>>;
  readonly errors: Readonly<Record<string, ErrorNode>>;
};

type Mutable<T> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer I)[] ? I[] : T[K];
};

/** Граф по корневым модулям приложения (зависимости подтягиваются сами). */
export function buildGraph(roots: readonly AnyModuleDef[]): DomainGraph {
  return new GraphBuilder(indexDefs(roots)).build();
}

class GraphBuilder {
  private readonly modules: Record<string, ModuleNode> = {};
  private readonly links: ModuleLink[] = [];
  private readonly aggregates: Record<string, Mutable<AggregateNode>> = {};
  private readonly useCases: Record<string, UseCaseNode> = {};
  private readonly rules: Record<string, Mutable<DomainRuleNode>> = {};
  private readonly reactions: Record<string, ReactionNode> = {};
  private readonly jobs: Record<string, JobNode> = {};
  private readonly events: Record<string, Mutable<EventNode>> = {};
  private readonly errors: Record<string, Mutable<ErrorNode>> = {};

  constructor(private readonly index: DefIndex) {}

  build(): DomainGraph {
    for (const m of this.index.modules) this.addModule(m);
    for (const m of this.index.modules) {
      for (const dep of m.dependsOn) {
        this.links.push({ kind: 'dependsOn', from: m.name, to: dep.name });
      }
    }
    for (const m of this.index.modules) this.addOperations(m);
    return {
      modules: this.modules,
      links: this.links,
      aggregates: this.aggregates,
      useCases: this.useCases,
      rules: this.rules,
      reactions: this.reactions,
      jobs: this.jobs,
      events: this.events,
      errors: this.errors,
    };
  }

  private addModule(m: AnyModuleDef): void {
    this.modules[m.name] = {
      def: normalize(m),
      facade: m.facade && normalize(m.facade),
    };
    for (const a of m.aggregates) {
      const id = localId(m, a);
      this.aggregates[id] = {
        id,
        module: m.name,
        def: normalize(a),
        useCases: [],
        reactions: [],
        jobs: [],
      };
      for (const e of Object.values(a.events)) this.event(e);
      for (const e of Object.values(a.errors)) this.error(e);
    }
  }

  private addOperations(m: AnyModuleDef): void {
    for (const uc of m.useCases) {
      const id = localId(m, uc);
      const aggregate = this.aggregateId(uc.aggregate);
      const rules = (uc.rules ?? []).map((r) => {
        const node = this.rule(r);
        node.usedBy.push(id);
        return node.id;
      });
      this.useCases[id] = {
        id,
        module: m.name,
        def: normalize(uc),
        aggregate,
        rules,
      };
      this.aggregates[aggregate]?.useCases.push(id);
      for (const e of uc.emits ?? []) this.event(e).publishers.push(id);
      for (const e of uc.errors) this.error(e).usedBy.push(id);
    }
    if (m.facade) {
      for (const method of Object.values(m.facade.methods)) {
        for (const e of method.errors) this.error(e).usedBy.push(m.name);
      }
    }
    for (const er of m.reactions) {
      const id = localId(m, er);
      const touches = er.touches.map((a) => this.aggregateId(a));
      this.reactions[id] = { id, module: m.name, def: normalize(er), touches };
      for (const a of touches) this.aggregates[a]?.reactions.push(id);
      for (const e of er.emits) this.event(e).publishers.push(id);
      for (const e of er.on) {
        this.event(e).subscribers.push(id);
        const from = this.eventModule(e);
        if (from !== undefined && from !== m.name) {
          this.links.push({
            kind: 'event',
            from,
            to: m.name,
            event: e.name,
            reaction: id,
          });
        }
      }
      for (const f of er.calls) {
        const to = this.index.facadeOwner.get(f)?.name;
        if (to !== undefined && to !== m.name) {
          this.links.push({
            kind: 'calls',
            from: m.name,
            to,
            facade: f.name,
            reaction: id,
          });
        }
      }
    }
    for (const job of m.jobs) {
      const id = localId(m, job);
      const scans = job.scans.map((a) => this.aggregateId(a));
      this.jobs[id] = { id, module: m.name, def: normalize(job), scans };
      for (const a of scans) this.aggregates[a]?.jobs.push(id);
      for (const e of job.emits) this.event(e).publishers.push(id);
    }
  }

  private aggregateId(a: AnyAggregateDef): string {
    const owner = this.index.aggregateOwner.get(a);
    return owner ? localId(owner, a) : `?.${a.name}`;
  }

  private eventModule(e: AnyEventDef): string | undefined {
    const a = this.index.eventOwner.get(e);
    return a && this.index.aggregateOwner.get(a)?.name;
  }

  private rule(r: AnyDomainRule): Mutable<DomainRuleNode> {
    const { id, module } = ruleId(this.index, r);
    const known = this.rules[id];
    if (known) return known;
    const node = { id, module, def: normalize(r), usedBy: [] };
    this.rules[id] = node;
    return node;
  }

  private event(e: AnyEventDef): Mutable<EventNode> {
    const known = this.events[e.name];
    if (known) return known;
    const owner = this.index.eventOwner.get(e);
    const node = {
      def: normalize(e),
      aggregate: owner && this.aggregateId(owner),
      publishers: [],
      subscribers: [],
    };
    this.events[e.name] = node;
    return node;
  }

  private error(e: AnyErrorDef): Mutable<ErrorNode> {
    const known = this.errors[e.code];
    if (known) return known;
    const owner = this.index.errorOwner.get(e);
    const node = {
      def: normalize(e),
      aggregate: owner && this.aggregateId(owner),
      usedBy: [],
    };
    this.errors[e.code] = node;
    return node;
  }
}
