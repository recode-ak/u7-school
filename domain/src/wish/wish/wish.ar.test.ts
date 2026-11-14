import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import coursePools from './pools/course.json';
import { findCoursePool } from './pools/course-pool';
import { WishAr, WishArDef } from './wish.ar';
import { WishEvents } from './wish.events';
import {
  stored,
  T0,
  T1,
  COURSE_TARGET as target,
  USER,
  WISH,
} from './wish.fixture';
import type { WishState, WishStatus, WishTargetVo } from './wish.state';

const restore = (status: WishStatus) => WishAr.restore(stored(status));

describe('WishAr.create', () => {
  it.each(['expressed', 'pending'] as const)(
    'новое желание в статусе %s, без событий',
    (status) => {
      const ar = expectOk(
        WishAr.create({ uuid: WISH, userId: USER, target, status }, T1),
      );
      expect(ar.snapshot()).toEqual({
        ...stored(status),
        createdAt: T1,
        updatedAt: T1,
      });
      expect(ar.pullEvents()).toEqual([]);
    },
  );
});

const POOLED = Object.keys(coursePools)[0] as string;

describe('WishAr.createForCourse', () => {
  it('у курса есть пул — pending, outcome questionnaire, анкета: пул и { courseId }', () => {
    const wish = expectOk(
      WishAr.createForCourse(
        { uuid: WISH, userId: USER, courseId: POOLED },
        T1,
      ),
    );
    expect(wish.snapshot()).toEqual({
      ...stored('pending'),
      target: { kind: 'course', courseId: POOLED },
      createdAt: T1,
      updatedAt: T1,
    });
    expect(wish.outcome()).toBe('questionnaire');
    expect(wish.questionnaire()?.pool).toBeDefined();
    expect(wish.questionnaire()?.pool).toBe(findCoursePool(POOLED));
    expect(wish.questionnaire()?.owner).toEqual({ courseId: POOLED });
    expect(wish.pullEvents()).toEqual([]);
  });

  it('у курса нет пула — expressed, outcome instant, анкеты нет', () => {
    const wish = expectOk(
      WishAr.createForCourse(
        { uuid: WISH, userId: USER, courseId: target.courseId },
        T1,
      ),
    );
    expect(wish.snapshot()).toEqual({
      ...stored('expressed'),
      createdAt: T1,
      updatedAt: T1,
    });
    expect(wish.outcome()).toBe('instant');
    expect(wish.questionnaire()).toBeUndefined();
    expect(wish.pullEvents()).toEqual([]);
  });
});

describe('WishAr.createForModule', () => {
  const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';

  it('всегда expressed (без анкеты), цель — модуль, событий нет', () => {
    const wish = expectOk(
      WishAr.createForModule(
        { uuid: WISH, userId: USER, moduleId: MODULE },
        T1,
      ),
    );
    expect(wish.snapshot()).toEqual({
      ...stored('expressed'),
      target: { kind: 'module', moduleId: MODULE },
      createdAt: T1,
      updatedAt: T1,
    });
    expect(wish.outcome()).toBe('instant');
    expect(wish.questionnaire()).toBeUndefined();
    expect(wish.pullEvents()).toEqual([]);
  });
});

describe('WishAr.questionnaire / outcome — вопросы из state', () => {
  it('после restore pending-желание курса с пулом снова даёт анкету', () => {
    const wish = expectOk(
      WishAr.createForCourse(
        { uuid: WISH, userId: USER, courseId: POOLED },
        T1,
      ),
    );
    const restored = WishAr.restore(wish.snapshot());
    expect(restored.questionnaire()?.owner).toEqual({ courseId: POOLED });
    expect(restored.outcome()).toBe('questionnaire');
  });

  it('не pending — анкеты нет, outcome instant', () => {
    const confirmed = WishAr.restore({
      ...stored('confirmed'),
      target: { kind: 'course', courseId: POOLED },
    });
    expect(confirmed.questionnaire()).toBeUndefined();
    expect(confirmed.outcome()).toBe('instant');
  });

  it('pending module-желания — анкеты нет', () => {
    const wish = expectOk(
      WishAr.create(
        {
          uuid: WISH,
          userId: USER,
          target: { kind: 'module', moduleId: crypto.randomUUID() },
          status: 'pending',
        },
        T1,
      ),
    );
    expect(wish.questionnaire()).toBeUndefined();
    expect(wish.outcome()).toBe('instant');
  });
});

/**
 * Успешный переход: статус `to`, `updatedAt` = `at`, версия +1,
 * накоплены события `events`.
 */
function expectMoved(
  ar: WishAr,
  to: WishStatus,
  events: ReturnType<WishAr['pullEvents']> = [],
): void {
  expect(ar.snapshot()).toEqual({
    ...stored(to),
    updatedAt: T1,
    version: 1,
  });
  expect(ar.pullEvents()).toEqual(events);
}

describe('WishAr.confirm', () => {
  it('pending → confirmed, событие confirmed', () => {
    const ar = restore('pending');
    expectOk(ar.confirm(T1));
    expectMoved(ar, 'confirmed', [
      WishEvents.confirmed.make({ userId: USER, courseId: target.courseId }),
    ]);
  });

  it('module-желание в pending — WISH_NOT_CONFIRMABLE, без событий', () => {
    const module: WishTargetVo = { kind: 'module', moduleId: target.courseId };
    const pending = { ...stored('pending'), target: module };
    const ar = WishAr.restore(pending);
    expect(ar.canConfirm()).toBe(false);
    expectErr(ar.confirm(T1), 'WISH_NOT_CONFIRMABLE');
    expect(ar.snapshot()).toEqual(pending);
    expect(ar.pullEvents()).toEqual([]);
  });

  it.each([
    'expressed',
    'confirmed',
    'cancelled',
    'abandoned',
    'fulfilled',
  ] as const)('из %s — WISH_NOT_CONFIRMABLE', (status) => {
    const ar = restore(status);
    expectErr(ar.confirm(T1), 'WISH_NOT_CONFIRMABLE');
    expect(ar.snapshot()).toEqual(stored(status));
    expect(ar.pullEvents()).toEqual([]);
  });
});

describe('WishAr.abandon', () => {
  it('pending → abandoned', () => {
    const ar = restore('pending');
    expectOk(ar.abandon(T1));
    expectMoved(ar, 'abandoned');
  });

  it.each([
    'expressed',
    'confirmed',
    'cancelled',
    'abandoned',
    'fulfilled',
  ] as const)('из %s — WISH_NOT_ABANDONABLE', (status) => {
    expectErr(restore(status).abandon(T1), 'WISH_NOT_ABANDONABLE');
  });
});

describe('WishAr.cancel', () => {
  it.each(['expressed', 'confirmed'] as const)('%s → cancelled', (status) => {
    const ar = restore(status);
    expectOk(ar.cancel(T1));
    expectMoved(ar, 'cancelled');
  });

  it.each(['pending', 'cancelled', 'abandoned', 'fulfilled'] as const)(
    'из %s — WISH_NOT_CANCELLABLE',
    (status) => {
      expectErr(restore(status).cancel(T1), 'WISH_NOT_CANCELLABLE');
    },
  );
});

describe('WishAr.fulfill', () => {
  it.each(['expressed', 'confirmed'] as const)('%s → fulfilled', (status) => {
    const ar = restore(status);
    expectOk(ar.fulfill(T1));
    expectMoved(ar, 'fulfilled');
  });

  it.each(['pending', 'cancelled', 'abandoned', 'fulfilled'] as const)(
    'из %s — WISH_NOT_FULFILLABLE',
    (status) => {
      expectErr(restore(status).fulfill(T1), 'WISH_NOT_FULFILLABLE');
    },
  );
});

describe('WishAr.invite — приглашение на поток', () => {
  const STREAM = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  const moduleId = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
  const to = { streamId: STREAM, telegramId: 42 };
  const forModule = (status: WishStatus) =>
    WishAr.restore({ ...stored(status), target: { kind: 'module', moduleId } });

  it.each(['expressed', 'confirmed'] as const)(
    '%s на курс: событие invited с целью-курсом, статус не меняется',
    (status) => {
      const ar = restore(status);
      expectOk(ar.invite(T1, to));
      expect(ar.snapshot()).toEqual({
        ...stored(status),
        invitedStreamIds: [STREAM],
        updatedAt: T1,
        version: 1,
      });
      expect(ar.pullEvents()).toEqual([
        WishEvents.invited.make({
          userId: USER,
          telegramId: 42,
          streamId: STREAM,
          targetKind: 'course',
          courseId: target.courseId,
        }),
      ]);
    },
  );

  it('на модуль: событие invited с целью-модулем', () => {
    const ar = forModule('expressed');
    expectOk(ar.invite(T1, to));
    expect(ar.pullEvents()).toEqual([
      WishEvents.invited.make({
        userId: USER,
        telegramId: 42,
        streamId: STREAM,
        targetKind: 'module',
        moduleId,
      }),
    ]);
  });

  it.each(['pending', 'cancelled', 'abandoned', 'fulfilled'] as const)(
    'из %s — WISH_NOT_INVITABLE, без событий и изменений',
    (status) => {
      const ar = restore(status);
      expectErr(ar.invite(T1, to), 'WISH_NOT_INVITABLE');
      expect(ar.snapshot()).toEqual(stored(status));
      expect(ar.pullEvents()).toEqual([]);
    },
  );
});

describe('WishAr.invitationTargets / isInvitedBy — приглашение на поток', () => {
  const moduleId = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
  const forModule = (status: WishStatus) =>
    WishAr.restore({ ...stored(status), target: { kind: 'module', moduleId } });
  const none = { courseIds: [], moduleIds: [] };
  const matched = { courseIds: [target.courseId], moduleIds: [moduleId] };

  it.each(['expressed', 'confirmed'] as const)(
    'приглашаемое (%s) спрашивает о своей цели: курс или модуль',
    (status) => {
      expect(restore(status).invitationTargets()).toEqual({
        courseIds: [target.courseId],
        moduleIds: [],
      });
      expect(forModule(status).invitationTargets()).toEqual({
        courseIds: [],
        moduleIds: [moduleId],
      });
    },
  );

  it.each(['pending', 'cancelled', 'abandoned', 'fulfilled'] as const)(
    'неприглашаемое (%s) ни о чём не спрашивает и не приглашается',
    (status) => {
      expect(restore(status).invitationTargets()).toEqual(none);
      expect(forModule(status).invitationTargets()).toEqual(none);
      expect(restore(status).isInvitedBy(matched)).toBe(false);
      expect(forModule(status).isInvitedBy(matched)).toBe(false);
    },
  );

  it('приглашается, если цель среди совпавших; вид цели важен', () => {
    expect(restore('expressed').isInvitedBy(matched)).toBe(true);
    expect(forModule('confirmed').isInvitedBy(matched)).toBe(true);
    expect(restore('expressed').isInvitedBy(none)).toBe(false);
    const swapped = { courseIds: [moduleId], moduleIds: [target.courseId] };
    expect(restore('expressed').isInvitedBy(swapped)).toBe(false);
    expect(forModule('expressed').isInvitedBy(swapped)).toBe(false);
  });
});

describe('предикаты переходов — совпадают с from в Def', () => {
  const statuses = Object.keys(WishArDef.statuses) as WishStatus[];
  const cases = [
    ['canConfirm', ['pending']],
    ['canAbandon', ['pending']],
    ['canCancel', ['expressed', 'confirmed']],
    ['canFulfill', ['expressed', 'confirmed']],
    ['canInvite', ['expressed', 'confirmed']],
  ] as const;

  it.each(cases)('%s — только %p', (predicate, allowed) => {
    for (const status of statuses) {
      expect(restore(status)[predicate]()).toBe(
        (allowed as readonly WishStatus[]).includes(status),
      );
    }
  });
});

describe('вопросы к желанию', () => {
  it('статус не читается снаружи — только вопросы и alreadyExists (D-39)', () => {
    expect('status' in restore('expressed')).toBe(false);
  });
});

describe('WishAr.fulfillmentTargets / isFulfilledBy — реализация зачислением', () => {
  const moduleId = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
  const forModule = (status: WishStatus) =>
    WishAr.restore({ ...stored(status), target: { kind: 'module', moduleId } });
  const none = { courseIds: [], moduleIds: [] };
  const enrolled = { courseIds: [target.courseId], moduleIds: [moduleId] };

  it.each(['expressed', 'confirmed'] as const)(
    'реализуемое (%s) спрашивает о своей цели: курс или модуль',
    (status) => {
      expect(restore(status).fulfillmentTargets()).toEqual({
        courseIds: [target.courseId],
        moduleIds: [],
      });
      expect(forModule(status).fulfillmentTargets()).toEqual({
        courseIds: [],
        moduleIds: [moduleId],
      });
    },
  );

  it.each(['pending', 'cancelled', 'abandoned', 'fulfilled'] as const)(
    'нереализуемое (%s) ни о чём не спрашивает',
    (status) => {
      expect(restore(status).fulfillmentTargets()).toEqual(none);
      expect(forModule(status).fulfillmentTargets()).toEqual(none);
    },
  );

  it.each(['expressed', 'confirmed'] as const)(
    'реализуемое (%s) — реализовано, если его цель среди целей зачисления',
    (status) => {
      expect(restore(status).isFulfilledBy(enrolled)).toBe(true);
      expect(forModule(status).isFulfilledBy(enrolled)).toBe(true);
    },
  );

  it('цели нет среди целей зачисления — не реализовано', () => {
    expect(restore('expressed').isFulfilledBy(none)).toBe(false);
    expect(forModule('expressed').isFulfilledBy(none)).toBe(false);
  });

  it('вид цели важен: id курса среди модулей не реализует желание на курс', () => {
    const swapped = { courseIds: [moduleId], moduleIds: [target.courseId] };
    expect(restore('expressed').isFulfilledBy(swapped)).toBe(false);
    expect(forModule('expressed').isFulfilledBy(swapped)).toBe(false);
  });

  it.each(['pending', 'cancelled', 'abandoned', 'fulfilled'] as const)(
    'нереализуемое (%s) — не реализовано даже при совпадении цели (идемпотентность)',
    (status) => {
      expect(restore(status).isFulfilledBy(enrolled)).toBe(false);
      expect(forModule(status).isFulfilledBy(enrolled)).toBe(false);
    },
  );
});

describe('WishAr.questionnaireTarget — разбор owner анкеты', () => {
  it.each([
    ['пустой объект', {}],
    ['не строка', { courseId: 42 }],
    ['пустая строка', { courseId: '' }],
    ['чужой формат', { lessonId: 'x' }],
    ['null', null],
    ['строка', 'x'],
    ['undefined', undefined],
  ])('чужой или битый owner (%s) — не наша анкета', (_, owner) => {
    expect(WishAr.questionnaireTarget(owner)).toBeUndefined();
  });
});

describe('WishAr.current — активное желание пользователя на цель', () => {
  const OTHER_USER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  const OTHER_TARGET: WishTargetVo = {
    kind: 'course',
    courseId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  };
  const wish = (status: WishStatus, over: Partial<WishState> = {}): WishAr =>
    WishAr.restore({ ...stored(status), uuid: crypto.randomUUID(), ...over });

  it('нет желаний — нет текущего', () => {
    expect(WishAr.current([], USER, target)).toBeUndefined();
  });

  it('находит активное, даже если оно не первое (завершённые раньше)', () => {
    const active = wish('pending');
    const found = WishAr.current(
      [wish('abandoned'), wish('cancelled'), active, wish('fulfilled')],
      USER,
      target,
    );
    expect(found).toBe(active);
  });

  // `current` не доверяет выборке вызывающего: фильтрует сам.
  it.each([
    [
      'только завершённые',
      () => [wish('abandoned'), wish('cancelled'), wish('fulfilled')],
    ],
    [
      'чужой пользователь и чужая цель',
      () => [
        wish('pending', { userId: OTHER_USER }),
        wish('pending', { target: OTHER_TARGET }),
      ],
    ],
  ])('%s — нет текущего', (_, list) => {
    expect(WishAr.current(list(), USER, target)).toBeUndefined();
  });
});

// Выбор «текущего» — решение домена, а не хранилища: среди активных —
// последнее созданное, иначе последнее созданное из всех.
describe('WishAr.latest — последнее желание, активные в приоритете', () => {
  const wish = (status: WishStatus, createdAt: number): WishAr =>
    WishAr.restore({ ...stored(status), uuid: crypto.randomUUID(), createdAt });

  it('нет желаний — нет текущего', () => {
    expect(WishAr.latest([])).toBeUndefined();
  });

  it('активных нет — последнее созданное из всех', () => {
    const older = wish('cancelled', T0);
    const newer = wish('abandoned', T1);
    expect(WishAr.latest([newer, older])).toBe(newer);
  });

  it('активное предпочитается более позднему неактивному', () => {
    const active = wish('confirmed', T0);
    const cancelled = wish('cancelled', T1);
    expect(WishAr.latest([cancelled, active])).toBe(active);
  });

  it('несколько активных — последнее созданное', () => {
    const first = wish('expressed', T0);
    const middle = wish('pending', T1);
    const last = wish('confirmed', T1 + 1);
    expect(WishAr.latest([middle, last, first])).toBe(last);
  });
});
