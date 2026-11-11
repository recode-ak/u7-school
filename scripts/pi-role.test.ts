import { describe, expect, it } from 'bun:test';
import { PiUsage } from './pi-role';

const assistant = (usage: object, text = '', stopReason = 'stop') =>
  JSON.stringify({
    type: 'message_end',
    message: {
      role: 'assistant',
      stopReason,
      usage,
      content: text ? [{ type: 'text', text }] : [],
    },
  });

const usage = (
  input: number,
  cacheRead: number,
  output: number,
  cost: number,
) => ({
  input,
  cacheRead,
  output,
  totalTokens: input + cacheRead + output,
  cost: { total: cost },
});

describe('PiUsage.fromJsonl', () => {
  it('суммирует usage ассистента и берёт последний непустой текст', () => {
    const jsonl = [
      JSON.stringify({ type: 'session' }),
      assistant(usage(100, 0, 10, 0.01), 'первый'),
      JSON.stringify({
        type: 'turn_end',
        message: { role: 'assistant', usage: usage(999, 0, 0, 9) },
      }),
      assistant(usage(10, 90, 5, 0.002)),
      assistant(usage(5, 195, 20, 0.003), 'итог'),
      'не json',
    ].join('\n');

    const u = PiUsage.fromJsonl(jsonl);

    expect(u.turns).toBe(3);
    expect(u.input).toBe(115);
    expect(u.cacheRead).toBe(285);
    expect(u.output).toBe(35);
    expect(u.cost).toBeCloseTo(0.015, 6);
    expect(u.hitRate).toBe(71);
    expect(u.answer).toBe('итог');
    expect(u.error).toBeUndefined();
  });

  it('ошибка провайдера в последнем ходе — в error (например, кончился баланс)', () => {
    const jsonl = [
      assistant(usage(10, 0, 1, 0.001), 'шаг'),
      JSON.stringify({
        type: 'message_end',
        message: {
          role: 'assistant',
          stopReason: 'error',
          errorMessage: '402: Insufficient Balance',
          usage: usage(0, 0, 0, 0),
          content: [],
        },
      }),
    ].join('\n');

    expect(PiUsage.fromJsonl(jsonl).error).toBe('402: Insufficient Balance');
  });

  it('misses — ходы после первого, где некэшированный вход больше кэшированного', () => {
    const jsonl = [
      assistant(usage(9000, 0, 1, 0)),
      assistant(usage(500, 9000, 1, 0)),
      assistant(usage(8000, 2000, 1, 0)),
      assistant(usage(300, 10000, 1, 0)),
    ].join('\n');

    expect(PiUsage.fromJsonl(jsonl).misses).toBe(1);
  });

  it('пустой вывод — нули, без деления на ноль', () => {
    const u = PiUsage.fromJsonl('');
    expect(u.turns).toBe(0);
    expect(u.hitRate).toBe(0);
    expect(u.answer).toBe('');
  });
});
