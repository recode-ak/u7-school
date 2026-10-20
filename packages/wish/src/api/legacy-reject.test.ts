import { describe, expect, test } from 'bun:test';
import { AppException } from '@u7-scl/core/domain';
import { WishAr } from '@u7-scl/domain/wish';
import { ok } from 'dmg-core';
import { throwIfRejected, unwrapInfallible } from './legacy-reject';

const pendingWish = () =>
  WishAr.restore({
    uuid: '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10',
    userId: '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6',
    target: {
      kind: 'course',
      courseId: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
    },
    status: 'pending',
    createdAt: 0,
    updatedAt: 0,
    version: 0,
  });

describe('throwIfRejected', () => {
  test('ok — не бросает', () => {
    expect(() => throwIfRejected(ok(undefined))).not.toThrow();
  });

  test('err — legacy BAD_REQUEST с текстом label ошибки', () => {
    const res = pendingWish().cancel(1);
    if (res.ok) throw new Error('ожидался err');

    let caught: unknown;
    try {
      throwIfRejected(res);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AppException);
    const { error } = caught as AppException;
    expect(error.name).toBe('BAD_REQUEST');
    expect(error.kind).toBe('bad-request');
    expect(error.message).toBe(res.error.label);
  });
});

describe('unwrapInfallible', () => {
  test('возвращает значение ok', () => {
    expect(unwrapInfallible(ok(42))).toBe(42);
  });
});
