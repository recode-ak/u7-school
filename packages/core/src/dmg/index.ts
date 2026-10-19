// Платформа DMG (Domain Manifest Graph) — новый фреймворк @u7-scl/core.
// Живёт рядом с legacy-слоями (strangler), см. conductor/architecture/migration.md.

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
export { BaseEntityFields, F } from './kernel/fields/fields';
export {
  type Err,
  err,
  type Ok,
  ok,
  type Result,
} from './kernel/result/result';
export { toJsonSchema } from './kernel/schema/json-schema';
export { now } from './kernel/time/now';
export type { Timestamp } from './kernel/time/timestamp';
