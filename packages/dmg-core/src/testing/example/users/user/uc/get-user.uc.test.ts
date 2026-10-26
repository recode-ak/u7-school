import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { normalize } from '#core/graph/normalize';
import { GetUserUcDef } from './get-user.uc';

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';

describe('GetUserUcDef', () => {
  it('query только для системы (другие модули через фасад), ошибка — нет пользователя', () => {
    expect(normalize(GetUserUcDef)).toMatchObject({
      name: 'getUser',
      type: 'query',
      aggregate: 'user',
      callers: ['system'],
      errors: ['USER_NOT_FOUND'],
      emits: [],
    });
  });

  it('вход — { userId } uuid', () => {
    expect(v.is(GetUserUcDef.input, { userId: USER })).toBe(true);
    expect(v.is(GetUserUcDef.input, { userId: 'x' })).toBe(false);
  });

  it('выход — ответ «активен ли», а не state пользователя', () => {
    const answer = { userId: USER, active: false };
    expect(v.parse(GetUserUcDef.output, answer)).toEqual(answer);
    expect(v.is(GetUserUcDef.output, { userId: USER })).toBe(false);
  });
});
