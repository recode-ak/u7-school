/**
 * Пользователь так, как его видит ядро: только идентификатор — для записи
 * вызывающего в лог (`toLog`). Полный тип замыкает приложение (D-04).
 */
export type Identified = { readonly uuid: string };

/** Вид вызывающего — то, что объявляет `callers` в Def UC (MAN-11). */
export type CallerKind = 'guest' | 'user' | 'delegate' | 'system';

/**
 * Ссылка на операцию приложения: UC, ER или Job своего или другого модуля.
 * Свой ли модуль — сравнение `module` с модулем вызываемого (D-43).
 */
export type OperationRef = {
  readonly kind: 'useCase' | 'eventReaction' | 'job';
  readonly module: string;
  readonly name: string;
};

/** Вызывающий в форме для лога операций. */
export type CallerLog =
  | { readonly kind: 'guest' }
  | { readonly kind: 'user'; readonly subjectId: string }
  | {
      readonly kind: 'delegate';
      readonly subjectId: string;
      readonly actorId: string;
      readonly delegationId: string;
    }
  | {
      readonly kind: 'system';
      readonly from: OperationRef;
      readonly person?: CallerLog;
    };

/**
 * Кто вызывает операцию (D-43). Policy и домен работают только с субъектом
 * (`subject()`); вложенный вызов передаёт исходного человека (`person()`).
 * См. conductor/architecture/caller.md.
 */
export abstract class Caller<U extends Identified = Identified> {
  abstract readonly kind: CallerKind;
  /** От чьего имени действие; нет — гость или система без человека. */
  abstract subject(): U | undefined;
  /** Исходный человек — для вложенных вызовов; у системы без него — нет. */
  abstract person(): PersonCaller<U> | undefined;
  abstract toLog(): CallerLog;
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
}
