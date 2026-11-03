import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { WishErrors } from './wish.errors';

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MODULE = '1f2e3d4c-5b6a-4978-8695-a4b3c2d1e0f9';

const valid = (schema: v.GenericSchema | undefined, payload: unknown) =>
  schema !== undefined && v.safeParse(schema, payload).success;

describe('WishErrors — коды, kind и тексты', () => {
  it('отказы переходов и ошибки UC', () => {
    const shape = Object.values(WishErrors).map((e) => [
      e.code,
      e.kind,
      e.label,
    ]);
    expect(shape).toEqual([
      [
        'WISH_NOT_CONFIRMABLE',
        'conflict',
        'Подтвердить можно только ожидающее анкету желание',
      ],
      [
        'WISH_NOT_ABANDONABLE',
        'conflict',
        'Бросить можно только ожидающее анкету желание',
      ],
      [
        'WISH_NOT_CANCELLABLE',
        'conflict',
        'Отменить можно только выраженное или подтверждённое желание',
      ],
      [
        'WISH_NOT_FULFILLABLE',
        'conflict',
        'Реализовать можно только выраженное или подтверждённое желание',
      ],
      [
        'WISH_NOT_INVITABLE',
        'conflict',
        'Пригласить можно только выраженное или подтверждённое желание',
      ],
      [
        'WISH_ALREADY_INVITED',
        'conflict',
        'Желающий уже приглашён на этот поток',
      ],
      ['WISH_ALREADY_EXISTS', 'conflict', 'Желание уже выражено'],
      ['WISH_NOT_FOUND', 'not_found', 'Желание не найдено'],
      ['WISH_COURSE_NOT_FOUND', 'not_found', 'Курс не найден'],
      ['WISH_MODULE_NOT_FOUND', 'not_found', 'Модуль не найден'],
    ]);
  });
});

describe('WishErrors — схемы payload', () => {
  it('ALREADY_EXISTS: цель и статус существующего желания', () => {
    const { payload } = WishErrors.ALREADY_EXISTS;
    expect(
      valid(payload, { userId: USER, courseId: COURSE, status: 'pending' }),
    ).toBe(true);
    expect(
      valid(payload, { userId: USER, moduleId: MODULE, status: 'expressed' }),
    ).toBe(true);
    expect(valid(payload, { userId: USER, courseId: COURSE })).toBe(false);
    expect(
      valid(payload, {
        userId: USER,
        courseId: COURSE,
        moduleId: MODULE,
        status: 'pending',
      }),
    ).toBe(false);
    expect(valid(payload, { userId: USER, status: 'pending' })).toBe(false);
    expect(
      valid(payload, { userId: USER, courseId: COURSE, status: 'unknown' }),
    ).toBe(false);
  });

  it('NOT_FOUND: пользователь и цель', () => {
    const { payload } = WishErrors.NOT_FOUND;
    expect(valid(payload, { userId: USER, courseId: COURSE })).toBe(true);
    expect(valid(payload, { userId: USER, moduleId: MODULE })).toBe(true);
    expect(valid(payload, { courseId: COURSE })).toBe(false);
    expect(
      valid(payload, { userId: USER, courseId: COURSE, moduleId: MODULE }),
    ).toBe(false);
    expect(valid(payload, { userId: USER })).toBe(false);
  });

  it('COURSE_NOT_FOUND / MODULE_NOT_FOUND: идентификатор цели', () => {
    expect(
      valid(WishErrors.COURSE_NOT_FOUND.payload, { courseId: COURSE }),
    ).toBe(true);
    expect(valid(WishErrors.COURSE_NOT_FOUND.payload, { courseId: 'x' })).toBe(
      false,
    );
    expect(
      valid(WishErrors.MODULE_NOT_FOUND.payload, { moduleId: MODULE }),
    ).toBe(true);
    expect(valid(WishErrors.MODULE_NOT_FOUND.payload, {})).toBe(false);
  });

  it('make — код, kind, label и payload в значении ошибки', () => {
    expect(WishErrors.COURSE_NOT_FOUND.make({ courseId: COURSE })).toEqual({
      code: 'WISH_COURSE_NOT_FOUND',
      kind: 'not_found',
      label: 'Курс не найден',
      description: WishErrors.COURSE_NOT_FOUND.description,
      payload: { courseId: COURSE },
    });
  });
});
