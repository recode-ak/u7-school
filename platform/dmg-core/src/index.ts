// Платформа DMG (Domain Manifest Graph) — пакет dmg-core.
// Корень — ядро и манифесты домена (`define*`, `Aggregate`, `Result`, Policy,
// доменные правила): чистый код без IO, его импортирует домен. Исполнение —
// `dmg-core/app`, граф манифестов — `dmg-core/graph`, проверки архитектуры —
// `dmg-core/arch`.

export { Aggregate } from './domain/aggregate/aggregate';
export type {
  ErrorsOf,
  EventsOf,
  RejectOf,
  StateOf,
  TransitionOf,
} from './domain/aggregate/aggregate.types';
export {
  AggregateDef,
  type AggregateSpec,
  type AnyAggregateDef,
  type EntityBase,
  type StateSchema,
  type StatusOf,
  type Transition,
} from './domain/aggregate/aggregate-def';
export { defineAggregate } from './domain/aggregate/define-aggregate';
export type { ReadonlyAr } from './domain/aggregate/readonly-ar';
export {
  type AnyEventReactionDef,
  defineEventReaction,
  type EventReactionDef,
  type EventReactionSpec,
  type ReactionEventOf,
} from './domain/contracts/define-event-reaction';
export {
  type AnyJobDef,
  defineJob,
  type JobDef,
  type JobSchedule,
  type JobSpec,
} from './domain/contracts/define-job';
export {
  type AnyModuleDef,
  defineModule,
  type ModuleDef,
  type ModuleSpec,
} from './domain/contracts/define-module';
export {
  type AnyUseCaseDef,
  defineUseCase,
  type InputOf,
  type OutputOf,
  UseCaseDef,
  type UseCaseErrorOf,
  type UseCaseSpec,
} from './domain/contracts/define-use-case';
export type { Facade, SystemCallable } from './domain/contracts/facade';
export {
  type OperationAbbr,
  OperationDef,
  type OperationDmg,
  type OperationFileKind,
  type OperationSpec,
} from './domain/contracts/operation-def';
export { defineEvents } from './domain/events/define-events';
export {
  type AnyEventDef,
  type DomainEvent,
  EventDef,
  type EventGroup,
  type EventOf,
  type EventPrefix,
  type EventSpec,
} from './domain/events/event-def';
export { definePolicy } from './domain/policy/define-policy';
export {
  AllOfRule,
  AllowAll,
  AnyOfRule,
  type AnyRule,
  allOf,
  allowAll,
  allowed,
  anyOf,
  type Decision,
  denied,
  hasRole,
  NamedRule,
  type NormalizedRule,
  type RoleHolder,
  Rule,
  type RuleContextOf,
  type RuleSpec,
  type RuleSubjectOf,
  type RuleTexts,
  rule,
} from './domain/policy/policy';
export {
  type AnyPolicyDef,
  PolicyDef,
  type PolicySpec,
} from './domain/policy/policy-def';
export { defineRules } from './domain/rules/define-rules';
export { type DomainRule, domainRule } from './domain/rules/domain-rule';
export {
  type AnyDomainRule,
  type DomainRuleContextOf,
  DomainRuleDef,
  type DomainRuleSpec,
} from './domain/rules/domain-rule-def';
export {
  type AnyRulesDef,
  RulesDef,
  type RulesSpec,
} from './domain/rules/rules-def';
export {
  Caller,
  type CallerJson,
  type CallerKind,
  type CallerLog,
  DelegateCaller,
  GuestCaller,
  type Identified,
  type OperationRef,
  type PersonCaller,
  type ReviveSubject,
  SystemCaller,
  UserCaller,
} from './kernel/caller/caller';
export { type CoreError, CoreErrors } from './kernel/errors/core-errors';
export { defineErrors } from './kernel/errors/define-errors';
export {
  type DomainError,
  ERROR_KINDS,
  type ErrorKind,
} from './kernel/errors/error';
export {
  type AnyErrorDef,
  ErrorDef,
  type ErrorGroup,
  type ErrorOf,
  type ErrorSpec,
} from './kernel/errors/error-def';
export { serializeError } from './kernel/errors/serialize-error';
export { BaseEntityFields, F } from './kernel/fields/fields';
export {
  type Err,
  err,
  type Ok,
  ok,
  type Result,
} from './kernel/result/result';
export { toJsonSchema } from './kernel/schema/json-schema';
export type { Timestamp } from './kernel/time/timestamp';
