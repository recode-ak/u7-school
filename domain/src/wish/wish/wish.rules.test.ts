import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { WishAr } from './wish.ar';
import { WishRules } from './wish.rules';
import type { WishStatus, WishTargetVo } from './wish.state';

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const OTHER = 'a1b2c3d4-0000-4000-8000-000000000001';
const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const course: WishTargetVo = { kind: 'course', courseId: COURSE };
const module: WishTargetVo = { kind: 'module', moduleId: MODULE };

let seq = 0;
const wish = (
  status: WishStatus,
  target: WishTargetVo = course,
  userId = USER,
) =>
  WishAr.restore({
    uuid: `0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f${String(10 + seq++).padStart(2, '0')}`,
    userId,
    target,
    status,
    createdAt: 0,
    updatedAt: 0,
    version: 0,
  });

const { unique } = WishRules.rules;

describe('WishRules.unique', () => {
  it('желаний на цель нет — ok', () => {
    expectOk(unique.check({ userId: USER, target: course, wishes: [] }));
  });

  it('только неактивные — ok', () => {
    const wishes = [wish('cancelled'), wish('abandoned'), wish('fulfilled')];
    expectOk(unique.check({ userId: USER, target: course, wishes }));
  });

  it.each(['expressed', 'pending', 'confirmed'] as const)(
    'есть активное %s — WISH_ALREADY_EXISTS со статусом существующего',
    (status) => {
      const error = expectErr(
        unique.check({
          userId: USER,
          target: course,
          wishes: [wish('cancelled'), wish(status)],
        }),
        'WISH_ALREADY_EXISTS',
      );
      expect(error.kind).toBe('conflict');
      expect(error.payload).toEqual({ userId: USER, courseId: COURSE, status });
    },
  );

  it('цель-модуль — payload с moduleId', () => {
    const error = expectErr(
      unique.check({
        userId: USER,
        target: module,
        wishes: [wish('expressed', module)],
      }),
      'WISH_ALREADY_EXISTS',
    );
    expect(error.payload).toEqual({
      userId: USER,
      moduleId: MODULE,
      status: 'expressed',
    });
  });

  it('чужое активное желание не мешает', () => {
    expectOk(
      unique.check({
        userId: USER,
        target: course,
        wishes: [wish('expressed', course, OTHER)],
      }),
    );
  });

  it('активное желание на другой курс не мешает', () => {
    const another: WishTargetVo = {
      kind: 'course',
      courseId: '9d8c7b6a-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    };
    expectOk(
      unique.check({
        userId: USER,
        target: course,
        wishes: [wish('expressed', another)],
      }),
    );
  });

  it('активное желание на модуль не мешает желанию на курс и наоборот', () => {
    expectOk(
      unique.check({
        userId: USER,
        target: course,
        wishes: [wish('expressed', module)],
      }),
    );
    expectOk(
      unique.check({
        userId: USER,
        target: module,
        wishes: [wish('expressed', course)],
      }),
    );
  });
});

const { courseEnrollable } = WishRules.rules;

describe('WishRules.courseEnrollable', () => {
  it('курс открыт для записи — ok', () => {
    expectOk(
      courseEnrollable.check({
        courseId: COURSE,
        enrollment: { enrollable: true, startModuleId: MODULE },
      }),
    );
  });

  it('курс недоступен для записи — WISH_COURSE_NOT_FOUND с courseId', () => {
    const error = expectErr(
      courseEnrollable.check({
        courseId: COURSE,
        enrollment: { enrollable: false },
      }),
      'WISH_COURSE_NOT_FOUND',
    );
    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ courseId: COURSE });
  });
});

const { moduleEnrollable } = WishRules.rules;

describe('WishRules.moduleEnrollable', () => {
  it('модуль доступен для записи — ok', () => {
    expectOk(
      moduleEnrollable.check({
        moduleId: MODULE,
        enrollment: { enrollable: true },
      }),
    );
  });

  it('модуль недоступен — WISH_MODULE_NOT_FOUND с moduleId', () => {
    const error = expectErr(
      moduleEnrollable.check({
        moduleId: MODULE,
        enrollment: { enrollable: false },
      }),
      'WISH_MODULE_NOT_FOUND',
    );
    expect(error.kind).toBe('not_found');
    expect(error.payload).toEqual({ moduleId: MODULE });
  });
});

describe('WishRules.cancellable', () => {
  const { cancellable } = WishRules.rules;

  it.each(['expressed', 'confirmed'] as const)('%s — ok', (status) => {
    expectOk(cancellable.check({ wish: wish(status) }));
  });

  it.each(['pending', 'cancelled', 'abandoned', 'fulfilled'] as const)(
    '%s — WISH_NOT_FOUND с целью-курсом',
    (status) => {
      const error = expectErr(
        cancellable.check({ wish: wish(status) }),
        'WISH_NOT_FOUND',
      );
      expect(error.kind).toBe('not_found');
      expect(error.payload).toEqual({ userId: USER, courseId: COURSE });
    },
  );

  it('цель-модуль — payload с moduleId', () => {
    const error = expectErr(
      cancellable.check({ wish: wish('fulfilled', module) }),
      'WISH_NOT_FOUND',
    );
    expect(error.payload).toEqual({ userId: USER, moduleId: MODULE });
  });
});
