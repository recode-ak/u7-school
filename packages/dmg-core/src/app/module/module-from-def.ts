import type { AnyEventReactionDef } from '#core/domain/contracts/define-event-reaction';
import type { AnyJobDef } from '#core/domain/contracts/define-job';
import type { AnyModuleDef } from '#core/domain/contracts/define-module';
import type {
  AnyUseCaseDef,
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/define-use-case';
import type { Caller, Identified } from '#core/kernel/caller/caller';
import type { DomainError } from '#core/kernel/errors/error';
import type { Result } from '#core/kernel/result/result';
import type { ModuleDeps } from '../context';
import type { EventBus } from '../events/event-bus';
import type { JobFromDef, JobReport } from '../job/job-from-def';
import type { ReactionFromDef } from '../reaction/reaction-from-def';
import type { Trace } from '../trace';
import type { UseCaseHandler } from '../use-case/use-case-from-def';

type Ctor<R, T> = new (deps: R) => T;

/**
 * Реализация UC для проверки карты: `handle` — свойство, параметры строго
 * контравариантны, и UC, которому нужен субъект богаче `U`, не пройдёт.
 */
type StrictHandler<D extends AnyUseCaseDef, U extends Identified> = {
  readonly def: D;
  readonly handle: (
    input: unknown,
    caller: Caller<U>,
    trace: Trace,
  ) => Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
};

/**
 * Карта «Def → класс» модуля (API-05): ключ — имя Def, значение — класс
 * реализации именно этого Def. Пропуск реализации, лишний ключ или класс
 * чужого Def — ошибка компиляции. `U` — субъект вызывающего, который даёт
 * приложение: UC, которому нужен субъект богаче, в карту не пройдёт.
 */
export type ModuleMap<
  M extends AnyModuleDef,
  R extends ModuleDeps,
  U extends Identified,
> = {
  readonly useCases: {
    readonly [C in M['useCases'][number] as C['name']]: Ctor<
      R,
      StrictHandler<C, U>
    >;
  };
  readonly reactions: {
    readonly [E in M['reactions'][number] as E['name']]: Ctor<
      R,
      ReactionFromDef<E, R>
    >;
  };
  readonly jobs: {
    readonly [J in M['jobs'][number] as J['name']]: Ctor<R, JobFromDef<J, R>>;
  };
};

/** Та же карта без привязки к конкретному модулю — для обхода в рантайме. */
type RuntimeMap<R, U extends Identified> = {
  readonly useCases: Readonly<
    Record<string, Ctor<R, UseCaseHandler<AnyUseCaseDef, U>>>
  >;
  readonly reactions: Readonly<
    Record<string, Ctor<R, ReactionFromDef<AnyEventReactionDef, ModuleDeps>>>
  >;
  readonly jobs: Readonly<
    Record<string, Ctor<R, JobFromDef<AnyJobDef, ModuleDeps>>>
  >;
};

/** Любой модуль DMG — для списка модулей приложения. */
export type AnyModuleFromDef<U extends Identified> = ModuleFromDef<
  AnyModuleDef,
  ModuleDeps,
  U
>;

/**
 * Модуль DMG в рантайме — единственная точка входа в его операции (D-43):
 * UC — через `handle`, Job — через `runJob`, реакции — `subscribe`.
 * Реализации живут внутри и наружу не раздаются. Фасад для других модулей
 * собирает приложение поверх `handle` (`callUseCase`, D-42) — в карте его нет.
 */
export class ModuleFromDef<
  M extends AnyModuleDef,
  R extends ModuleDeps,
  U extends Identified,
> {
  private readonly useCases = new Map<
    AnyUseCaseDef,
    UseCaseHandler<AnyUseCaseDef, U>
  >();
  private readonly reactions: ReactionFromDef<
    AnyEventReactionDef,
    ModuleDeps
  >[];
  private readonly jobs = new Map<
    AnyJobDef,
    JobFromDef<AnyJobDef, ModuleDeps>
  >();
  private readonly bus: EventBus;

  /**
   * `map` типизирован дважды: `ModuleMap` проверяет полноту по Def,
   * `RuntimeMap` даёт обход значений без утверждений типов.
   */
  constructor(
    readonly def: M,
    map: ModuleMap<M, R, U> & RuntimeMap<R, U>,
    deps: R,
  ) {
    for (const Impl of Object.values(map.useCases)) {
      const uc = new Impl(deps);
      this.useCases.set(uc.def, uc);
    }
    this.reactions = Object.values(map.reactions).map((Er) => new Er(deps));
    for (const J of Object.values(map.jobs)) {
      const job = new J(deps);
      this.jobs.set(job.def, job);
    }
    this.bus = deps.app.bus;
  }

  /**
   * Исполнение UC модуля по его Def: ответ реализации как есть (отказ —
   * `Err`). UC другого модуля — ошибка компиляции; при стёртом типе модуля
   * (`AnyModuleFromDef`) — исключение: это ошибка сборки приложения, а не
   * отказ операции.
   */
  handle<D extends M['useCases'][number]>(
    def: D,
    input: unknown,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    const uc = this.useCase(def);
    if (uc === undefined) {
      return Promise.reject(
        new Error(`UC ${def.name} не реализован в модуле ${this.def.name}`),
      );
    }
    return uc.handle(input, caller, trace);
  }

  /** Реализован ли UC в этом модуле — выбор модуля по Def в приложении. */
  serves(def: AnyUseCaseDef): boolean {
    return this.useCase(def) !== undefined;
  }

  /**
   * Прогон Job модуля со следом вызывающего (`jobTrace`). Job другого
   * модуля — ошибка компиляции, при стёртом типе — исключение сборки.
   */
  runJob(
    def: M['jobs'][number],
    trace: Trace,
  ): Promise<Result<JobReport, DomainError>> {
    const job = this.jobs.get(def);
    if (job === undefined) {
      return Promise.reject(
        new Error(`Job ${def.name} не реализован в модуле ${this.def.name}`),
      );
    }
    return job.handle(trace);
  }

  /** Подписывает реакции модуля на шину приложения; возвращает отписку. */
  subscribe(): () => void {
    const offs = this.reactions.map((er) => er.subscribe(this.bus));
    return () => {
      for (const off of offs) off();
    };
  }

  /** Реализация UC по его Def; `undefined` — UC не из этого модуля. */
  private useCase<D extends AnyUseCaseDef>(
    def: D,
  ): UseCaseHandler<D, U> | undefined {
    const uc = this.useCases.get(def);
    return uc !== undefined && implementsDef(uc, def) ? uc : undefined;
  }
}

/** Def — ключ карты, поэтому совпадение объекта гарантирует тип `D`. */
function implementsDef<D extends AnyUseCaseDef, U extends Identified>(
  uc: UseCaseHandler<AnyUseCaseDef, U>,
  def: D,
): uc is UseCaseHandler<D, U> {
  return uc.def === def;
}
