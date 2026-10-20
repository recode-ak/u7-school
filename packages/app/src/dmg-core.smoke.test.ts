import { describe, expect, it } from 'bun:test';
import * as dmg from 'dmg-core';

describe('dmg-core', () => {
  it('импортируется из другого пакета', () => {
    expect(typeof dmg).toBe('object');
  });
});
