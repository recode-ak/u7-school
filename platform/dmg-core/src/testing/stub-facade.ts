import type { Facade, SystemCallable } from '../domain/contracts/facade';
import type { AnyModuleDef } from '../domain/contracts/module-def';
import type {
  AnyUseCaseDef,
  InputOf,
  OutputOf,
  UseCaseErrorOf,
} from '../domain/contracts/use-case-def';
import type { SystemCaller } from '../kernel/caller/caller';
import type { Result } from '../kernel/result/result';
import type { Trace } from '../kernel/trace/trace';

/** Ответ UC — синхронный или `Promise`. */
type Reply<D extends AnyUseCaseDef> =
  | Result<OutputOf<D>, UseCaseErrorOf<D>>
  | Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;

/** Ответ теста на вызов UC. */
type Answer<D extends AnyUseCaseDef> = (
  input: InputOf<D>,
  caller: SystemCaller,
  trace: Trace,
) => Reply<D>;

/**
 * Ответ по Def. `respond` — метод: параметры бивариантны, и записи разных
 * Def лежат в одном списке.
 */
type Entry<D extends AnyUseCaseDef> = {
  readonly def: D;
  respond(input: InputOf<D>, caller: SystemCaller, trace: Trace): Reply<D>;
};

/** Вызов, который получил фасад. */
export type StubCall = {
  readonly def: AnyUseCaseDef;
  readonly input: unknown;
  readonly caller: SystemCaller;
  readonly trace: Trace;
};

/**
 * Фасад модуля M для тестов модуля-потребителя (D-43): ответы задаёт тест
 * по Def (`answer`), полученные вызовы — в `received`. UC без `'system'` в
 * `callers` и UC другого модуля — ошибка типа; Def без ответа — исключение
 * с понятным текстом (ошибка теста, а не отказ UC).
 *
 * @example
 * const course = new StubFacade(CourseModuleDef).answer(
 *   GetCourseEnrollmentUcDef,
 *   () => ok({ enrollable: false }),
 * );
 * const facades = new ModuleFacades([course]);
 */
export class StubFacade<M extends AnyModuleDef> implements Facade<M> {
  private readonly answers: Entry<AnyUseCaseDef>[] = [];
  private readonly calls: StubCall[] = [];

  constructor(readonly def: M) {}

  /** Вызовы по порядку. */
  get received(): readonly StubCall[] {
    return this.calls;
  }

  /** Ответ на вызов UC; повторный ответ на тот же Def заменяет прежний. */
  answer<D extends SystemCallable<M>>(def: D, answer: Answer<D>): this {
    const entry: Entry<D> = { def, respond: answer };
    const at = this.answers.findIndex((e) => e.def === def);
    if (at >= 0) this.answers.splice(at, 1);
    this.answers.push(entry);
    return this;
  }

  serves(def: AnyUseCaseDef): boolean {
    return this.def.useCases.includes(def);
  }

  async handle<D extends AnyUseCaseDef>(
    def: D extends SystemCallable<M> ? D : never,
    input: InputOf<D>,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    const entry = this.answers.find((e) => isFor(e, def));
    if (entry === undefined) {
      throw new Error(
        `StubFacade ${this.def.name}: нет ответа для UC ${def.name}`,
      );
    }
    this.calls.push({ def, input, caller, trace });
    return entry.respond(input, caller, trace);
  }
}

/** Def — ключ записи, поэтому совпадение объекта гарантирует тип `D`. */
function isFor<D extends AnyUseCaseDef>(
  entry: Entry<AnyUseCaseDef>,
  def: D,
): entry is Entry<D> {
  return entry.def === def;
}
