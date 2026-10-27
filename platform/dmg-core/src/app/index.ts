// dmg-core/app — исполнение манифестов: UC/ER/Job по Def, модуль, UoW,
// шина событий, след операции. Импортируют прикладной слой и приложение.

export {
  type Cause,
  type RequestMeta,
  Trace,
  type TraceChannel,
  type TraceJson,
  type TraceLog,
  type TraceStamp,
} from '../kernel/trace/trace';
export { ApiApp } from './api-app/api-app';
export type { ModuleFactory } from './api-app/api-app.types';
export { type CommandTransport, ModuleApi } from './client/module-api';
export {
  type AppContext,
  type AppMode,
  type Clock,
  type Logger,
  type ModuleDeps,
  systemClock,
} from './context';
export type { EventBus } from './events/event-bus';
export type {
  EnvelopeOf,
  EventEnvelope,
  PublishedEvent,
} from './events/event-envelope';
export {
  DEFAULT_INBOX_CAPACITY,
  type Delivery,
  type Inbox,
  InProcInbox,
} from './events/inbox';
export { InProcOutbox, type Outbox } from './events/outbox';
export { type FacadeModule, ModuleFacade } from './facade/module-facade';
export { ModuleFacades, type RoutableFacade } from './facade/module-facades';
export {
  JobFromDef,
  type JobReport,
  type JobRun,
} from './job/job-from-def';
export {
  type AnyModuleFromDef,
  ModuleFromDef,
  type ModuleMap,
} from './module/module-from-def';
export {
  type AnyOperationDef,
  type CallsOf,
  OperationFromDef,
} from './operation/operation-from-def';
export {
  DEFAULT_OPLOG_MAX_BYTES,
  JsonlOperationLog,
  type TruncatedValue,
} from './oplog/jsonl-operation-log';
export type { OperationLog, OperationRecord } from './oplog/operation-record';
export { type OperationCall, OperationRun } from './oplog/operation-run';
export {
  type ReactionEnvelopeOf,
  ReactionFromDef,
} from './reaction/reaction-from-def';
export { Lock } from './uow/lock';
export {
  type Repository,
  type StoredRecord,
  VersionConflict,
  type Versioned,
  VersionedRepository,
} from './uow/repository';
export {
  type CommitError,
  type Committable,
  UnitOfWork,
  type UnitOfWorkContext,
} from './uow/unit-of-work';
export {
  type ParsedInputOf,
  type RawOutputOf,
  type UseCaseContextOf,
  UseCaseFromDef,
  type UseCaseSubjectOf,
} from './use-case/use-case-from-def';
