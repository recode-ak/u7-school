// Платформа DMG (Domain Manifest Graph) — новый фреймворк @u7-scl/core.
// Живёт рядом с legacy-слоями (strangler), см. conductor/architecture/migration.md.

export {
  type Caller,
  type CallerKind,
  type DelegateCaller,
  type GuestCaller,
  type SystemCaller,
  subjectOf,
  systemCaller,
  type UserCaller,
} from './caller/caller';
export { type CoreError, CoreErrors } from './errors/core-errors';
export {
  type AnyErrorDef,
  defineErrors,
  type ErrorDef,
  type ErrorGroup,
  type ErrorOf,
  type ErrorSpec,
} from './errors/define-errors';
export { type DomainError, ERROR_KINDS, type ErrorKind } from './errors/error';
export { BaseEntityFields, F } from './fields/fields';
export { type Err, err, type Ok, ok, type Result } from './result/result';
export { toJsonSchema } from './schema/json-schema';
export { now } from './time/now';
export type { Timestamp } from './time/timestamp';
