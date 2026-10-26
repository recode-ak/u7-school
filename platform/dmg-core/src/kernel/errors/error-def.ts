import { Def, type DefSchemas } from '../def/def';
import { type Err, err } from '../result/result';
import { toJsonSchema } from '../schema/json-schema';
import type { DomainError } from './error';
import type {
  ErrorGroup,
  ErrorSpec,
  NormalizedError,
  PayloadArgs,
  PayloadOf,
  SchemaOf,
} from './error-def.types';

export type {
  AnyErrorDef,
  ErrorGroup,
  ErrorOf,
  ErrorSpec,
  NormalizedError,
} from './error-def.types';

/** Манифест ошибки: декларация + фабрика значения. Имя в графе — код. */
export class ErrorDef<
  const C extends string = string,
  const S extends ErrorSpec = ErrorSpec,
> extends Def<C> {
  readonly dmg = 'error';
  readonly code: C;
  readonly kind: S['kind'];
  readonly payload: SchemaOf<S>;

  constructor(code: C, spec: S) {
    super({ name: code, label: spec.label, description: spec.description });
    this.code = code;
    this.kind = spec.kind;
    // Схема из спеки как есть; тип `SchemaOf` — тот же выбор на уровне типов.
    this.payload = spec.payload as SchemaOf<S>;
  }

  /**
   * Группа ошибок агрегата. Код — `<ПРЕФИКС>_<КЛЮЧ>` (ERR-04: UPPER_SNAKE
   * с префиксом сущности, уникальность проверяет `arch:check`); пустой
   * префикс — только для базовых ошибок ядра.
   */
  static define<
    const P extends string,
    const M extends Record<string, ErrorSpec>,
  >(prefix: P, specs: M): ErrorGroup<P, M> {
    const group: Record<string, ErrorDef> = {};
    for (const [key, spec] of Object.entries(specs)) {
      group[key] = new ErrorDef(prefix === '' ? key : `${prefix}_${key}`, spec);
    }
    // Ключи и типы группы задаёт сигнатура: рантайм-сборка через Object.entries
    // не выражается в mapped type без утверждения.
    return group as ErrorGroup<P, M>;
  }

  make(...args: PayloadArgs<S>): DomainError<C, S['kind'], PayloadOf<S>> {
    return {
      code: this.code,
      kind: this.kind,
      label: this.label,
      description: this.description,
      // Аргумент есть ровно тогда, когда объявлена схема (`PayloadArgs`).
      payload: args[0] as PayloadOf<S>,
    };
  }

  err(...args: PayloadArgs<S>): Err<DomainError<C, S['kind'], PayloadOf<S>>> {
    return err(this.make(...args));
  }

  normalize(): NormalizedError {
    return {
      dmg: this.dmg,
      code: this.code,
      kind: this.kind,
      label: this.label,
      description: this.description,
      payload: this.payload && toJsonSchema(this.payload),
    };
  }

  override schemas(): DefSchemas {
    return this.payload ? [['payload', this.payload]] : [];
  }
}
