import { describe, expect, test } from 'bun:test';
import type { OperationRef } from '#core/kernel/caller/caller';
import { type Delivery, InProcInbox } from './inbox';

const ER: OperationRef = {
  kind: 'eventReaction',
  module: 'todo',
  name: 'archiveRemovedUserTasks',
};
const OTHER: OperationRef = { ...ER, module: 'stats' };
const at = (eventId: string, reaction = ER): Delivery => ({
  reaction,
  eventId,
});

describe('InProcInbox', () => {
  test('первая доставка принята, повтор того же eventId — нет', async () => {
    const inbox = new InProcInbox();
    expect(await inbox.claim(at('e-1'))).toBe(true);
    expect(await inbox.claim(at('e-1'))).toBe(false);
    expect(await inbox.claim(at('e-2'))).toBe(true);
  });

  test('тот же eventId другой реакции — отдельная доставка', async () => {
    const inbox = new InProcInbox();
    expect(await inbox.claim(at('e-1'))).toBe(true);
    expect(await inbox.claim(at('e-1', OTHER))).toBe(true);
  });

  test('после release доставка снова принимается', async () => {
    const inbox = new InProcInbox();
    await inbox.claim(at('e-1'));
    await inbox.release(at('e-1'));
    expect(await inbox.claim(at('e-1'))).toBe(true);
  });

  test('сверх ёмкости забываются самые старые доставки', async () => {
    const inbox = new InProcInbox({ capacity: 2 });
    await inbox.claim(at('e-1'));
    await inbox.claim(at('e-2'));
    await inbox.claim(at('e-3'));
    expect(await inbox.claim(at('e-1'))).toBe(true);
    expect(await inbox.claim(at('e-3'))).toBe(false);
  });
});
