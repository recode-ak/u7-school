import type { Command } from '#core/domain/contracts/command';
import type { AnyModuleDef } from '#core/domain/contracts/module-def';
import type {
  AnyUseCaseDef,
  OutputOf,
  UseCaseErrorOf,
} from '#core/domain/contracts/use-case-def';
import type { Caller, Identified } from '#core/kernel/caller/caller';
import { CoreErrors } from '#core/kernel/errors/core-errors';
import type { Result } from '#core/kernel/result/result';
import type { SerializedResult } from '#core/kernel/result/serialized-result.types';
import type { Trace } from '#core/kernel/trace/trace';
import type { Logger } from '../context';

/**
 * Транспорт команд клиента: доставляет команду модулю по адресу (D-49).
 * In-proc — приложение (`ApiApp.dispatch` подходит как есть), ответ —
 * `Result` без сериализации.
 */
export type CommandTransport<U extends Identified = Identified> = {
  dispatch<D extends AnyUseCaseDef>(
    module: string,
    command: Command<D>,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;
};

/**
 * Клиент модуля (D-49, transport.md §4): знает адрес модуля — имя из Def —
 * и транспорт до него. Смена in-proc на HTTP меняет только транспорт,
 * вызывающий код остаётся прежним.
 */
export class ModuleApi<
  M extends AnyModuleDef,
  U extends Identified = Identified,
> {
  constructor(
    readonly def: M,
    private readonly transport: CommandTransport<U>,
    private readonly logger: Logger,
  ) {}

  /** Команда UC модуля; UC другого модуля — ошибка компиляции. */
  dispatch<D extends M['useCases'][number]>(
    command: Command<D>,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    return this.transport.dispatch(this.def.name, command, caller, trace);
  }

  /**
   * Ответ транспорта из простых данных — по Def UC команды. Ошибка вне
   * контракта (другая версия сервиса) становится `SERVER_INTERNAL`, исходный
   * `code` уходит в `warn` (ERR-07): ядро о расхождении не сообщает.
   */
  restore<D extends M['useCases'][number]>(
    command: Command<D>,
    wire: SerializedResult,
  ): Result<OutputOf<D>, UseCaseErrorOf<D>> {
    const restored = this.useCase(command).restoreResult(wire);
    if (
      !wire.ok &&
      !restored.ok &&
      restored.error.code === CoreErrors.SERVER_INTERNAL.code &&
      wire.error.code !== CoreErrors.SERVER_INTERNAL.code
    ) {
      this.logger.warn(
        `${this.def.name}.${command.uc}`,
        `ответ вне контракта UC: код ${wire.error.code} восстановлен как ${CoreErrors.SERVER_INTERNAL.code}`,
        { code: wire.error.code, kind: wire.error.kind },
      );
    }
    // Def найден по имени команды среди UC модуля — это `D`.
    return restored as Result<OutputOf<D>, UseCaseErrorOf<D>>;
  }

  private useCase(command: Command): AnyUseCaseDef {
    const def = this.def.useCases.find((uc) => uc.name === command.uc);
    if (def === undefined) {
      throw new Error(`UC ${command.uc} нет в модуле ${this.def.name}`);
    }
    return def;
  }
}
