import { describe, expect, test } from 'bun:test';
import { createHmac } from 'node:crypto';
import { VisitorId } from './visitor-id';

// `trace.channel.visitorId` бота — непрозрачный стабильный id вместо Telegram ID
// (F-111, Ф4): HMAC-SHA256 от telegramId с ключом из токена бота, 16 hex.

const KEY = 'test-bot-token:fixed-key';

describe('VisitorId', () => {
  test('16 hex-символов в нижнем регистре', () => {
    expect(new VisitorId(KEY).of(1001)).toMatch(/^[0-9a-f]{16}$/);
  });

  test('значение — первые 16 hex от HMAC-SHA256(ключ, telegramId)', () => {
    const expected = createHmac('sha256', KEY)
      .update(String(1001))
      .digest('hex')
      .slice(0, 16);

    expect(new VisitorId(KEY).of(1001)).toBe(expected);
  });

  test('стабилен: один telegramId — один id (ключ отсева повторов гостя)', () => {
    expect(new VisitorId(KEY).of(1001)).toBe(new VisitorId(KEY).of(1001));
  });

  test('разные telegramId — разные id', () => {
    const visitors = new VisitorId(KEY);

    expect(visitors.of(1001)).not.toBe(visitors.of(1002));
  });

  test('другой ключ — другой id для того же telegramId', () => {
    expect(new VisitorId(KEY).of(1001)).not.toBe(
      new VisitorId('another-key').of(1001),
    );
  });

  test.each([1, 1001, 987654321, 5_000_000_000])(
    'id не содержит telegramId %d',
    (telegramId) => {
      expect(new VisitorId(KEY).of(telegramId)).not.toContain(
        String(telegramId),
      );
    },
  );

  test('пустой ключ — ошибка: без ключа id был бы подбираемым', () => {
    expect(() => new VisitorId('')).toThrow();
  });
});

// Ключ тестов ставит прелоад (`scripts/test-preload.ts`).
const PRELOAD_KEY = 'test-bot-token';

describe('VisitorId — установленный экземпляр процесса', () => {
  test('после install(k) installed().of(x) равно new VisitorId(k).of(x)', () => {
    VisitorId.install(PRELOAD_KEY);

    expect(VisitorId.installed().of(1001)).toBe(
      new VisitorId(PRELOAD_KEY).of(1001),
    );
  });

  test('повторный install с другим ключом — ошибка, id не подменяется', () => {
    const before = VisitorId.installed().of(1001);

    expect(() => VisitorId.install('another-key')).toThrow();
    expect(VisitorId.installed().of(1001)).toBe(before);
  });
});
