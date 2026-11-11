import { describe, expect, it } from 'bun:test';
import { expectOk } from 'dmg-core/testing';
import { WishAr } from './wish/wish.ar';
import type { WishStatus, WishTargetVo } from './wish/wish.state';
import { WishFulfillmentDcs } from './wish-fulfillment.dcs';

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const MODULE = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const COURSE_A = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const COURSE_B = '8d2e3f4a-5b6c-4d7e-9f8a-0b1c2d3e4f5a';
const COURSE_C = '9e3f4a5b-6c7d-4e8f-8a9b-1c2d3e4f5a6b';
const OTHER_MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const THIRD_MODULE = '4a3f2e1d-0c9b-4876-9543-210fedcba987';
const T0 = Date.UTC(2026, 7, 26, 10);
const T1 = Date.UTC(2026, 7, 27);

const wish = (status: WishStatus, target: WishTargetVo) =>
  WishAr.restore({
    uuid: crypto.randomUUID(),
    userId: USER,
    target,
    status,
    createdAt: T0,
    updatedAt: T0,
    version: 0,
  });
const course = (courseId: string) => ({ kind: 'course' as const, courseId });
const module = (moduleId: string) => ({ kind: 'module' as const, moduleId });

describe('WishFulfillmentDcs.question — что спросить у курса', () => {
  it('нет реализуемых желаний — вопросов нет', () => {
    const dcs = new WishFulfillmentDcs(MODULE, [
      wish('pending', course(COURSE_A)),
      wish('cancelled', module(MODULE)),
      wish('fulfilled', course(COURSE_B)),
    ]);
    expect(dcs.question()).toEqual({});
    expect(new WishFulfillmentDcs(MODULE, []).question()).toEqual({});
  });

  it('курсы реализуемых желаний — одним батчем с модулем потока', () => {
    const dcs = new WishFulfillmentDcs(MODULE, [
      wish('expressed', course(COURSE_A)),
      wish('confirmed', course(COURSE_B)),
      wish('pending', course(COURSE_C)),
    ]);
    expect(dcs.question()).toEqual({
      courses: { moduleId: MODULE, courseIds: [COURSE_A, COURSE_B] },
    });
  });

  it('модули реализуемых желаний — одним батчем с модулем потока', () => {
    const dcs = new WishFulfillmentDcs(MODULE, [
      wish('expressed', module(MODULE)),
      wish('confirmed', module(OTHER_MODULE)),
      wish('cancelled', module(THIRD_MODULE)),
    ]);
    expect(dcs.question()).toEqual({
      modules: { moduleId: MODULE, moduleIds: [MODULE, OTHER_MODULE] },
    });
  });

  it('курсы и модули — два вопроса', () => {
    const dcs = new WishFulfillmentDcs(MODULE, [
      wish('expressed', course(COURSE_A)),
      wish('expressed', module(OTHER_MODULE)),
    ]);
    expect(dcs.question()).toEqual({
      courses: { moduleId: MODULE, courseIds: [COURSE_A] },
      modules: { moduleId: MODULE, moduleIds: [OTHER_MODULE] },
    });
  });
});

describe('WishFulfillmentDcs.fulfill — реализовать по ответу курса', () => {
  it('реализует желания, цели которых курс признал, и возвращает их', () => {
    const onCourse = wish('expressed', course(COURSE_A));
    const otherCourse = wish('confirmed', course(COURSE_B));
    const onModule = wish('confirmed', module(OTHER_MODULE));
    const dcs = new WishFulfillmentDcs(MODULE, [
      onCourse,
      otherCourse,
      onModule,
    ]);

    const fulfilled = expectOk(
      dcs.fulfill(
        {
          courses: { courseIds: [COURSE_A] },
          modules: { moduleIds: [OTHER_MODULE] },
        },
        T1,
      ),
    );

    expect(fulfilled).toEqual([onCourse, onModule]);
    expect(onCourse.view()).toMatchObject({
      status: 'fulfilled',
      updatedAt: T1,
    });
    expect(onModule.view().status).toBe('fulfilled');
    expect(otherCourse.view().status).toBe('confirmed');
  });

  it('без ответа (вопроса не было) — ничего не реализует', () => {
    const onCourse = wish('expressed', course(COURSE_A));
    const dcs = new WishFulfillmentDcs(MODULE, [onCourse]);
    expect(expectOk(dcs.fulfill({}, T1))).toEqual([]);
    expect(onCourse.view().status).toBe('expressed');
  });

  it('нереализуемые не меняются, даже если цель в ответе (идемпотентность)', () => {
    const done = wish('fulfilled', course(COURSE_A));
    const pending = wish('pending', course(COURSE_A));
    const dcs = new WishFulfillmentDcs(MODULE, [done, pending]);

    const fulfilled = expectOk(
      dcs.fulfill({ courses: { courseIds: [COURSE_A] } }, T1),
    );

    expect(fulfilled).toEqual([]);
    expect(done.view()).toMatchObject({ status: 'fulfilled', updatedAt: T0 });
    expect(pending.view().status).toBe('pending');
  });
});
