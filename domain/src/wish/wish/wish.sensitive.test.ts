import { describe, expect, test } from 'bun:test';
import { SensitiveMask } from 'dmg-core';
import { WishEvents } from './wish.events';

const mask = new SensitiveMask();

describe('wish: места с персональными данными помечены F.sensitive', () => {
  test('событие invited: addressee.telegramId', () => {
    expect(mask.isSensitive(WishEvents.invited.payload, 'telegramId')).toBe(
      true,
    );
  });
});
