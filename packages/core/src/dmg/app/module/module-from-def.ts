import type { Job } from '#api/job/job';
import type { AnyEventReactionDef } from '../../domain/contracts/define-event-reaction';
import type {
  AnyFacadeDef,
  FacadeApi,
} from '../../domain/contracts/define-facade';
import type { AnyJobDef } from '../../domain/contracts/define-job';
import type { AnyModuleDef } from '../../domain/contracts/define-module';
import type { AnyUseCaseDef } from '../../domain/contracts/define-use-case';
import type { ModuleDeps } from '../context';
import type { EventBus } from '../events/event-bus';
import type { JobFromDef } from '../job/job-from-def';
import { legacyJob } from '../job/legacy-job';
import type { ReactionFromDef } from '../reaction/reaction-from-def';
import type { UseCaseHandler } from '../use-case/use-case-from-def';

type Ctor<R, T> = new (deps: R) => T;

type FacadePart<M extends AnyModuleDef, R> = M['facade'] extends AnyFacadeDef
  ? { readonly facade: (deps: R) => FacadeApi<M['facade']> }
  : { readonly facade?: undefined };

/**
 * Карта «Def → класс» модуля (API-05): ключ — имя Def, значение — класс
 * реализации именно этого Def. Пропуск реализации, лишний ключ или класс
 * чужого Def — ошибка компиляции.
 */
export type ModuleMap<M extends AnyModuleDef, R extends ModuleDeps> = {
  readonly useCases: {
    readonly [U in M['useCases'][number] as U['name']]: Ctor<
      R,
      UseCaseHandler<U>
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
type RuntimeMap<R> = {
  readonly useCases: Readonly<Record<string, Ctor<R, UseCaseHandler>>>;
  readonly reactions: Readonly<
    Record<string, Ctor<R, ReactionFromDef<AnyEventReactionDef, ModuleDeps>>>
  >;
  readonly jobs: Readonly<
    Record<string, Ctor<R, JobFromDef<AnyJobDef, ModuleDeps>>>
  >;
  readonly facade?: ((deps: R) => object) | undefined;
};

/** Любой модуль DMG — для списка модулей приложения. */
export type AnyModuleFromDef = ModuleFromDef<AnyModuleDef, ModuleDeps>;

/**
 * Модуль DMG в рантайме: экземпляры реализаций по карте, подписка реакций,
 * задания для планировщика, фасад для других модулей.
 */
export class ModuleFromDef<M extends AnyModuleDef, R extends ModuleDeps> {
  private readonly useCases = new Map<AnyUseCaseDef, UseCaseHandler>();
  private readonly reactions: ReactionFromDef<
    AnyEventReactionDef,
    ModuleDeps
  >[];
  private readonly jobs: JobFromDef<AnyJobDef, ModuleDeps>[];
  readonly facade: object | undefined;
  private readonly bus: EventBus;

  /**
   * `map` типизирован дважды: `ModuleMap<M, R>` проверяет полноту по Def,
   * `RuntimeMap<R>` даёт обход значений без утверждений типов.
   */
  constructor(
    readonly def: M,
    map: ModuleMap<M, R> & RuntimeMap<R>,
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
  useCase<D extends AnyUseCaseDef>(def: D): UseCaseHandler<D> | undefined {
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
function implementsDef<D extends AnyUseCaseDef>(
  uc: UseCaseHandler,
  def: D,
): uc is UseCaseHandler<D> {
  return uc.def === def;
}
