/**
 * Не зарегистрирован. Известно не больше, чем канал (`telegram`, `web`, …)
 * и идентификатор посетителя в нём (tgId, id анонимной сессии).
 */
export type GuestCaller = {
  readonly kind: 'guest';
  readonly channel?: string;
  readonly channelId?: string;
};

/** Авторизованный пользователь — сам себе субъект. */
export type UserCaller<U> = { readonly kind: 'user'; readonly user: U };

/**
 * Заместитель действует от имени другого по делегированию.
 * Субъект — замещаемый; `actor` и `delegationId` — для аудита.
 */
export type DelegateCaller<U> = {
  readonly kind: 'delegate';
  readonly subject: U;
  readonly actor: U;
  readonly delegationId: string;
};

/** Job, ER, межмодульный вызов; `source` — FQN источника. */
export type SystemCaller<U> = {
  readonly kind: 'system';
  readonly source: string;
  readonly onBehalfOf?: Caller<U>;
};

/**
 * Кто вызывает операцию (D-25). Дженерик пользователя замыкает `app`.
 * См. conductor/architecture/caller.md.
 */
export type Caller<U = unknown> =
  | GuestCaller
  | UserCaller<U>
  | DelegateCaller<U>
  | SystemCaller<U>;

export type CallerKind = Caller['kind'];

/** Субъект — от чьего имени действие; домен и Policy работают только с ним. */
export function subjectOf<U>(caller: Caller<U>): U | undefined {
  switch (caller.kind) {
    case 'user':
      return caller.user;
    case 'delegate':
      return caller.subject;
    case 'guest':
    case 'system':
      return undefined;
  }
}

/** Системный вызывающий; `onBehalfOf` — вызывающий события-причины. */
export function systemCaller<U>(
  source: string,
  onBehalfOf?: Caller<U>,
): SystemCaller<U> {
  return onBehalfOf
    ? { kind: 'system', source, onBehalfOf }
    : { kind: 'system', source };
}
