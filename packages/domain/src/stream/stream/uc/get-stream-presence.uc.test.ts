import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { GetStreamPresenceUcDef } from './get-stream-presence.uc';

const STREAM = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';

describe('GetStreamPresenceUcDef', () => {
  it('query для других модулей над агрегатом потока, без ограничений и ошибок', () => {
    expect(normalize(GetStreamPresenceUcDef)).toMatchObject({
      name: 'getStreamPresence',
      type: 'query',
      aggregate: 'stream',
      callers: ['system'],
      errors: [],
    });
    expect(GetStreamPresenceUcDef.policy.op).toBe('allowAll');
  });

  it('вход — uuid потока', () => {
    const { input } = GetStreamPresenceUcDef;
    expect(v.parse(input, { streamId: STREAM })).toEqual({ streamId: STREAM });
    expect(v.safeParse(input, { streamId: 'x' }).success).toBe(false);
  });

  it('выход — признак наличия; отсутствие потока — не ошибка', () => {
    const { output } = GetStreamPresenceUcDef;
    expect(v.parse(output, { exists: true })).toEqual({ exists: true });
    expect(v.parse(output, { exists: false })).toEqual({ exists: false });
    expect(v.safeParse(output, {}).success).toBe(false);
  });
});
