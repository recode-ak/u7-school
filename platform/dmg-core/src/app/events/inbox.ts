import type { OperationRef } from '#core/kernel/caller/caller';

/** Доставка события реакции: какой реакции и какой конверт. */
export type Delivery = {
  readonly reaction: OperationRef;
  readonly eventId: string;
};

/**
 * Порт inbox (D-47): отсев повторной доставки того же `eventId` той же
 * реакции. `claim` занимает доставку (`false` — уже обработана или
 * обрабатывается: повтор отбрасывается); `release` снимает её после сбоя
 * обработки — тогда повтор той же доставки снова будет принят. Повтор с
 * новым `eventId` — забота домена (хелпер `expectIdempotentReaction`).
 */
export type Inbox = {
  claim(delivery: Delivery): Promise<boolean>;
  release(delivery: Delivery): Promise<void>;
};

/** Сколько последних доставок помнит inbox в процессе по умолчанию. */
export const DEFAULT_INBOX_CAPACITY = 10_000;

/**
 * Inbox в памяти по умолчанию. Помнит не больше `capacity` последних
 * доставок — самые старые забываются: шина в процессе повторов не
 * присылает, память процесса не растёт без предела.
 */
export class InProcInbox implements Inbox {
  private readonly seen = new Set<string>();
  private readonly capacity: number;

  constructor(options: { readonly capacity?: number } = {}) {
    this.capacity = options.capacity ?? DEFAULT_INBOX_CAPACITY;
  }

  async claim(delivery: Delivery): Promise<boolean> {
    const key = keyOf(delivery);
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    // Set хранит порядок вставки: первый ключ — самая старая доставка.
    for (const oldest of this.seen) {
      if (this.seen.size <= this.capacity) break;
      this.seen.delete(oldest);
    }
    return true;
  }

  async release(delivery: Delivery): Promise<void> {
    this.seen.delete(keyOf(delivery));
  }
}

function keyOf({ reaction, eventId }: Delivery): string {
  return `${reaction.module}/${reaction.name}/${eventId}`;
}
