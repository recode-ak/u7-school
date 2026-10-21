// Платформа DMG (Domain Manifest Graph) — пакет dmg-core.
// Корень — ядро и манифесты домена (`define*`, `Aggregate`, `Result`, Policy,
// доменные правила): чистый код без IO, его импортирует домен. Исполнение —
// `dmg-core/app`, граф манифестов — `dmg-core/graph`, проверки архитектуры —
// `dmg-core/arch`.

export {
  Aggregate,
  type ErrorsOf,
  type EventsOf,
  newEntity,
  type RejectOf,
  type StateOf,
  type TransitionOf,
} from './domain/aggregate/aggregate';
export {
  type AggregateDef,
  type AggregateSpec,
  type AnyAggregateDef,
  defineAggregate,
  type EntityBase,
  type StateSchema,
  type StatusOf,
  type Transition,
} from './domain/aggregate/define-aggregate';
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
  type UseCaseDef,
  type UseCaseErrorOf,
  type UseCaseSpec,
} from './domain/contracts/define-use-case';
export {
  type AnyEventDef,
  type DomainEvent,
  defineEvents,
  type EventDef,
  type EventGroup,
  type EventOf,
  type EventPrefix,
  type EventSpec,
} from './domain/events/define-events';
export {
  type AnyPolicyDef,
  definePolicy,
  type PolicyDef,
  type PolicySpec,
} from './domain/policy/define-policy';
export {
  type AnyRule,
  allOf,
  allowAll,
  allowed,
  anyOf,
  type Decision,
  denied,
  hasRole,
  type RoleHolder,
  type Rule,
  type RuleContextOf,
  type RuleNode,
  type RuleSpec,
  type RuleSubjectOf,
  rule,
} from './domain/policy/policy';
export {
  type AnyRulesDef,
  defineRules,
  type RulesDef,
  type RulesSpec,
} from './domain/rules/define-rules';
export {
  type AnyDomainRule,
  type DomainRule,
  type DomainRuleContextOf,
  type DomainRuleSpec,
  domainRule,
} from './domain/rules/domain-rule';
export type { CallContext } from './kernel/caller/call-context';
export {
  Caller,
  type CallerKind,
  type CallerLog,
  DelegateCaller,
  GuestCaller,
  type Identified,
  type OperationRef,
  type PersonCaller,
  SystemCaller,
  UserCaller,
} from './kernel/caller/caller';
export { type CoreError, CoreErrors } from './kernel/errors/core-errors';
export {
  type AnyErrorDef,
  defineErrors,
  type ErrorDef,
  type ErrorGroup,
  type ErrorOf,
  type ErrorSpec,
} from './kernel/errors/define-errors';
export {
  type DomainError,
  ERROR_KINDS,
  type ErrorKind,
} from './kernel/errors/error';
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
