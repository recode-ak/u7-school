import {
  type AnyUseCaseDef,
  Caller,
  type Command,
  CoreErrors,
  type Identified,
  type InputOf,
  type OutputOf,
  type Result,
  type UseCaseErrorOf,
} from 'dmg-core';
import type { AnyModuleFromDef, Trace } from 'dmg-core/app';
import { errBadRequest, throwError } from '#domain-legacy/errors/error-helpers';
import {
  AppException,
  type NoCommandFoundError,
} from '#domain-legacy/errors/errors';
import type {
  ApiExecutor,
  AppMeta,
  ExtractUcMetaFromMeta,
  GetUcNamesFromMeta,
} from '#domain-legacy/types';
import { legacyJobsOf, toLegacyError } from '../../legacy-bridge';
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
  private readonly dmgModules: AnyModuleFromDef<DmgActor<TActor>>[] = [];
  private dmgUnsubscribes: Array<() => void> = [];

  /**
   * Подключает модули DMG; вызывать до init(). Имя модуля — адрес команды
   * (D-49), поэтому дубль — ошибка сборки.
   */
  addDmgModules(...modules: AnyModuleFromDef<DmgActor<TActor>>[]): this {
    for (const module of modules) {
      if (this.dmgModules.some((m) => m.def.name === module.def.name)) {
        throw new Error(`ApiApp: модуль DMG ${module.def.name} уже подключён`);
      }
      this.dmgModules.push(module);
    }
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
      ...this.dmgModules.flatMap((module) => legacyJobsOf(module)),
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

  /**
   * Исполнение UC DMG по его Def: отказ — значение `Err`. След строит
   * адаптер транспорта на входе (`Trace.fromRequest`: `requestId` от
   * клиента, а если его нет — создаётся с `warn`, ERR-07; caller.md §2 п. 7).
   */
  async run<D extends AnyUseCaseDef>(
    uc: D,
    input: InputOf<D>,
    caller: Caller<DmgActor<TActor>>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    return this.dmgModule(uc).handle(uc, input, caller, trace);
  }

  /**
   * Исполнение команды модулем по адресу транспорта (D-49): адрес — имя
   * модуля (URL `POST /api/<module>`, in-proc `moduleApi`), UC модуль
   * находит по имени. Неизвестный модуль или UC — `OPERATION_NOT_FOUND`.
   * След и Caller строит адаптер транспорта на входе, как у `run`.
   */
  async dispatch<D extends AnyUseCaseDef>(
    module: string,
    command: Command<D>,
    caller: Caller<DmgActor<TActor>>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    const target = this.dmgModules.find((m) => m.def.name === module);
    if (target === undefined) {
      return CoreErrors.OPERATION_NOT_FOUND.err({ module, uc: command.uc });
    }
    return target.dispatch(command, caller, trace);
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
    caller: Caller<DmgActor<TActor>>,
    trace: Trace,
  ): Promise<OutputOf<D>>;
  async execute(
    uc: string | AnyUseCaseDef,
    attrs: unknown,
    who?: unknown,
    trace?: Trace,
  ): Promise<unknown> {
    if (typeof uc !== 'string') {
      if (!isCaller<DmgActor<TActor>>(who) || trace === undefined) {
        throw new Error(`ApiApp: для UC ${uc.name} нужны Caller и Trace`);
      }
      const res = await this.dmgModule(uc).handle(uc, attrs, who, trace);
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

  /** Модуль DMG, реализующий UC: вход в UC — только его `handle` (D-43). */
  private dmgModule(uc: AnyUseCaseDef): AnyModuleFromDef<DmgActor<TActor>> {
    const module = this.dmgModules.find((m) => m.serves(uc));
    if (module === undefined) {
      throw new Error(`ApiApp: UC ${uc.name} не зарегистрирован в модулях DMG`);
    }
    return module;
  }
}

/**
 * Актор так, как его видят модули DMG: с `uuid` для лога вызывающего
 * (D-43). Legacy-часть `ApiApp` принимает актора как есть.
 */
type DmgActor<TActor> = TActor & Identified;

/**
 * Перегрузка `execute` для Def гарантирует `Caller<TActor>` типом;
 * реализации перегрузок TS этого не передаёт, поэтому — проверка класса.
 */
function isCaller<U extends Identified>(value: unknown): value is Caller<U> {
  return value instanceof Caller;
}
