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

/** Гость в JSON. */
export type GuestCallerJson = { readonly kind: 'guest' };

/** Пользователь в JSON: субъект целиком (D-46). */
export type UserCallerJson<U> = { readonly kind: 'user'; readonly user: U };

/** Заместитель в JSON: замещаемый и заместитель целиком. */
export type DelegateCallerJson<U> = {
  readonly kind: 'delegate';
  readonly principal: U;
  readonly actor: U;
  readonly delegationId: string;
};

/** Человек на входе в JSON — то, что может стоять за системным. */
export type PersonCallerJson<U> =
  | GuestCallerJson
  | UserCallerJson<U>
  | DelegateCallerJson<U>;

/** Системный вызывающий в JSON; человек — без матрёшки. */
export type SystemCallerJson<U> = {
  readonly kind: 'system';
  readonly from: OperationRef;
  readonly person?: PersonCallerJson<U>;
};

/**
 * Вызывающий в JSON — для передачи через границу процесса (D-46):
 * `toJSON()` у отправителя, `Caller.fromJSON()` у получателя.
 */
export type CallerJson<U = Identified> =
  | PersonCallerJson<U>
  | SystemCallerJson<U>;
