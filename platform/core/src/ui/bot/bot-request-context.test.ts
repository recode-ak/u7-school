import { describe, expect, test } from 'bun:test';
import { BotRequestContext } from './bot-request-context';

describe('BotRequestContext', () => {
  test('вне обработки апдейта контекста нет', () => {
    expect(BotRequestContext.current()).toBeUndefined();
  });

  test('correlationId — id апдейта Telegram', () => {
    BotRequestContext.run(42, () => {
      expect(BotRequestContext.current()?.correlationId).toBe('tg:42');
    });
  });

  test('requestId — номер вызова за апдейт: tg:<update_id>#<n>', () => {
    BotRequestContext.run(42, () => {
      const ctx = BotRequestContext.current();
      expect(ctx?.nextRequestId()).toBe('tg:42#1');
      expect(ctx?.nextRequestId()).toBe('tg:42#2');
    });
  });

  test('повтор апдейта — те же requestId (счётчик с нуля на каждый run)', () => {
    const ids: string[] = [];
    for (let i = 0; i < 2; i++) {
      BotRequestContext.run(7, () => {
        ids.push(BotRequestContext.current()?.nextRequestId() ?? '');
      });
    }
    expect(ids).toEqual(['tg:7#1', 'tg:7#1']);
  });

  test('контекст переживает await и не смешивается между параллельными апдейтами', async () => {
    const tick = () => new Promise((r) => setTimeout(r, 1));
    const handle = (updateId: number) =>
      BotRequestContext.run(updateId, async () => {
        await tick();
        const first = BotRequestContext.current()?.nextRequestId();
        await tick();
        return [first, BotRequestContext.current()?.nextRequestId()];
      });

    expect(await Promise.all([handle(1), handle(2)])).toEqual([
      ['tg:1#1', 'tg:1#2'],
      ['tg:2#1', 'tg:2#2'],
    ]);
  });

  test('цепочка промисов, начатая в контексте, видит его (очередь транспорта)', async () => {
    let tail: Promise<unknown> = Promise.resolve();
    const seen = await BotRequestContext.run(5, () => {
      tail = tail.then(() => BotRequestContext.current()?.correlationId);
      return tail;
    });
    expect(seen).toBe('tg:5');
  });
});
