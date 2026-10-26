import * as v from 'valibot';
import type {
  CallerJson,
  CallerKind,
  CallerLog,
  DelegateCallerJson,
  GuestCallerJson,
  Identified,
  OperationRef,
  SystemCallerJson,
  UserCallerJson,
} from './caller.types';

export type {
  CallerJson,
  CallerKind,
  CallerLog,
  DelegateCallerJson,
  GuestCallerJson,
  Identified,
  OperationRef,
  PersonCallerJson,
  SystemCallerJson,
  UserCallerJson,
} from './caller.types';

/** Восстановление субъекта из JSON (D-46): нужно, если `U` — класс. */
export type ReviveSubject<U> = (raw: unknown) => U;

const OperationRefJson = v.object({
  kind: v.picklist(['useCase', 'eventReaction', 'job']),
  module: v.string(),
  name: v.string(),
});

/** Субъект проверяет `revive`; здесь — только наличие поля. */
const PersonJson = v.variant('kind', [
  v.object({ kind: v.literal('guest') }),
  v.object({ kind: v.literal('user'), user: v.unknown() }),
  v.object({
    kind: v.literal('delegate'),
    principal: v.unknown(),
    actor: v.unknown(),
    delegationId: v.string(),
  }),
]);

const CallerJsonSchema = v.variant('kind', [
  ...PersonJson.options,
  v.object({
    kind: v.literal('system'),
    from: OperationRefJson,
    person: v.optional(PersonJson),
  }),
]);

const IdentifiedJson = v.looseObject({ uuid: v.string() });

/**
 * Кто вызывает операцию (D-43). Policy и домен работают только с субъектом
 * (`subject()`); вложенный вызов передаёт исходного человека (`person()`).
 * См. docs/caller.md пакета.
 */
export abstract class Caller<U extends Identified = Identified> {
  abstract readonly kind: CallerKind;
  /** От чьего имени действие; нет — гость или система без человека. */
  abstract subject(): U | undefined;
  /** Исходный человек — для вложенных вызовов; у системы без него — нет. */
  abstract person(): PersonCaller<U> | undefined;
  abstract toLog(): CallerLog;
  /** Форма для границы процесса (D-46): субъект целиком. */
  abstract toJSON(): CallerJson<U>;

  /**
   * Вызывающий из JSON другого процесса (D-46) — тот же класс, что у
   * отправителя. Без `revive` субъект берётся как есть (простые данные с
   * `uuid`). Невалидный JSON — `Error`: это дефект транспорта, не доменная
   * ошибка.
   */
  static fromJSON<U extends Identified = Identified>(
    json: unknown,
    revive?: ReviveSubject<U>,
  ): Caller<U> {
    const parsed = v.safeParse(CallerJsonSchema, json);
    if (!parsed.success) {
      throw new Error(
        `Caller.fromJSON: невалидный JSON — ${v.summarize(parsed.issues)}`,
      );
    }
    const subject =
      revive === undefined ? Caller.asIs<U> : Caller.checked(revive);
    const { output } = parsed;
    if (output.kind !== 'system') return Caller.personOf(output, subject);
    const { from, person } = output;
    return person === undefined
      ? new SystemCaller<U>(from)
      : new SystemCaller(from, Caller.personOf(person, subject));
  }

  private static personOf<U extends Identified>(
    json: v.InferOutput<typeof PersonJson>,
    subject: ReviveSubject<U>,
  ): PersonCaller<U> {
    switch (json.kind) {
      case 'guest':
        return new GuestCaller<U>();
      case 'user':
        return new UserCaller(subject(json.user));
      case 'delegate':
        return new DelegateCaller(
          subject(json.principal),
          subject(json.actor),
          json.delegationId,
        );
    }
  }

  /**
   * `revive` под контролем: его исключение — `Error` с префиксом
   * `Caller.fromJSON:` (`cause` — исходное), результат без `uuid: string` —
   * `Error`, как у субъекта без `revive`.
   */
  private static checked<U extends Identified>(
    revive: ReviveSubject<U>,
  ): ReviveSubject<U> {
    return (raw) => {
      let subject: U;
      try {
        subject = revive(raw);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Caller.fromJSON: revive не восстановил субъект — ${reason}`,
          { cause: error },
        );
      }
      if (!v.is(IdentifiedJson, subject)) {
        throw new Error('Caller.fromJSON: revive вернул субъект без uuid');
      }
      return subject;
    };
  }

  private static asIs<U extends Identified>(raw: unknown): U {
    if (!v.is(IdentifiedJson, raw)) {
      throw new Error(
        'Caller.fromJSON: субъект без uuid — передайте revive или простые данные с uuid',
      );
    }
    return raw as U;
  }
}

/** Человек на входе — вызывающий, который может стоять за системным. */
export type PersonCaller<U extends Identified = Identified> =
  | GuestCaller<U>
  | UserCaller<U>
  | DelegateCaller<U>;

/** Не зарегистрирован. Канал и посетитель в нём — в `Trace.channel`. */
export class GuestCaller<U extends Identified = Identified> extends Caller<U> {
  readonly kind = 'guest';

  subject(): undefined {
    return undefined;
  }

  person(): GuestCaller<U> {
    return this;
  }

  toLog(): CallerLog {
    return { kind: 'guest' };
  }

  toJSON(): GuestCallerJson {
    return { kind: 'guest' };
  }
}

/** Авторизованный пользователь — сам себе субъект. */
export class UserCaller<U extends Identified = Identified> extends Caller<U> {
  readonly kind = 'user';

  constructor(readonly user: U) {
    super();
  }

  subject(): U {
    return this.user;
  }

  person(): UserCaller<U> {
    return this;
  }

  toLog(): CallerLog {
    return { kind: 'user', subjectId: this.user.uuid };
  }

  toJSON(): UserCallerJson<U> {
    return { kind: 'user', user: this.user };
  }
}

/**
 * Заместитель (`actor`) действует от имени другого по делегированию
 * `delegationId`. Субъект — замещаемый; заместитель — для аудита.
 */
export class DelegateCaller<
  U extends Identified = Identified,
> extends Caller<U> {
  readonly kind = 'delegate';

  constructor(
    private readonly principal: U,
    readonly actor: U,
    readonly delegationId: string,
  ) {
    super();
  }

  subject(): U {
    return this.principal;
  }

  person(): DelegateCaller<U> {
    return this;
  }

  toLog(): CallerLog {
    return {
      kind: 'delegate',
      subjectId: this.principal.uuid,
      actorId: this.actor.uuid,
      delegationId: this.delegationId,
    };
  }

  toJSON(): DelegateCallerJson<U> {
    return {
      kind: 'delegate',
      principal: this.principal,
      actor: this.actor,
      delegationId: this.delegationId,
    };
  }
}

/**
 * Операция приложения (`from`) — UC, ER или Job своего или другого модуля.
 * `origin` — исходный человек вызвавшей операции; у ER и Job его нет.
 * Матрёшки нет: человек по типу не `SystemCaller`.
 */
export class SystemCaller<U extends Identified = Identified> extends Caller<U> {
  readonly kind = 'system';

  constructor(
    readonly from: OperationRef,
    private readonly origin?: PersonCaller<U>,
  ) {
    super();
  }

  subject(): U | undefined {
    return this.origin?.subject();
  }

  person(): PersonCaller<U> | undefined {
    return this.origin;
  }

  toLog(): CallerLog {
    return this.origin === undefined
      ? { kind: 'system', from: this.from }
      : { kind: 'system', from: this.from, person: this.origin.toLog() };
  }

  toJSON(): SystemCallerJson<U> {
    return this.origin === undefined
      ? { kind: 'system', from: this.from }
      : { kind: 'system', from: this.from, person: this.origin.toJSON() };
  }
}
