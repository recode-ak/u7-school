import {
  type AnyModuleDef,
  type Caller,
  type Command,
  CoreErrors,
  type Identified,
  type OutputOf,
  type Result,
  type UseCaseErrorOf,
} from 'dmg-core';
import type { ApiApp as DmgApiApp, Trace } from 'dmg-core/app';
import { errBadRequest, throwError } from '#domain-legacy/errors/error-helpers';
import type { NoCommandFoundError } from '#domain-legacy/errors/errors';
import type {
  ApiExecutor,
  AppMeta,
  ExtractUcMetaFromMeta,
  GetUcNamesFromMeta,
} from '#domain-legacy/types';
import { legacyJobsOf } from '../../legacy-bridge';
import type { Job } from '../job/job';
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

  // Модули DMG живут рядом с legacy (strangler): собирает их ApiApp пакета
  // (корень сборки, D-50), здесь — делегирование: UC — командой через
  // dispatch по адресу модуля, реакции — на общей шине, задания — в общем
  // планировщике.
  private dmg: DmgApp<TActor> | undefined;
  private dmgUnsubscribe: (() => void) | undefined;

  /**
   * Подключает собранное приложение DMG; вызывать до init(). `modules` —
   * Def его модулей: по ним планировщик получает задания (`ApiApp` пакета
   * модули наружу не отдаёт). Повторное подключение — ошибка сборки.
   */
  withDmg(
    api: DmgApiApp<DmgActor<TActor>>,
    modules: readonly AnyModuleDef[],
  ): this {
    if (this.dmg !== undefined) {
      throw new Error('ApiApp: приложение DMG уже подключено');
    }
    this.dmg = { api, modules };
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
    this.dmgUnsubscribe?.();
    this.dmgUnsubscribe = this.dmg?.api.subscribe();
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
      ...this.dmgJobs(),
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
   * Исполнение команды модулем DMG (D-49): адрес — Def модуля, по его имени
   * приложение находит модуль, а UC модуль находит по имени из команды.
   * Команда UC другого модуля — ошибка компиляции; модуль не подключён —
   * `OPERATION_NOT_FOUND`. Caller и след строит адаптер входа
   * (`Trace.fromRequest`: `requestId` от клиента, а если его нет — создаётся
   * с `warn`, ERR-07; caller.md §2 п. 7).
   */
  async dispatch<M extends AnyModuleDef, D extends M['useCases'][number]>(
    module: M,
    command: Command<D>,
    caller: Caller<DmgActor<TActor>>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    if (this.dmg === undefined) {
      return CoreErrors.OPERATION_NOT_FOUND.err({
        module: module.name,
        uc: command.uc,
      });
    }
    return this.dmg.api.dispatch(module, command, caller, trace);
  }

  /** Задания модулей DMG в форме legacy: прогон — `runJob` приложения DMG. */
  private dmgJobs(): Job[] {
    if (this.dmg === undefined) return [];
    const { api, modules } = this.dmg;
    return modules.flatMap((def) =>
      legacyJobsOf({
        def,
        runJob: (job, trace) => api.runJob(def, job, trace),
      }),
    );
  }

  async execute<N extends GetUcNamesFromMeta<TMeta>>(
    ucName: N,
    attrs: ExtractUcMetaFromMeta<TMeta, N>['input'],
    actor?: TActor,
  ): Promise<ExtractUcMetaFromMeta<TMeta, N>['output']> {
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
}

/**
 * Актор так, как его видят модули DMG: с `uuid` для лога вызывающего
 * (D-43). Legacy-часть `ApiApp` принимает актора как есть.
 */
type DmgActor<TActor> = TActor & Identified;

/** Подключённое приложение DMG и Def его модулей. */
type DmgApp<TActor> = {
  readonly api: DmgApiApp<DmgActor<TActor>>;
  readonly modules: readonly AnyModuleDef[];
};
