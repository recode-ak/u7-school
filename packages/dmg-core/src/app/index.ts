// dmg-core/app — исполнение манифестов: UC/ER/Job по Def, модуль, UoW,
// шина событий, след операции. Импортируют прикладной слой и приложение.

export type {
  AppContext,
  AppMode,
  Logger,
  ModuleDeps,
} from './context';
export type { EventBus } from './events/event-bus';
export type { EnvelopeOf, EventEnvelope } from './events/event-envelope';
export { guardCalls } from './facade/guard-calls';
export { facadeDefOf, implementFacade } from './facade/implement-facade';
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
  type ReactionEnvelopeOf,
  ReactionFromDef,
} from './reaction/reaction-from-def';
export {
  type Cause,
  incomingRequestId,
  type RequestMeta,
  requestTrace,
  type Trace,
} from './trace';
export {
  contractUnitOfWork,
  type OperationContract,
} from './uow/contract-unit-of-work';
export type { Repository } from './uow/repository';
export {
  type Committable,
  UnitOfWork,
  type UnitOfWorkContext,
} from './uow/unit-of-work';
export {
  type OwnErrorOf,
  type ParsedInputOf,
  type RawOutputOf,
  type UseCaseContextOf,
  UseCaseFromDef,
  type UseCaseSubjectOf,
} from './use-case/use-case-from-def';
