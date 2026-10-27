import type * as v from 'valibot';
import type {
  AnyAggregateDef,
  NormalizedAggregate,
} from '../domain/aggregate/aggregate-def';
import type { AnyEventReactionDef } from '../domain/contracts/define-event-reaction';
import type { AnyJobDef, JobSchedule } from '../domain/contracts/define-job';
import type { AnyModuleDef } from '../domain/contracts/define-module';
import type { AnyUseCaseDef } from '../domain/contracts/define-use-case';
import type { AnyEventDef, NormalizedEvent } from '../domain/events/event-def';
import type { AnyPolicyDef } from '../domain/policy/define-policy';
import type { AnyRule, NormalizedRule } from '../domain/policy/rule';
import type {
  AnyDomainRule,
  NormalizedDomainRule,
} from '../domain/rules/domain-rule-def';
import type { AnyRulesDef, NormalizedRules } from '../domain/rules/rules-def';
import type { CallerKind } from '../kernel/caller/caller';
import type { AnyErrorDef, NormalizedError } from '../kernel/errors/error-def';
import { toJsonSchema } from '../kernel/schema/json-schema';

type JsonSchema = ReturnType<typeof toJsonSchema>;

export type {
  NormalizedAggregate,
  NormalizedTransition,
} from '../domain/aggregate/aggregate-def';
export type { NormalizedEvent } from '../domain/events/event-def';
export type { NormalizedRule } from '../domain/policy/rule';
export type { NormalizedDomainRule } from '../domain/rules/domain-rule-def';
export type { NormalizedRules } from '../domain/rules/rules-def';
export type { NormalizedError } from '../kernel/errors/error-def';

type Texts = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
};

export type NormalizedPolicy = Texts & {
  readonly dmg: 'policy';
  readonly rules: { readonly [question: string]: NormalizedRule };
};

export type NormalizedUseCase = Texts & {
  readonly dmg: 'useCase';
  readonly type: 'command' | 'query';
  readonly aggregate: string;
  readonly callers: readonly CallerKind[];
  readonly policy: NormalizedRule;
  readonly input: JsonSchema;
  readonly output: JsonSchema;
  readonly errors: readonly string[];
  /** Имена доменных правил UC. */
  readonly rules: readonly string[];
  /** Имена UC других модулей, которые UC вызывает (D-42). */
  readonly calls: readonly string[];
  readonly emits: readonly string[];
};

export type NormalizedEventReaction = Texts & {
  readonly dmg: 'eventReaction';
  readonly on: readonly string[];
  readonly touches: readonly string[];
  /** Имена UC других модулей, которые реакция вызывает (D-42). */
  readonly calls: readonly string[];
  readonly emits: readonly string[];
};

export type NormalizedJob = Texts & {
  readonly dmg: 'job';
  readonly schedule: JobSchedule;
  readonly scans: readonly string[];
  /** Имена UC других модулей, которые задание вызывает (D-42). */
  readonly calls: readonly string[];
  readonly emits: readonly string[];
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
      return def.normalize();
    case 'rule':
      return def.normalize();
    case 'policy':
      return {
        dmg: 'policy',
        ...texts(def),
        rules: Object.fromEntries(
          Object.entries(def.rules).map(([q, r]) => [q, r.normalize()]),
        ),
      };
    case 'domainRule':
    case 'rules':
      return def.normalize();
    case 'useCase':
      return {
        dmg: 'useCase',
        ...texts(def),
        type: def.type,
        aggregate: def.aggregate.name,
        callers: def.callers,
        policy: def.policy.normalize(),
        input: schema(def.input),
        output: schema(def.output),
        errors: def.errors.map((e) => e.code),
        rules: (def.rules ?? []).map((r) => r.name),
        calls: (def.calls ?? []).map((u) => u.name),
        emits: (def.emits ?? []).map((e) => e.name),
      };
    case 'eventReaction':
      return {
        dmg: 'eventReaction',
        ...texts(def),
        on: def.on.map((e) => e.name),
        touches: def.touches.map((a) => a.name),
        calls: def.calls.map((u) => u.name),
        emits: def.emits.map((e) => e.name),
      };
    case 'job':
      return {
        dmg: 'job',
        ...texts(def),
        schedule: def.schedule,
        scans: def.scans.map((a) => a.name),
        calls: def.calls.map((u) => u.name),
        emits: def.emits.map((e) => e.name),
      };
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

function schema(s: v.GenericSchema): JsonSchema {
  return toJsonSchema(s);
}
