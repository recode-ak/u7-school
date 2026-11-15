import { BotRequestContext, UiEventContext } from '@u7-scl/core/ui';
import type {
  AnyModuleDef,
  Caller,
  Command,
  OutputOf,
  Result,
  UseCaseErrorOf,
} from 'dmg-core';
import { Trace } from 'dmg-core/app';
import type { U7BotUiAppResolve } from './u7-bot-app-meta';
import { VisitorId } from './visitor-id';

/** Кто и в каком запросе исполняет команду DMG. */
interface DispatchOpts {
  resolve: Pick<U7BotUiAppResolve, 'appApi' | 'callers'>;
  /** Субъект по uuid (резолвер `Caller`); без него — гость. */
  uuid?: string;
  /** Готовый `Caller` (актор бота) — резолвер не вызывается; приоритетнее `uuid`. */
  caller?: Caller;
  telegramId?: number;
  warn: (message: string, meta: { uc: string }) => void;
}

/**
 * След вызова из бота. В реакции на событие (`UiEventContext`, подписки
 * `UiApp`) — след события: причина — событие, цепочка — его;
 * реакция ближе апдейта, поэтому приоритетнее. Иначе — запрос канала
 * telegram: `requestId` и `correlationId` — из контекста апдейта Telegram
 * (`BotRequestContext`, транспорт); вне апдейта контекста нет — id создаётся
 * на вызов с `warn` (ERR-07, caller.md §2). Посетитель — непрозрачный
 * `VisitorId`, не Telegram ID (D-86).
 * Единый способ построения следа для вызова UC и для резолва субъекта.
 */
export function requestTrace(
  telegramId: number | undefined,
  warn: (message: string) => void,
): Trace {
  const event = UiEventContext.current();
  if (event) return Trace.fromEvent(event);
  const request = BotRequestContext.current();
  return Trace.fromRequest(
    {
      requestId: request?.nextRequestId(),
      correlationId: request?.correlationId,
      channel: {
        name: 'telegram',
        visitorId:
          telegramId === undefined
            ? undefined
            : VisitorId.installed().of(telegramId),
      },
    },
    warn,
  );
}

/**
 * Исполняет команду модуля DMG в процессе бота: собирает `Trace` канала
 * telegram, берёт готовый `Caller` или резолвит по `uuid` и диспетчит. Общая реализация `dispatchUc`
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
  const caller =
    opts.caller ?? (await opts.resolve.callers.resolve(opts.uuid, trace));
  return opts.resolve.appApi.dispatch(module, command, caller, trace);
}
