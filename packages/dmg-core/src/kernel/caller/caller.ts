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

/**
 * Def операции, которая вызвала другой модуль через фасад: UC, ER или Job.
 * Ядро видит только вид, имя и `calls` — проверку `calls` делает вызываемый
 * UC (D-42); полный тип Def — в `domain/contracts`.
 */
export type CallingOperation = {
  readonly dmg: 'useCase' | 'eventReaction' | 'job';
  readonly name: string;
  readonly calls?: readonly object[];
};

/**
 * Другой модуль через фасад (D-42): `from` — Def вызвавшей операции,
 * `origin` — исходный вызывающий. Субъект — субъект `origin`.
 */
export type ModuleCaller<U> = {
  readonly kind: 'module';
  readonly from: CallingOperation;
  readonly origin: Caller<U>;
};

/** Job, ER; `source` — FQN источника. */
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
  | ModuleCaller<U>
  | SystemCaller<U>;

export type CallerKind = Caller['kind'];

/** Субъект — от чьего имени действие; домен и Policy работают только с ним. */
export function subjectOf<U>(caller: Caller<U>): U | undefined {
  switch (caller.kind) {
    case 'user':
      return caller.user;
    case 'delegate':
      return caller.subject;
    case 'module':
      return subjectOf(caller.origin);
    case 'guest':
    case 'system':
      return undefined;
  }
}

/**
 * Исходный вызывающий: у `module` — `origin` по всей цепочке модулей, у
 * остальных — он сам. По нему Policy решает, кто действует (`delegate`,
 * `system`), — межмодульный вызов вида вызывающего не меняет.
 */
export function originOf<U>(caller: Caller<U>): Caller<U> {
  return caller.kind === 'module' ? originOf(caller.origin) : caller;
}

/** Вызывающий `module`: операция `from` вызвала фасад от имени `origin`. */
export function moduleCaller<U>(
  from: CallingOperation,
  origin: Caller<U>,
): ModuleCaller<U> {
  return { kind: 'module', from, origin };
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
