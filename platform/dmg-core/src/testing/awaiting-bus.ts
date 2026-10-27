import type { EnvelopeOf } from '../app/events/event-envelope';
import type { AnyEventDef } from '../domain/events/event-def';
import { MemoryBus } from './memory-bus';

/**
 * Шина в памяти, которая помнит запущенные обработчики: `delivered()`
 * дожидается их завершения без таймеров (`MemoryBus` их не возвращает) —
 * в том числе обработчиков, запущенных событиями других обработчиков.
 */
export class AwaitingBus extends MemoryBus {
  private readonly pending: Promise<void>[] = [];

  override subscribe<D extends AnyEventDef>(
    def: D,
    handler: (envelope: EnvelopeOf<D>) => Promise<void>,
  ): () => void {
    return super.subscribe(def, (envelope) => {
      const run = handler(envelope);
      this.pending.push(run);
      // Отказ разбирает `delivered()`; шине отдаём обработанный промис.
      return run.catch(() => {});
    });
  }

  /**
   * Дожидается всех запущенных обработчиков, пока не появятся новые. Отказ
   * одного не прерывает ожидание остальных: после всех — первая ошибка.
   */
  async delivered(): Promise<void> {
    const errors: unknown[] = [];
    while (this.pending.length > 0) {
      for (const result of await Promise.allSettled(this.pending.splice(0))) {
        if (result.status === 'rejected') errors.push(result.reason);
      }
    }
    if (errors.length > 0) throw errors[0];
  }
}
