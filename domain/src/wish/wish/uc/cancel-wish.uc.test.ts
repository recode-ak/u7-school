import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { WishPolicy } from '../wish.policy';
import { WishRules } from '../wish.rules';
import { CancelWishUcDef } from './cancel-wish.uc';

const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';

describe('CancelWishUcDef', () => {
  it('нормализуется: command пользователя, без событий, ошибка NOT_FOUND', () => {
    expect(normalize(CancelWishUcDef)).toMatchObject({
      name: 'cancelWish',
      type: 'command',
      aggregate: 'wish',
      callers: ['user'],
      errors: ['WISH_NOT_FOUND', 'WISH_NOT_CANCELLABLE'],
      emits: [],
    });
  });

  it('Policy — только автор (canCancel), правило — cancellable', () => {
    expect(CancelWishUcDef.policy).toBe(WishPolicy.rules.canCancel);
    expect(CancelWishUcDef.rules).toEqual([WishRules.rules.cancellable]);
  });

  it('вход — цель желания: курс или модуль по kind', () => {
    const { input } = CancelWishUcDef;
    expect(
      v.safeParse(input, { kind: 'course', courseId: COURSE }).success,
    ).toBe(true);
    expect(
      v.safeParse(input, { kind: 'module', moduleId: MODULE }).success,
    ).toBe(true);
    expect(
      v.safeParse(input, { kind: 'module', courseId: COURSE }).success,
    ).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
  });

  it('выход — пустой объект', () => {
    expect(v.parse(CancelWishUcDef.output, {})).toEqual({});
  });
});
