import { describe, expect, test } from 'bun:test';
import { AppException } from '@u7-scl/core/domain';
import { WishAr } from '@u7-scl/domain/wish';
import { WishErrors } from '@u7-scl/domain/wish/contract';
import { ok } from 'dmg-core';
import {
  throwIfRejected,
  throwWishError,
  unwrapInfallible,
} from './legacy-reject';

const userId = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const courseId = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

const pendingWish = () =>
  WishAr.restore({
    uuid: '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10',
    userId,
    target: { kind: 'course', courseId },
    status: 'pending',
    createdAt: 0,
    updatedAt: 0,
    version: 0,
  });

/** Пойманное исключение вызова. */
function caught(fn: () => void): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
}

describe('throwIfRejected', () => {
  test('ok — не бросает', () => {
    expect(() => throwIfRejected(ok(undefined))).not.toThrow();
  });

  test('err — legacy-исключение с кодом и kind ошибки Def, текст label (TR-3)', () => {
    const res = pendingWish().cancel(1);
    if (res.ok) throw new Error('ожидался err');

    const e = caught(() => throwIfRejected(res));
    expect(e).toBeInstanceOf(AppException);
    const { error } = e as AppException;
    expect(error.name).toBe('WISH_NOT_CANCELLABLE');
    expect(error.kind).toBe('conflict');
    expect(error.message).toBe(res.error.label);
  });
});

describe('throwWishError', () => {
  test('ошибка WishErrors → legacy-исключение: код, kind, label, payload', () => {
    const payload = { userId, courseId };

    const e = caught(() => throwWishError(WishErrors.NOT_FOUND.make(payload)));
    expect(e).toBeInstanceOf(AppException);
    expect((e as AppException).error).toEqual({
      name: 'WISH_NOT_FOUND',
      level: 'domain',
      kind: 'not-found',
      message: 'Желание не найдено',
      payload,
    });
  });
});

describe('unwrapInfallible', () => {
  test('возвращает значение ok', () => {
    expect(unwrapInfallible(ok(42))).toBe(42);
  });
});
