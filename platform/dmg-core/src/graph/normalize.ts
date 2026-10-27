import type {
  AnyAggregateDef,
  NormalizedAggregate,
} from '../domain/aggregate/aggregate-def';
import type { AnyModuleDef } from '../domain/contracts/define-module';
import type {
  AnyEventReactionDef,
  NormalizedEventReaction,
} from '../domain/contracts/event-reaction-def';
import type { AnyJobDef, NormalizedJob } from '../domain/contracts/job-def';
import type {
  AnyUseCaseDef,
  NormalizedUseCase,
} from '../domain/contracts/use-case-def';
import type { AnyEventDef, NormalizedEvent } from '../domain/events/event-def';
import type {
  AnyPolicyDef,
  NormalizedPolicy,
} from '../domain/policy/policy-def';
import type { AnyRule, NormalizedRule } from '../domain/policy/rule';
import type {
  AnyDomainRule,
  NormalizedDomainRule,
} from '../domain/rules/domain-rule-def';
import type { AnyRulesDef, NormalizedRules } from '../domain/rules/rules-def';
import type { AnyErrorDef, NormalizedError } from '../kernel/errors/error-def';

export type {
  NormalizedAggregate,
  NormalizedTransition,
} from '../domain/aggregate/aggregate-def';
export type { NormalizedEventReaction } from '../domain/contracts/event-reaction-def';
export type { NormalizedJob } from '../domain/contracts/job-def';
export type { NormalizedUseCase } from '../domain/contracts/use-case-def';
export type { NormalizedEvent } from '../domain/events/event-def';
export type { NormalizedPolicy } from '../domain/policy/policy-def';
export type { NormalizedRule } from '../domain/policy/rule';
export type { NormalizedDomainRule } from '../domain/rules/domain-rule-def';
export type { NormalizedRules } from '../domain/rules/rules-def';
export type { NormalizedError } from '../kernel/errors/error-def';

type Texts = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
};

export type NormalizedModule = Texts & {
  readonly dmg: 'module';
  /** Реализован вне приложения — только контракт (D-37). */
  readonly external: boolean;
  readonly dependsOn: readonly string[];
  readonly aggregates: readonly string[];
  readonly useCases: readonly string[];
  readonly reactions: readonly string[];
  readonly jobs: readonly string[];
};

export type AnyDef =
  | AnyErrorDef
  | AnyEventDef
  | AnyAggregateDef
  | AnyRule
  | AnyPolicyDef
  | AnyDomainRule
  | AnyRulesDef
  | AnyUseCaseDef
  | AnyEventReactionDef
  | AnyJobDef
  | AnyModuleDef;

export type NormalizedDef =
  | NormalizedError
  | NormalizedEvent
  | NormalizedAggregate
  | NormalizedRule
  | NormalizedPolicy
  | NormalizedDomainRule
  | NormalizedRules
  | NormalizedUseCase
  | NormalizedEventReaction
  | NormalizedJob
  | NormalizedModule;

/**
 * Сериализуемое представление Def — основа графа, документации и хеша (D-27).
 * Ссылки → имена/FQN/коды, схемы → JSON Schema, функции отброшены.
 * Порядок ключей фиксирован: одинаковый Def даёт одинаковый JSON.
 */
export function normalize(def: AnyErrorDef): NormalizedError;
export function normalize(def: AnyEventDef): NormalizedEvent;
export function normalize(def: AnyAggregateDef): NormalizedAggregate;
export function normalize(def: AnyRule): NormalizedRule;
export function normalize(def: AnyPolicyDef): NormalizedPolicy;
export function normalize(def: AnyDomainRule): NormalizedDomainRule;
export function normalize(def: AnyRulesDef): NormalizedRules;
export function normalize(def: AnyUseCaseDef): NormalizedUseCase;
export function normalize(def: AnyEventReactionDef): NormalizedEventReaction;
export function normalize(def: AnyJobDef): NormalizedJob;
export function normalize(def: AnyModuleDef): NormalizedModule;
export function normalize(def: AnyDef): NormalizedDef;
export function normalize(def: AnyDef): NormalizedDef {
  switch (def.dmg) {
    case 'error':
    case 'event':
    case 'aggregate':
    case 'rule':
    case 'policy':
    case 'domainRule':
    case 'rules':
    case 'useCase':
    case 'eventReaction':
    case 'job':
      return def.normalize();
    case 'module':
      return {
        dmg: 'module',
        ...texts(def),
        external: def.external ?? false,
        dependsOn: def.dependsOn.map((m) => m.name),
        aggregates: def.aggregates.map((a) => a.name),
        useCases: def.useCases.map((u) => u.name),
        reactions: def.reactions.map((r) => r.name),
        jobs: def.jobs.map((j) => j.name),
      };
  }
}

function texts(def: Texts): Texts {
  return { name: def.name, label: def.label, description: def.description };
}
