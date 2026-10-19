// Платформа DMG (Domain Manifest Graph) — новый фреймворк @u7-scl/core.
// Живёт рядом с legacy-слоями (strangler), см. conductor/architecture/migration.md.

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
export { type Err, err, type Ok, ok, type Result } from './result/result';
