import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { WishState, WishStatus, WishTarget } from './wish.state';

const validCourseTarget: WishTarget = {
  kind: 'course',
  courseId: crypto.randomUUID(),
};

describe('WishTarget', () => {
  test('принимает валидную цель module', () => {
    const validModuleTarget: WishTarget = {
      kind: 'module',
      moduleId: crypto.randomUUID(),
    };
    const result = v.safeParse(WishTarget, validModuleTarget);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toEqual(validModuleTarget);
    }
  });

  test('отклоняет module-цель с некорректным moduleId', () => {
    const result = v.safeParse(WishTarget, {
      kind: 'module',
      moduleId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  test('принимает валидную цель course', () => {
    const result = v.safeParse(WishTarget, validCourseTarget);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toEqual(validCourseTarget);
    }
  });

  test('отклоняет неизвестный kind цели', () => {
    const result = v.safeParse(WishTarget, {
      kind: 'mentorship',
      mentorId: 'x',
    });

    expect(result.success).toBe(false);
  });

  test('отклоняет цель course без courseId', () => {
    const result = v.safeParse(WishTarget, { kind: 'course' });

    expect(result.success).toBe(false);
  });

  test('отклоняет цель с невалидным форматом courseId', () => {
    const result = v.safeParse(WishTarget, {
      kind: 'course',
      courseId: 'not-a-uuid',
    });

    expect(result.success).toBe(false);
  });

  test('у полей обеих веток есть описание', () => {
    for (const branch of WishTarget.options) {
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
  test('принимает желание с target вместо courseId', () => {
    const wish = {
      uuid: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      target: validCourseTarget,
      status: 'pending',
      createdAt: '2026-08-26T10:00',
    };

    const result = v.safeParse(WishState, wish);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.target).toEqual(validCourseTarget);
    }
  });

  test('отклоняет желание с legacy-полем courseId вместо target', () => {
    const legacyWish = {
      uuid: crypto.randomUUID(),
      userId: crypto.randomUUID(),
      courseId: crypto.randomUUID(),
      status: 'expressed',
      createdAt: '2026-08-26T10:00',
    };

    expect(v.safeParse(WishState, legacyWish).success).toBe(false);
  });

  test('у полей userId, target, status есть описание', () => {
    const { userId, target, status } = WishState.entries;

    for (const field of [userId, target, status]) {
      expect(v.getDescription(field)).toBeString();
    }
  });
});
