import type { Job } from '#api/job/job';
import type { AnyEventReactionDef } from '../../domain/contracts/define-event-reaction';
import type {
  AnyFacadeDef,
  FacadeApi,
} from '../../domain/contracts/define-facade';
import type { AnyJobDef } from '../../domain/contracts/define-job';
import type { AnyModuleDef } from '../../domain/contracts/define-module';
import type {
  AnyUseCaseDef,
  OutputOf,
  UseCaseErrorOf,
} from '../../domain/contracts/define-use-case';
import type { Caller } from '../../kernel/caller/caller';
import type { Result } from '../../kernel/result/result';
import type { ModuleDeps } from '../context';
import type { EventBus } from '../events/event-bus';
import type { JobFromDef } from '../job/job-from-def';
import { legacyJob } from '../job/legacy-job';
import type { ReactionFromDef } from '../reaction/reaction-from-def';
import type { HandleMeta, UseCaseHandler } from '../use-case/use-case-from-def';

type Ctor<R, T> = new (deps: R) => T;

/**
 * Реализация UC для проверки карты: `handle` — свойство, параметры строго
 * контравариантны, и UC, которому нужен субъект богаче `U`, не пройдёт.
 */
type StrictHandler<D extends AnyUseCaseDef, U> = {
  readonly def: D;
  readonly handle: (
    input: unknown,
    caller: Caller<U>,
    meta: HandleMeta,
  ) => Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
};

type FacadePart<M extends AnyModuleDef, R> = M['facade'] extends AnyFacadeDef
  ? { readonly facade: (deps: R) => FacadeApi<M['facade']> }
  : { readonly facade?: undefined };

/**
 * Карта «Def → класс» модуля (API-05): ключ — имя Def, значение — класс
 * реализации именно этого Def. Пропуск реализации, лишний ключ или класс
 * чужого Def — ошибка компиляции. `U` — субъект вызывающего, который даёт
 * приложение: UC, которому нужен субъект богаче, в карту не пройдёт.
 */
export type ModuleMap<M extends AnyModuleDef, R extends ModuleDeps, U> = {
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
} & FacadePart<M, R>;

/** Та же карта без привязки к конкретному модулю — для обхода в рантайме. */
type RuntimeMap<R, U> = {
  readonly useCases: Readonly<
    Record<string, Ctor<R, UseCaseHandler<AnyUseCaseDef, U>>>
  >;
  readonly reactions: Readonly<
    Record<string, Ctor<R, ReactionFromDef<AnyEventReactionDef, ModuleDeps>>>
  >;
  readonly jobs: Readonly<
    Record<string, Ctor<R, JobFromDef<AnyJobDef, ModuleDeps>>>
  >;
  readonly facade?: ((deps: R) => object) | undefined;
};

/** Любой модуль DMG — для списка модулей приложения. */
export type AnyModuleFromDef<U> = ModuleFromDef<AnyModuleDef, ModuleDeps, U>;

/**
 * Модуль DMG в рантайме: экземпляры реализаций по карте, подписка реакций,
 * задания для планировщика, фасад для других модулей.
 */
export class ModuleFromDef<M extends AnyModuleDef, R extends ModuleDeps, U> {
  private readonly useCases = new Map<
    AnyUseCaseDef,
    UseCaseHandler<AnyUseCaseDef, U>
  >();
  private readonly reactions: ReactionFromDef<
    AnyEventReactionDef,
    ModuleDeps
  >[];
  private readonly jobs: JobFromDef<AnyJobDef, ModuleDeps>[];
  readonly facade: object | undefined;
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
    this.jobs = Object.values(map.jobs).map((J) => new J(deps));
    this.facade = map.facade?.(deps);
    this.bus = deps.app.bus;
  }

  /** Реализация UC по его Def; `undefined` — UC не из этого модуля. */
  useCase<D extends AnyUseCaseDef>(def: D): UseCaseHandler<D, U> | undefined {
    const uc = this.useCases.get(def);
    return uc !== undefined && implementsDef(uc, def) ? uc : undefined;
  }

  /** Подписывает реакции модуля на шину приложения; возвращает отписку. */
  subscribe(): () => void {
    const offs = this.reactions.map((er) => er.subscribe(this.bus));
    return () => {
      for (const off of offs) off();
    };
  }

  /** Задания модуля в форме legacy — для существующего планировщика. */
  legacyJobs(): Job[] {
    return this.jobs.map(legacyJob);
  }
}

/** Def — ключ карты, поэтому совпадение объекта гарантирует тип `D`. */
function implementsDef<D extends AnyUseCaseDef, U>(
  uc: UseCaseHandler<AnyUseCaseDef, U>,
  def: D,
): uc is UseCaseHandler<D, U> {
  return uc.def === def;
}
