// dmg-core/app — исполнение манифестов: UC/ER/Job по Def, модуль, UoW,
// шина событий, след операции. Импортируют прикладной слой и приложение.

export {
  type AppContext,
  type AppMode,
  type Clock,
  type Logger,
  type ModuleDeps,
  systemClock,
} from './context';
export type { EventBus } from './events/event-bus';
export type { EnvelopeOf, EventEnvelope } from './events/event-envelope';
export { asReadonlyAr, type Restorable } from './facade/as-readonly-ar';
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
  type ReactionEnvelopeOf,
  ReactionFromDef,
} from './reaction/reaction-from-def';
export {
  type Cause,
  incomingRequestId,
  jobTrace,
  type RequestMeta,
  requestTrace,
  type Trace,
  type TraceChannel,
} from './trace';
export {
  contractUnitOfWork,
  type OperationContract,
} from './uow/contract-unit-of-work';
export { createLock, type Lock } from './uow/lock';
export {
  assertVersion,
  type Repository,
  type StoredRecord,
  VersionConflict,
  type Versioned,
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
