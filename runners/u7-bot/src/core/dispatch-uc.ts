import { BotRequestContext } from '@u7-scl/core/ui';
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
  warn: (message: string, meta: { uc: string }) => void;
}

/**
 * След запроса канала telegram: `requestId` и `correlationId` — из контекста
 * апдейта Telegram (`BotRequestContext`, транспорт); вне обработки апдейта
 * контекста нет — id создаётся на вызов с `warn` (ERR-07, caller.md §2).
 * Единый способ построения следа для вызова UC и для резолва субъекта.
 */
export function requestTrace(
  telegramId: number | undefined,
  warn: (message: string) => void,
): Trace {
  const request = BotRequestContext.current();
  return Trace.fromRequest(
    {
      requestId: request?.nextRequestId(),
      correlationId: request?.correlationId,
      channel: {
        name: 'telegram',
        visitorId: telegramId === undefined ? undefined : String(telegramId),
      },
    },
    warn,
  );
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
  const trace = requestTrace(opts.telegramId, (message) =>
    opts.warn(message, { uc: command.uc }),
  );
  const caller = await opts.resolve.callers.resolve(opts.uuid, trace);
  return opts.resolve.appApi.dispatch(module, command, caller, trace);
}
