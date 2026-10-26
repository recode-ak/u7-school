import type { EventEnvelope } from '../app/events/event-envelope';
import type { Result } from '../kernel/result/result';

type Coded = { readonly code: string };

/** Что нужно хелперу: событие, доставка в реакцию и что наблюдать. */
export type ReactionIdempotencySpec<E extends EventEnvelope> = {
  /** Первая доставка; вторая — тот же конверт с новым `eventId`. */
  readonly event: E;
  /** Доставка в реакцию — обычно `er.handle`. */
  readonly deliver: (event: E) => Promise<Result<void, Coded>>;
  /** Конверты, отданные в outbox (`testAppContext().published`). */
  readonly published: readonly EventEnvelope[];
  /**
   * Снимок хранилища, которое пишет реакция: снимается после первой и после
   * второй доставки и сравнивается `Bun.deepEquals`. Может быть асинхронным
   * (например, `() => Bun.file(path).text()`) — хелпер его дожидается.
   */
  readonly state: () => unknown | Promise<unknown>;
};

/**
 * Контракт идемпотентности ER (D-47): событие доставлено дважды с разными
 * `eventId` (inbox повтор не отсеет — как второе `stream.created`). Обе
 * доставки — `Ok`; вторая не меняет хранилище и не публикует событий.
 * Не зависит от тест-раннера: нарушение — исключение с понятным текстом.
 */
export async function expectIdempotentReaction<E extends EventEnvelope>(
  spec: ReactionIdempotencySpec<E>,
): Promise<void> {
  const { event, deliver, published, state } = spec;
  expectDelivered(`первая доставка ${event.name}`, await deliver(event));
  const before = await state();
  const sent = published.length;
  const repeat = { ...event, eventId: crypto.randomUUID() };
  const label = `повторная доставка ${event.name}`;
  expectDelivered(label, await deliver(repeat));
  if (published.length !== sent) {
    throw new Error(
      `${label} опубликовала событий: ${published.length - sent}`,
    );
  }
  if (!Bun.deepEquals(await state(), before)) {
    throw new Error(`${label} изменила хранилище`);
  }
}

function expectDelivered(label: string, res: Result<void, Coded>): void {
  if (!res.ok) {
    throw new Error(`${label}: ожидался Ok, получена ошибка ${res.error.code}`);
  }
}
