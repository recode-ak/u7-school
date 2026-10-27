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
 * Wire-транспорт клиента (D-49): доставляет команду модулю в другом
 * процессе (HTTP, очередь) и возвращает ответ простыми данными
 * (transport.md §1). Caller и Trace транспорт переводит в свою форму
 * (токен, заголовки).
 */
export type CommandTransport<U extends Identified = Identified> = {
  send(
    module: string,
    command: Command,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<SerializedResult>;
};

/**
 * Клиент модуля вне процесса (D-49, transport.md §4): адрес — имя из Def,
 * ответ восстанавливается по Def UC команды. In-proc клиенту он не нужен —
 * там команду исполняет `ApiApp.dispatch` по Def модуля.
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
  async dispatch<D extends M['useCases'][number]>(
    command: Command<D>,
    caller: Caller<U>,
    trace: Trace,
  ): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
    const wire = await this.transport.send(
      this.def.name,
      command,
      caller,
      trace,
    );
    return this.restore(command, wire);
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
