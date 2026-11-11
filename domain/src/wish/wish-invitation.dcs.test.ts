import { describe, expect, it } from 'bun:test';
import { expectOk } from 'dmg-core/testing';
import { WishAr } from './wish/wish.ar';
import { WishEvents } from './wish/wish.events';
import type { WishStatus, WishTargetVo } from './wish/wish.state';
import { WishInvitationDcs } from './wish-invitation.dcs';

const STREAM = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const USER_A = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const USER_B = '6f4e2d3c-8b7a-4f9e-8ad1-b2a3f4e5d6c7';
const MODULE = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const COURSE_A = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const COURSE_B = '8d2e3f4a-5b6c-4d7e-9f8a-0b1c2d3e4f5a';
const OTHER_MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
const T0 = Date.UTC(2026, 7, 26, 10);
const T1 = Date.UTC(2026, 7, 27);

const wish = (status: WishStatus, target: WishTargetVo, userId = USER_A) =>
  WishAr.restore({
    uuid: crypto.randomUUID(),
    userId,
    target,
    status,
    createdAt: T0,
    updatedAt: T0,
    version: 0,
  });
const course = (courseId: string) => ({ kind: 'course' as const, courseId });
const module = (moduleId: string) => ({ kind: 'module' as const, moduleId });
const dcs = (wishes: readonly WishAr[]) =>
  new WishInvitationDcs(STREAM, MODULE, wishes);

describe('WishInvitationDcs.matchQuestion — раунд 1, что спросить у курса', () => {
  it('нет приглашаемых желаний — вопросов нет', () => {
    expect(
      dcs([
        wish('pending', course(COURSE_A)),
        wish('cancelled', module(MODULE)),
        wish('fulfilled', course(COURSE_B)),
      ]).matchQuestion(),
    ).toEqual({});
    expect(dcs([]).matchQuestion()).toEqual({});
  });

  it('course-желания — вопрос о стартовых курсах, module — о том же модуле', () => {
    expect(
      dcs([
        wish('expressed', course(COURSE_A)),
        wish('confirmed', course(COURSE_B)),
      ]).matchQuestion(),
    ).toEqual({
      courses: { moduleId: MODULE, courseIds: [COURSE_A, COURSE_B] },
    });
    expect(
      dcs([wish('expressed', module(OTHER_MODULE))]).matchQuestion(),
    ).toEqual({ modules: { moduleId: MODULE, moduleIds: [OTHER_MODULE] } });
    expect(
      dcs([
        wish('expressed', course(COURSE_A)),
        wish('expressed', module(OTHER_MODULE)),
      ]).matchQuestion(),
    ).toEqual({
      courses: { moduleId: MODULE, courseIds: [COURSE_A] },
      modules: { moduleId: MODULE, moduleIds: [OTHER_MODULE] },
    });
  });
});

describe('WishInvitationDcs.reachQuestion — раунд 2, о потоке и адресах', () => {
  it('ничего не совпало — вопросов нет', () => {
    const wishes = [wish('expressed', course(COURSE_A))];
    expect(dcs(wishes).reachQuestion({})).toEqual({});
    expect(
      dcs(wishes).reachQuestion({
        courses: { courseIds: [COURSE_B] },
        modules: { moduleIds: [] },
      }),
    ).toEqual({});
  });

  it('есть совпавшие — вопрос о потоке и адресах их пользователей без повторов', () => {
    const wishes = [
      wish('expressed', course(COURSE_A), USER_A),
      wish('expressed', module(OTHER_MODULE), USER_A),
      wish('confirmed', course(COURSE_A), USER_B),
      wish('expressed', course(COURSE_B), USER_B),
    ];
    expect(
      dcs(wishes).reachQuestion({
        courses: { courseIds: [COURSE_A] },
        modules: { moduleIds: [OTHER_MODULE] },
      }),
    ).toEqual({
      stream: { streamId: STREAM },
      addresses: { userIds: [USER_A, USER_B] },
    });
  });
});

describe('WishInvitationDcs.invite — пригласить по ответам', () => {
  const match = {
    courses: { courseIds: [COURSE_A] },
    modules: { moduleIds: [OTHER_MODULE] },
  };
  const reach = {
    stream: { exists: true },
    addresses: {
      addresses: [
        { userId: USER_A, telegramId: 42 },
        { userId: USER_B, telegramId: 43 },
      ],
    },
  };

  it('приглашает совпавших: событие с потоком и telegramId адресата', () => {
    const onCourse = wish('expressed', course(COURSE_A), USER_A);
    const onModule = wish('confirmed', module(OTHER_MODULE), USER_B);
    const other = wish('expressed', course(COURSE_B), USER_A);
    const res = expectOk(
      dcs([onCourse, onModule, other]).invite(match, reach, T1),
    );
    expect(res.invited).toEqual([onCourse, onModule]);
    expect(res.unreachable).toEqual([]);
    expect(onCourse.pullEvents()).toEqual([
      WishEvents.invited.make({
        userId: USER_A,
        telegramId: 42,
        streamId: STREAM,
        targetKind: 'course',
        courseId: COURSE_A,
      }),
    ]);
    expect(onModule.pullEvents()).toEqual([
      WishEvents.invited.make({
        userId: USER_B,
        telegramId: 43,
        streamId: STREAM,
        targetKind: 'module',
        moduleId: OTHER_MODULE,
      }),
    ]);
    expect(other.pullEvents()).toEqual([]);
  });

  it('нет адреса — недостижимый userId (без повторов), остальные приглашены', () => {
    const lost1 = wish('expressed', course(COURSE_A), USER_B);
    const lost2 = wish('expressed', module(OTHER_MODULE), USER_B);
    const ok1 = wish('expressed', course(COURSE_A), USER_A);
    const res = expectOk(
      dcs([lost1, lost2, ok1]).invite(
        match,
        {
          stream: { exists: true },
          addresses: { addresses: [{ userId: USER_A, telegramId: 42 }] },
        },
        T1,
      ),
    );
    expect(res.invited).toEqual([ok1]);
    expect(res.unreachable).toEqual([USER_B]);
    expect(lost1.pullEvents()).toEqual([]);
  });

  it('потока нет — никого не зовём и ничего не предупреждаем', () => {
    const w = wish('expressed', course(COURSE_A));
    const res = expectOk(
      dcs([w]).invite(match, { ...reach, stream: { exists: false } }, T1),
    );
    expect(res).toEqual({ invited: [], unreachable: [] });
    expect(w.pullEvents()).toEqual([]);
  });
});
