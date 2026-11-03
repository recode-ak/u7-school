import type {
  AnyModuleDef,
  Command,
  OutputOf,
  Result,
  UseCaseErrorOf,
} from 'dmg-core';
import { Trace } from 'dmg-core/app';
import type { U7BotUiAppResolve } from './u7-bot-app-meta';

/** Кто и в каком запросе исполняет команду DMG. */
interface DispatchOpts {
  resolve: Pick<U7BotUiAppResolve, 'appApi' | 'callers'>;
  /** Субъект; без него — гость. */
  uuid?: string;
  telegramId?: number;
  requestId?: string;
  correlationId?: string;
  warn: (message: string, meta: { uc: string }) => void;
}

/**
 * Исполняет команду модуля DMG в процессе бота: собирает `Trace` канала
 * telegram, резолвит `Caller` и диспетчит. Общая реализация `dispatchUc`
 * стори и вызовов от гостя контроллеров.
 */
export async function dispatchModuleUc<
  M extends AnyModuleDef,
  D extends M['useCases'][number],
>(
  module: M,
  command: Command<D>,
  opts: DispatchOpts,
): Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>> {
  const trace = Trace.fromRequest(
    {
      requestId: opts.requestId,
      correlationId: opts.correlationId,
      channel: {
        name: 'telegram',
        visitorId:
          opts.telegramId === undefined ? undefined : String(opts.telegramId),
      },
    },
    (message) => opts.warn(message, { uc: command.uc }),
  );
  const caller = await opts.resolve.callers.resolve(opts.uuid, trace);
  return opts.resolve.appApi.dispatch(module, command, caller, trace);
}
