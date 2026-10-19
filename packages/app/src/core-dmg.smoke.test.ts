import { describe, expect, it } from 'bun:test';
import * as dmg from '@u7-scl/core/dmg';

describe('@u7-scl/core/dmg', () => {
  it('импортируется из другого пакета', () => {
    expect(typeof dmg).toBe('object');
  });
});
