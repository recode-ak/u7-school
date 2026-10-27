// Платформа DMG (Domain Manifest Graph) — пакет dmg-core.
// Корень — ядро и манифесты домена (`XxxDef.define`, `Aggregate`, `Result`, Policy,
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
export type { ReadonlyAr } from './domain/aggregate/readonly-ar';
export {
  type AnyEventReactionDef,
  EventReactionDef,
  type EventReactionSpec,
  type ReactionEventOf,
} from './domain/contracts/event-reaction-def';
export type { Facade, SystemCallable } from './domain/contracts/facade';
export {
  type AnyJobDef,
  JobDef,
  type JobSchedule,
  type JobSpec,
} from './domain/contracts/job-def';
export {
  type AnyModuleDef,
  ModuleDef,
  type ModuleSpec,
} from './domain/contracts/module-def';
export {
  type OperationAbbr,
  OperationDef,
  type OperationDmg,
  type OperationFileKind,
  type OperationSpec,
} from './domain/contracts/operation-def';
export {
  type AnyUseCaseDef,
  type InputOf,
  type OutputOf,
  UseCaseDef,
  type UseCaseErrorOf,
  type UseCaseSpec,
} from './domain/contracts/use-case-def';
export {
  type AnyEventDef,
  type DomainEvent,
  EventDef,
  type EventGroup,
  type EventOf,
  type EventPrefix,
  type EventSpec,
} from './domain/events/event-def';
export {
  type AnyPolicyDef,
  PolicyDef,
  type PolicySpec,
} from './domain/policy/policy-def';
export {
  AllOfRule,
  AllowAll,
  AnyOfRule,
  type AnyRule,
  allowAll,
  allowed,
  type Decision,
  denied,
  NamedRule,
  type NormalizedRule,
  type RoleHolder,
  Rule,
  type RuleContextOf,
  type RuleSpec,
  type RuleSubjectOf,
  type RuleTexts,
} from './domain/policy/rule';
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
