import * as v from 'valibot';
import type { ErrorOf } from '#dmg/kernel/errors/define-errors';
import type { Result } from '#dmg/kernel/result/result';
import { now } from '#dmg/kernel/time/now';
import type { EventOf } from '../events/define-events';
import type { AnyAggregateDef } from './define-aggregate';

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

type Emit<D extends AnyAggregateDef> = (event: EventsOf<D>) => void;

/**
 * Базовый класс агрегата v2. Наследник объявляет `private constructor`,
 * `static create(): Result<Ar>` (с событием) и `static restore(snapshot)`.
 * Состояние меняется только через `change()`; невалидное состояние — `throw`
 * (нарушение инварианта, ERR: §1 п. 2), в памяти его не бывает.
 */
export abstract class Aggregate<D extends AnyAggregateDef> {
  private current: StateOf<D>;
  private pending: EventsOf<D>[];

  protected constructor(
    private readonly def: D,
    state: StateOf<D>,
    events: readonly EventsOf<D>[] = [],
  ) {
    this.current = this.validate(state);
    this.pending = [...events];
  }

  get uuid(): string {
    return this.current.uuid;
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
   * Мутация: черновик → `apply` → проверка перехода и схемы → фиксация.
   * При `Err` черновик и события отбрасываются; `updatedAt` ставит ядро.
   * Дженерик по всему `Result`: при `<T, E>` TS вывел бы `E` из первого
   * `return` и отверг бы второй код ошибки.
   */
  protected change<R extends Result<unknown, unknown>>(
    apply: (draft: StateOf<D>, emit: Emit<D>) => R,
  ): R {
    const draft = structuredClone(this.current);
    const emitted: EventsOf<D>[] = [];
    const res = apply(draft, (event) => {
      emitted.push(event);
    });
    if (!res.ok) return res;
    this.checkTransition(this.current, draft);
    this.current = this.validate({ ...draft, updatedAt: now() });
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

  private checkTransition(prev: StateOf<D>, next: StateOf<D>): void {
    const from = statusOf(prev);
    const to = statusOf(next);
    if (from === to || from === undefined || to === undefined) return;
    const declared = Object.values(this.def.transitions ?? {}).some(
      (t) => t.to === to && t.from.includes(from),
    );
    if (!declared) {
      throw new Error(
        `Агрегат ${this.def.name}: переход ${from} → ${to} не объявлен в Def`,
      );
    }
  }
}

function statusOf(state: object): string | undefined {
  return 'status' in state && typeof state.status === 'string'
    ? state.status
    : undefined;
}
