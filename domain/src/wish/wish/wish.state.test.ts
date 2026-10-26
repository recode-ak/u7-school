import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { WishState, WishStatus, WishTargetVo } from './wish.state';

const validCourseTarget: WishTargetVo = {
  kind: 'course',
  courseId: crypto.randomUUID(),
};

describe('WishTargetVo', () => {
  test('принимает валидную цель module', () => {
    const validModuleTarget: WishTargetVo = {
      kind: 'module',
      moduleId: crypto.randomUUID(),
    };
    const result = v.safeParse(WishTargetVo, validModuleTarget);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toEqual(validModuleTarget);
    }
  });

  test('отклоняет module-цель с некорректным moduleId', () => {
    const result = v.safeParse(WishTargetVo, {
      kind: 'module',
      moduleId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  test('принимает валидную цель course', () => {
    const result = v.safeParse(WishTargetVo, validCourseTarget);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toEqual(validCourseTarget);
    }
  });

  test('отклоняет неизвестный kind цели', () => {
    const result = v.safeParse(WishTargetVo, {
      kind: 'mentorship',
      mentorId: 'x',
    });

    expect(result.success).toBe(false);
  });

  test('отклоняет цель course без courseId', () => {
    const result = v.safeParse(WishTargetVo, { kind: 'course' });

    expect(result.success).toBe(false);
  });

  test('отклоняет цель с невалидным форматом courseId', () => {
    const result = v.safeParse(WishTargetVo, {
      kind: 'course',
      courseId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  test('у полей обеих веток есть описание', () => {
    for (const branch of WishTargetVo.options) {
      for (const field of Object.values(branch.entries)) {
        expect(v.getDescription(field)).toBeString();
      }
    }
  });
});

describe('WishStatus', () => {
  test.each([
    'expressed',
    'pending',
    'confirmed',
    'cancelled',
    'abandoned',
    'fulfilled',
  ])('принимает статус %s', (status) => {
    expect(v.safeParse(WishStatus, status).success).toBe(true);
  });

  test('отклоняет неизвестный статус', () => {
    expect(v.safeParse(WishStatus, 'unknown').success).toBe(false);
  });
});

describe('WishState', () => {
  const base = {
    uuid: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    status: 'pending',
    createdAt: '2026-08-26T10:00',
    updatedAt: '2026-08-27T08:30:00.000Z',
  };

  test('принимает желание с target; ISO-даты (в т. ч. без зоны) — числа', () => {
    const result = v.safeParse(WishState, {
      ...base,
      target: validCourseTarget,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.target).toEqual(validCourseTarget);
      expect(result.output.createdAt).toBe(Date.UTC(2026, 7, 26, 10));
      expect(result.output.updatedAt).toBe(Date.UTC(2026, 7, 27, 8, 30));
      expect(result.output.version).toBe(0);
    }
  });

  test('отклоняет желание с legacy-полем courseId вместо target', () => {
    const legacyWish = { ...base, courseId: crypto.randomUUID() };

    expect(v.safeParse(WishState, legacyWish).success).toBe(false);
  });

  test('у каждого поля есть описание', () => {
    for (const field of Object.values(WishState.entries)) {
      expect(v.getDescription(field)).toBeString();
    }
  });
});
