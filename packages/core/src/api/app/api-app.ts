import { toLegacyError } from '#dmg/app/errors/legacy-error';
import type { AnyModuleFromDef } from '#dmg/app/module/module-from-def';
import type {
  HandleMeta,
  UseCaseSubjectOf,
} from '#dmg/app/use-case/use-case-from-def';
import type {
  AnyUseCaseDef,
  InputOf,
  OutputOf,
  UseCaseErrorOf,
} from '#dmg/domain/contracts/define-use-case';
import type { Caller } from '#dmg/kernel/caller/caller';
import type { Result } from '#dmg/kernel/result/result';
import { errBadRequest, throwError } from '#domain/errors/error-helpers';
import { AppException, type NoCommandFoundError } from '#domain/errors/errors';
import type {
  ApiExecutor,
  AppMeta,
  ExtractUcMetaFromMeta,
  GetUcNamesFromMeta,
} from '#domain/types';
import type { JobScheduler } from '../job/job-scheduler';
import { App } from './app';

/**
 * API-приложение. Модули передаются в конструктор (доменные зависимости),
 * планировщик заданий — через init() (техническая зависимость из core/infra).
 *
 * @typeParam TActor — тип объекта актора (например User), резолвимого
 * на входе приложения и передаваемого вниз до UseCase.execute
 */
export class ApiApp<TMeta extends AppMeta, TActor = unknown>
  extends App
  implements ApiExecutor<TMeta, TActor>
{
  #scheduler: JobScheduler | undefined;

  // Модули DMG живут рядом с legacy (strangler): их UC — через run/execute
  // по Def, реакции — на общей шине, задания — в общем планировщике.
  private readonly dmgModules: AnyModuleFromDef[] = [];
  private dmgUnsubscribes: Array<() => void> = [];

  /** Подключает модули DMG; вызывать до init(). */
  addDmgModules(...modules: AnyModuleFromDef[]): this {
    this.dmgModules.push(...modules);
    return this;
  }

  /**
   * Приводит приложение в рабочее состояние: каскадная инициализация модулей
   * и получение технических зависимостей (планировщик заданий — реализация
   * из core/infra, например InProcJobScheduler).
   */
  init(scheduler: JobScheduler): void {
    this.#scheduler = scheduler;
    for (const module of this.getModules()) {
      module.init();
    }
    for (const unsubscribe of this.dmgUnsubscribes) unsubscribe();
    this.dmgUnsubscribes = this.dmgModules.map((module) => module.subscribe());
  }

  /**
   * Запуск периодических заданий всех модулей через планировщик.
   * Вызывается после init() и после старта подписок UI (чтобы события
   * job'ов находили слушателей).
   */
  start(): void {
    if (this.#scheduler === undefined) {
      throw new Error('ApiApp: вызовите init(scheduler) перед start()');
    }
    const jobs = [
      ...this.getModules().flatMap((module) => module.jobs),
      ...this.dmgModules.flatMap((module) => module.legacyJobs()),
    ];
    this.#scheduler.start(jobs);
  }

  /**
   * Остановка периодических заданий (graceful shutdown).
   * До init() останавливать нечего — безопасный no-op.
   */
  stop(): void {
    if (this.#scheduler === undefined) return;
    this.#scheduler.stop();
  }

  /** Исполнение UC DMG по его Def: отказ — значение `Err`. */
  async run<D extends AnyUseCaseDef>(
    uc: D,
    input: InputOf<D>,
    caller: Caller<UseCaseSubjectOf<D>>,
    meta?: HandleMeta,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    return this.dmgUseCase(uc).handle(input, caller, meta);
  }

  execute<N extends GetUcNamesFromMeta<TMeta>>(
    ucName: N,
    attrs: ExtractUcMetaFromMeta<TMeta, N>['input'],
    actor?: TActor,
  ): Promise<ExtractUcMetaFromMeta<TMeta, N>['output']>;
  /**
   * UC DMG с прежним поведением «бросить при ошибке»: `Err` → `AppException`
   * — для stories, ещё не переведённых на `run`.
   */
  execute<D extends AnyUseCaseDef>(
    uc: D,
    input: InputOf<D>,
    caller: Caller<UseCaseSubjectOf<D>>,
  ): Promise<OutputOf<D>>;
  async execute(
    uc: string | AnyUseCaseDef,
    attrs: unknown,
    who?: unknown,
  ): Promise<unknown> {
    if (typeof uc !== 'string') {
      if (!isCaller(who)) {
        throw new Error(`ApiApp: для UC ${uc.name} нужен Caller`);
      }
      const res = await this.dmgUseCase(uc).handle(attrs, who);
      if (!res.ok) throw new AppException(toLegacyError(res.error));
      return res.value;
    }
    const ucName = uc;
    const actor = who;
    const module = this.getModules().find((m) => m.hasCommand(ucName));
    if (!module) {
      return throwError(
        errBadRequest<NoCommandFoundError>(
          'NO_COMMAND_FOUND',
          `Команда '${ucName}' не найдена ни в одном зарегистрированном модуле`,
          { commandName: ucName, moduleName: 'ApiApp' },
        ),
      );
    }

    // Логирование — внутри module.execute
    return module.execute(ucName, attrs, actor);
  }

  private dmgUseCase<D extends AnyUseCaseDef>(uc: D) {
    for (const module of this.dmgModules) {
      const impl = module.useCase(uc);
      if (impl !== undefined) return impl;
    }
    throw new Error(`ApiApp: UC ${uc.name} не зарегистрирован в модулях DMG`);
  }
}

/**
 * Перегрузка `execute` для Def гарантирует `Caller` типом; реализации
 * перегрузок TS этого не передаёт, поэтому — проверка вида. Тип субъекта
 * стёрт (`never`): реализация UC получена по тому же Def.
 */
function isCaller(value: unknown): value is Caller<never> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    (value.kind === 'guest' ||
      value.kind === 'user' ||
      value.kind === 'delegate' ||
      value.kind === 'system')
  );
}
