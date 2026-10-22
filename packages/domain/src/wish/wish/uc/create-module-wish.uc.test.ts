import { describe, expect, it } from 'bun:test';
import { GetModuleEnrollmentUcDef } from '@u7-scl/domain/course/contract';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { WishRules } from '../wish.rules';
import { CreateModuleWishUcDef } from './create-module-wish.uc';

const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';

describe('CreateModuleWishUcDef', () => {
  it('нормализуется: command пользователя, без событий, ошибки модуля и дубля', () => {
    expect(normalize(CreateModuleWishUcDef)).toMatchObject({
      name: 'createModuleWish',
      type: 'command',
      aggregate: 'wish',
      callers: ['user'],
      errors: ['WISH_MODULE_NOT_FOUND', 'WISH_ALREADY_EXISTS'],
      emits: [],
    });
    expect(CreateModuleWishUcDef.policy.op).toBe('allowAll');
  });

  it('правила: сначала модуль доступен, затем уникальность', () => {
    expect(CreateModuleWishUcDef.rules).toEqual([
      WishRules.rules.moduleEnrollable,
      WishRules.rules.unique,
    ]);
  });

  it('calls — запись на модуль', () => {
    expect(CreateModuleWishUcDef.calls).toEqual([GetModuleEnrollmentUcDef]);
  });

  it('вход — { moduleId } uuid', () => {
    const { input } = CreateModuleWishUcDef;
    expect(v.safeParse(input, { moduleId: MODULE }).success).toBe(true);
    expect(v.safeParse(input, { moduleId: 'x' }).success).toBe(false);
  });

  it('выход — пустой объект', () => {
    expect(v.parse(CreateModuleWishUcDef.output, {})).toEqual({});
  });
});
