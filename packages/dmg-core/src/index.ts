// Платформа DMG (Domain Manifest Graph) — пакет dmg-core.
// Живёт рядом с legacy-слоями (strangler), см. conductor/architecture/migration.md.

export type {
  AppContext,
  AppMode,
  Logger,
  ModuleDeps,
} from './app/context';
export type { EventBus } from './app/events/event-bus';
export type { EnvelopeOf, EventEnvelope } from './app/events/event-envelope';
export { guardCalls } from './app/facade/guard-calls';
export { facadeDefOf, implementFacade } from './app/facade/implement-facade';
export {
  JobFromDef,
  type JobReport,
  type JobRun,
} from './app/job/job-from-def';
export {
  type AnyModuleFromDef,
  ModuleFromDef,
  type ModuleMap,
} from './app/module/module-from-def';
export {
  type ReactionEnvelopeOf,
  ReactionFromDef,
} from './app/reaction/reaction-from-def';
export {
  type Cause,
  incomingRequestId,
  type RequestMeta,
  requestTrace,
  type Trace,
} from './app/trace';
export {
  contractUnitOfWork,
  type OperationContract,
} from './app/uow/contract-unit-of-work';
export type { Repository } from './app/uow/repository';
export {
  type Committable,
  UnitOfWork,
  type UnitOfWorkContext,
} from './app/uow/unit-of-work';
export {
  type OwnErrorOf,
  type ParsedInputOf,
  type RawOutputOf,
  type UseCaseContextOf,
  UseCaseFromDef,
  type UseCaseSubjectOf,
} from './app/use-case/use-case-from-def';
export { type ArchApp, archCheck } from './arch/arch-check';
export { checkDefs } from './arch/check-defs';
export { checkFiles, type ModuleLayout } from './arch/check-files';
export {
  type ArchRule,
  formatViolation,
  type Violation,
} from './arch/violation';
export {
  Aggregate,
  type ErrorsOf,
  type EventsOf,
  type StateOf,
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
  type AnyFacadeDef,
  type AnyFacadeMethodDef,
  defineFacade,
  type FacadeApi,
  type FacadeDef,
  type FacadeMethodDef,
  type FacadeSpec,
  method,
} from './domain/contracts/define-facade';
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
export { type DefIndex, indexDefs } from './graph/def-index';
export {
  type AggregateNode,
  buildGraph,
  type DomainGraph,
  type ErrorNode,
  type EventNode,
  type JobNode,
  type ModuleLink,
  type ModuleNode,
  type ReactionNode,
  type UseCaseNode,
} from './graph/domain-graph';
export {
  type AnyDef,
  type NormalizedAggregate,
  type NormalizedDef,
  type NormalizedError,
  type NormalizedEvent,
  type NormalizedEventReaction,
  type NormalizedFacade,
  type NormalizedJob,
  type NormalizedModule,
  type NormalizedPolicy,
  type NormalizedRule,
  type NormalizedUseCase,
  normalize,
} from './graph/normalize';
export {
  type Caller,
  type CallerKind,
  type DelegateCaller,
  type GuestCaller,
  type SystemCaller,
  subjectOf,
  systemCaller,
  type UserCaller,
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
export { now, useClockSource } from './kernel/time/now';
export type { Timestamp } from './kernel/time/timestamp';
