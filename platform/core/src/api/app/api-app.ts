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
import type { AnyModuleFromDef, Trace } from 'dmg-core/app';
import { errBadRequest, throwError } from '#domain-legacy/errors/error-helpers';
import type { NoCommandFoundError } from '#domain-legacy/errors/errors';
import type {
  ApiExecutor,
  AppMeta,
  ExtractUcMetaFromMeta,
  GetUcNamesFromMeta,
} from '#domain-legacy/types';
import { legacyJobsOf } from '../../legacy-bridge';
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

  // Модули DMG живут рядом с legacy (strangler): их UC — командой через
  // dispatch по адресу модуля, реакции — на общей шине, задания — в общем
  // планировщике.
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
    const target = this.dmgModules.find((m) => m.def.name === module.name);
    if (target === undefined) {
      return CoreErrors.OPERATION_NOT_FOUND.err({
        module: module.name,
        uc: command.uc,
      });
    }
    return target.dispatch(command, caller, trace);
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
