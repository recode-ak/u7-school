import { describe, expect, test } from 'bun:test';
import type { EventEnvelope } from '../app/events/event-envelope';
import { CoreErrors } from '../kernel/errors/core-errors';
import { ok } from '../kernel/result/result';
import { expectIdempotentReaction } from './reaction-idempotency';

const EVENT: EventEnvelope = {
  name: 'users.user.removed',
  payload: {},
  eventId: 'e-1',
  occurredAt: 0,
  aggregateId: 'u-1',
  cause: { kind: 'request', requestId: 'r-1' },
  correlationId: 'c-1',
};

/** Хранилище и опубликованное — то, что видит хелпер. */
function world() {
  const rows: number[] = [];
  const published: EventEnvelope[] = [];
  const seen: string[] = [];
  return { rows, published, seen, state: () => [...rows] };
}

describe('expectIdempotentReaction', () => {
  test('повтор без эффекта — проходит; вторая доставка с новым eventId', async () => {
    const w = world();
    await expectIdempotentReaction({
      event: EVENT,
      published: w.published,
      state: w.state,
      deliver: async (event) => {
        w.seen.push(event.eventId);
        if (w.rows.length === 0) {
          w.rows.push(1);
          w.published.push(event);
        }
        return ok();
      },
    });
    expect(w.seen).toHaveLength(2);
    expect(w.seen[0]).toBe('e-1');
    expect(w.seen[1]).not.toBe('e-1');
  });

  test('повтор пишет в хранилище — ошибка', async () => {
    const w = world();
    await expect(
      expectIdempotentReaction({
        event: EVENT,
        published: w.published,
        state: w.state,
        deliver: async () => {
          w.rows.push(1);
          return ok();
        },
      }),
    ).rejects.toThrow(
      'повторная доставка users.user.removed изменила хранилище',
    );
  });

  test('повтор публикует события — ошибка', async () => {
    const w = world();
    await expect(
      expectIdempotentReaction({
        event: EVENT,
        published: w.published,
        state: w.state,
        deliver: async (event) => {
          w.published.push(event);
          return ok();
        },
      }),
    ).rejects.toThrow(
      'повторная доставка users.user.removed опубликовала событий: 1',
    );
  });

  test('отказ первой или второй доставки — ошибка', async () => {
    const w = world();
    let calls = 0;
    const deliver = async () => {
      calls++;
      return calls === 2 ? CoreErrors.SERVER_INTERNAL.err() : ok();
    };
    await expect(
      expectIdempotentReaction({
        event: EVENT,
        published: w.published,
        state: w.state,
        deliver,
      }),
    ).rejects.toThrow(
      'повторная доставка users.user.removed: ожидался Ok, получена ошибка SERVER_INTERNAL',
    );
    calls = 1;
    await expect(
      expectIdempotentReaction({
        event: EVENT,
        published: w.published,
        state: w.state,
        deliver,
      }),
    ).rejects.toThrow(
      'первая доставка users.user.removed: ожидался Ok, получена ошибка SERVER_INTERNAL',
    );
  });
});
