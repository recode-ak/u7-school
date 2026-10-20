import * as v from 'valibot';
import type { AnyErrorDef, ErrorOf } from '#core/kernel/errors/define-errors';
import type { Err, Result } from '#core/kernel/result/result';
import type { Timestamp } from '#core/kernel/time/timestamp';
import type { EventOf } from '../events/define-events';
import type { AnyAggregateDef, EntityBase } from './define-aggregate';

/** Состояние агрегата по его Def. */
export type StateOf<D extends AnyAggregateDef> = v.InferOutput<D['state']>;

/** Union событий группы агрегата. */
export type EventsOf<D extends AnyAggregateDef> = {
  [K in keyof D['events']]: EventOf<D['events'][K]>;
}[keyof D['events']];

/** Union ошибок группы агрегата. */
export type ErrorsOf<D extends AnyAggregateDef> = {
  [K in keyof D['errors']]: ErrorOf<D['errors'][K]>;
}[keyof D['errors']];

/**
 * Метка «агрегат создан, а не восстановлен». Символьный ключ переживает
 * spread (`{ ...newEntity(…), … }` в `create`), но не схему state, не
 * `snapshot()` (structuredClone) и не JSON — восстановленная запись её
 * не несёт. Так база отличает `create` от `restore` без флага в
 * конструкторе наследника.
 */
const NEW_ENTITY: unique symbol = Symbol('dmg.newEntity');

/**
 * Базовые поля новой entity: создана и изменена в `at`, версия 0. `create`
 * агрегата обязан строить базу через неё — иначе агрегат считается
 * восстановленным, и первая запись даст `VersionConflict` (записи нет).
 */
export function newEntity(uuid: string, at: Timestamp): EntityBase {
  const base: EntityBase = { uuid, createdAt: at, updatedAt: at, version: 0 };
  return Object.assign(base, { [NEW_ENTITY]: true });
}

function isNewEntity(state: object): boolean {
  return NEW_ENTITY in state;
}

type Emit<D extends AnyAggregateDef> = (event: EventsOf<D>) => void;

type Apply<D extends AnyAggregateDef, R> = (
  draft: StateOf<D>,
  emit: Emit<D>,
) => R;

type TransitionsOf<D extends AnyAggregateDef> = NonNullable<D['transitions']>;

/** Имя перехода агрегата — ключ `transitions` в Def. */
export type TransitionOf<D extends AnyAggregateDef> = keyof TransitionsOf<D> &
  string;

/** Отказы перехода `K`: ошибки из его `rejects`. */
export type RejectOf<
  D extends AnyAggregateDef,
  K extends TransitionOf<D>,
> = TransitionsOf<D>[K] extends { readonly rejects: infer J }
  ? ErrorOf<Extract<J[keyof J], AnyErrorDef>>
  : never;

/**
 * Базовый класс агрегата v2. Наследник объявляет `private constructor`,
 * `static create(): Result<Ar>` (с событием) и `static restore(snapshot)`.
 * Состояние меняется только через `change()`; невалидное состояние — `throw`
 * (нарушение инварианта, ERR: §1 п. 2), в памяти его не бывает.
 */
export abstract class Aggregate<D extends AnyAggregateDef> {
  private current: StateOf<D>;
  private pending: EventsOf<D>[];
  private stored: number | undefined;

  protected constructor(
    private readonly def: D,
    state: StateOf<D>,
    events: readonly EventsOf<D>[] = [],
  ) {
    this.current = this.validate(state);
    this.pending = [...events];
    this.stored = isNewEntity(state) ? undefined : this.current.version;
  }

  get uuid(): string {
    return this.current.uuid;
  }

  /** Текущая версия: растёт с каждой мутацией (D-36). */
  get version(): number {
    return this.current.version;
  }

  /**
   * Версия, с которой агрегат загружен или последний раз сохранён, — её
   * репозиторий сверяет с хранилищем перед записью (`VersionConflict`).
   * `undefined` — агрегат создан (`create`) и ещё не записан: записи с его
   * uuid в хранилище быть не должно.
   */
  get storedVersion(): number | undefined {
    return this.stored;
  }

  /** Отметить запись: вызывает UoW после успешного `repo.save`. */
  markStored(): void {
    this.stored = this.current.version;
  }

  /** Копия состояния для репозитория. */
  snapshot(): StateOf<D> {
    return structuredClone(this.current);
  }

  /** Выдать накопленные события и очистить накопитель (вызывает UoW). */
  pullEvents(): EventsOf<D>[] {
    const events = this.pending;
    this.pending = [];
    return events;
  }

  /** Текущее состояние — для методов-вопросов наследника. */
  protected get state(): Readonly<StateOf<D>> {
    return this.current;
  }

  /**
   * Мутация без смены статуса в момент `at`: черновик → `apply` → проверка
   * схемы → фиксация. При `Err` черновик и события отбрасываются;
   * `updatedAt` = `at`. Время — аргумент операции: домен не читает часы
   * (D-34). Статус меняет только `transition`.
   * Дженерик по всему `Result`: при `<T, E>` TS вывел бы `E` из первого
   * `return` и отверг бы второй код ошибки.
   */
  protected change<R extends Result<unknown, unknown>>(
    at: Timestamp,
    apply: Apply<D, R>,
  ): R {
    return this.mutate(at, apply, undefined);
  }

  /**
   * Переход статуса `op` по Def: из статуса вне `from` — отказ из `rejects`,
   * иначе черновик получает статус `to` и проходит `apply`, как в `change`.
   * Правила жизненного цикла живут в Def; метод Ar пишет только сам переход.
   */
  protected transition<
    K extends TransitionOf<D>,
    R extends Result<unknown, unknown>,
  >(op: K, at: Timestamp, apply: Apply<D, R>): R | Err<RejectOf<D, K>> {
    const declared = this.def.transitions?.[op];
    if (declared === undefined) {
      throw new Error(`Агрегат ${this.def.name}: переход ${op} не объявлен`);
    }
    const from = statusOf(this.current);
    if (from !== undefined && declared.from.includes(from)) {
      return this.mutate(at, apply, declared.to);
    }
    const reject = from === undefined ? undefined : declared.rejects[from];
    if (reject === undefined) {
      throw new Error(
        `Агрегат ${this.def.name}: у перехода ${op} нет отказа для статуса ${from}`,
      );
    }
    // Ключ `rejects[from]` — ошибка перехода `op`: тип выводит сигнатура,
    // рантайм-доступ по строке статуса его не сохраняет.
    return reject.err() as Err<RejectOf<D, K>>;
  }

  private mutate<R extends Result<unknown, unknown>>(
    at: Timestamp,
    apply: Apply<D, R>,
    to: string | undefined,
  ): R {
    const draft = structuredClone(this.current);
    const before = statusOf(draft);
    if (to !== undefined) Reflect.set(draft, 'status', to);
    const emitted: EventsOf<D>[] = [];
    const res = apply(draft, (event) => {
      emitted.push(event);
    });
    if (!res.ok) return res;
    this.checkStatus(to ?? before, statusOf(draft));
    this.current = this.validate({
      ...draft,
      updatedAt: at,
      version: this.current.version + 1,
    });
    this.pending.push(...emitted);
    return res;
  }

  private validate(state: unknown): StateOf<D> {
    const parsed = v.safeParse(this.def.state, state);
    if (!parsed.success) {
      throw new Error(
        `Агрегат ${this.def.name}: состояние не прошло схему — ${v.summarize(parsed.issues)}`,
      );
    }
    return parsed.output;
  }

  /** Статус после `apply` — тот, что поставила база (или прежний). */
  private checkStatus(
    expected: string | undefined,
    actual: string | undefined,
  ): void {
    if (expected === actual) return;
    throw new Error(
      `Агрегат ${this.def.name}: статус ${expected} → ${actual} изменён мимо transition — статус ставит база по Def`,
    );
  }
}

function statusOf(state: object): string | undefined {
  return 'status' in state && typeof state.status === 'string'
    ? state.status
    : undefined;
}
