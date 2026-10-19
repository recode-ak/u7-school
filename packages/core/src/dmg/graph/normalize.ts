import type * as v from 'valibot';
import type { JobSchedule } from '#api/job/job';
import type { AnyAggregateDef } from '../domain/aggregate/define-aggregate';
import type { AnyEventReactionDef } from '../domain/contracts/define-event-reaction';
import type { AnyFacadeDef } from '../domain/contracts/define-facade';
import type { AnyJobDef } from '../domain/contracts/define-job';
import type { AnyModuleDef } from '../domain/contracts/define-module';
import type { AnyUseCaseDef } from '../domain/contracts/define-use-case';
import type { AnyEventDef } from '../domain/events/define-events';
import type { AnyPolicyDef } from '../domain/policy/define-policy';
import type { AnyRule } from '../domain/policy/policy';
import type { CallerKind } from '../kernel/caller/caller';
import type { AnyErrorDef } from '../kernel/errors/define-errors';
import type { ErrorKind } from '../kernel/errors/error';
import { toJsonSchema } from '../kernel/schema/json-schema';

type JsonSchema = ReturnType<typeof toJsonSchema>;

type Texts = {
  readonly name: string;
  readonly label: string;
  readonly description: string;
};

export type NormalizedError = {
  readonly dmg: 'error';
  readonly code: string;
  readonly kind: ErrorKind;
  readonly label: string;
  readonly description: string;
  readonly payload: JsonSchema | undefined;
};

export type NormalizedEvent = Texts & {
  readonly dmg: 'event';
  readonly payload: JsonSchema;
};

export type NormalizedAggregate = Texts & {
  readonly dmg: 'aggregate';
  readonly state: JsonSchema;
  readonly statuses: AnyAggregateDef['statuses'];
  readonly transitions: AnyAggregateDef['transitions'];
  readonly events: readonly string[];
  readonly errors: readonly string[];
};

type RuleTexts = {
  readonly name: string;
  readonly label: string;
  readonly denyMessage: string;
};

export type NormalizedRule =
  | (RuleTexts & {
      readonly dmg: 'rule';
      readonly op: 'rule';
      readonly delegable: boolean;
    })
  | (RuleTexts & {
      readonly dmg: 'rule';
      readonly op: 'anyOf';
      readonly rules: readonly NormalizedRule[];
    })
  | {
      readonly dmg: 'rule';
      readonly op: 'allOf';
      readonly rules: readonly NormalizedRule[];
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
  readonly policy: NormalizedRule | undefined;
  readonly input: JsonSchema;
  readonly output: JsonSchema;
  readonly errors: readonly string[];
  readonly emits: readonly string[];
};

export type NormalizedEventReaction = Texts & {
  readonly dmg: 'eventReaction';
  readonly on: readonly string[];
  readonly touches: readonly string[];
  readonly calls: readonly string[];
  readonly emits: readonly string[];
};

export type NormalizedJob = Texts & {
  readonly dmg: 'job';
  readonly schedule: JobSchedule;
  readonly scans: readonly string[];
  readonly emits: readonly string[];
};

export type NormalizedFacade = Texts & {
  readonly dmg: 'facade';
  readonly methods: {
    readonly [method: string]: {
      readonly label: string;
      readonly description: string;
      readonly errors: readonly string[];
    };
  };
};

export type NormalizedModule = Texts & {
  readonly dmg: 'module';
  readonly dependsOn: readonly string[];
  readonly aggregates: readonly string[];
  readonly useCases: readonly string[];
  readonly reactions: readonly string[];
  readonly jobs: readonly string[];
  readonly facade: string | undefined;
};

export type AnyDef =
  | AnyErrorDef
  | AnyEventDef
  | AnyAggregateDef
  | AnyRule
  | AnyPolicyDef
  | AnyUseCaseDef
  | AnyEventReactionDef
  | AnyJobDef
  | AnyFacadeDef
  | AnyModuleDef;

export type NormalizedDef =
  | NormalizedError
  | NormalizedEvent
  | NormalizedAggregate
  | NormalizedRule
  | NormalizedPolicy
  | NormalizedUseCase
  | NormalizedEventReaction
  | NormalizedJob
  | NormalizedFacade
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
export function normalize(def: AnyUseCaseDef): NormalizedUseCase;
export function normalize(def: AnyEventReactionDef): NormalizedEventReaction;
export function normalize(def: AnyJobDef): NormalizedJob;
export function normalize(def: AnyFacadeDef): NormalizedFacade;
export function normalize(def: AnyModuleDef): NormalizedModule;
export function normalize(def: AnyDef): NormalizedDef;
export function normalize(def: AnyDef): NormalizedDef {
  switch (def.dmg) {
    case 'error':
      return {
        dmg: 'error',
        code: def.code,
        kind: def.kind,
        label: def.label,
        description: def.description,
        payload: def.payload && schema(def.payload),
      };
    case 'event':
      return { dmg: 'event', ...texts(def), payload: schema(def.payload) };
    case 'aggregate':
      return {
        dmg: 'aggregate',
        ...texts(def),
        state: schema(def.state),
        statuses: def.statuses,
        transitions: def.transitions,
        events: Object.values(def.events).map((e) => e.name),
        errors: Object.values(def.errors).map((e) => e.code),
      };
    case 'rule':
      return normalizeRule(def);
    case 'policy':
      return {
        dmg: 'policy',
        ...texts(def),
        rules: Object.fromEntries(
          Object.entries(def.rules).map(([q, r]) => [q, normalizeRule(r)]),
        ),
      };
    case 'useCase':
      return {
        dmg: 'useCase',
        ...texts(def),
        type: def.type,
        aggregate: def.aggregate.name,
        callers: def.callers,
        policy: def.policy && normalizeRule(def.policy),
        input: schema(def.input),
        output: schema(def.output),
        errors: def.errors.map((e) => e.code),
        emits: (def.emits ?? []).map((e) => e.name),
      };
    case 'eventReaction':
      return {
        dmg: 'eventReaction',
        ...texts(def),
        on: def.on.map((e) => e.name),
        touches: def.touches.map((a) => a.name),
        calls: def.calls.map((f) => f.name),
        emits: def.emits.map((e) => e.name),
      };
    case 'job':
      return {
        dmg: 'job',
        ...texts(def),
        schedule: def.schedule,
        scans: def.scans.map((a) => a.name),
        emits: def.emits.map((e) => e.name),
      };
    case 'facade':
      return {
        dmg: 'facade',
        ...texts(def),
        methods: Object.fromEntries(
          Object.entries(def.methods).map(([name, m]) => [
            name,
            {
              label: m.label,
              description: m.description,
              errors: m.errors.map((e) => e.code),
            },
          ]),
        ),
      };
    case 'module':
      return {
        dmg: 'module',
        ...texts(def),
        dependsOn: def.dependsOn.map((m) => m.name),
        aggregates: def.aggregates.map((a) => a.name),
        useCases: def.useCases.map((u) => u.name),
        reactions: def.reactions.map((r) => r.name),
        jobs: def.jobs.map((j) => j.name),
        facade: def.facade?.name,
      };
  }
}

function texts(def: Texts): Texts {
  return { name: def.name, label: def.label, description: def.description };
}

function schema(s: v.GenericSchema): JsonSchema {
  return toJsonSchema(s);
}

function normalizeRule(r: AnyRule): NormalizedRule {
  switch (r.op) {
    case 'rule':
      return {
        dmg: 'rule',
        op: 'rule',
        name: r.name,
        label: r.label,
        denyMessage: r.denyMessage,
        delegable: r.delegable,
      };
    case 'anyOf':
      return {
        dmg: 'rule',
        op: 'anyOf',
        name: r.name,
        label: r.label,
        denyMessage: r.denyMessage,
        rules: r.rules.map(normalizeRule),
      };
    case 'allOf':
      return { dmg: 'rule', op: 'allOf', rules: r.rules.map(normalizeRule) };
  }
}
