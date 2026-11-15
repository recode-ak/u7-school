import { describe, expect, it } from 'bun:test';
import { WishAr } from './wish/wish.ar';
import {
  stored,
  T0,
  T1,
  COURSE_TARGET as target,
  USER,
} from './wish/wish.fixture';
import type { WishState, WishStatus, WishTargetVo } from './wish/wish.state';
import { WishSelectionDqs } from './wish-selection.dqs';

describe('WishSelectionDqs.current — активное желание пользователя на цель', () => {
  const OTHER_USER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
  const OTHER_TARGET: WishTargetVo = {
    kind: 'course',
    courseId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  };
  const wish = (status: WishStatus, over: Partial<WishState> = {}): WishAr =>
    WishAr.restore({ ...stored(status), uuid: crypto.randomUUID(), ...over });
  const current = (wishes: WishAr[]) =>
    new WishSelectionDqs(wishes).current(USER, target);

  it('нет желаний — нет текущего', () => {
    expect(current([])).toBeUndefined();
  });

  it('находит активное, даже если оно не первое (завершённые раньше)', () => {
    const active = wish('pending');
    expect(
      current([
        wish('abandoned'),
        wish('cancelled'),
        active,
        wish('fulfilled'),
      ]),
    ).toBe(active);
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
    expect(current(list())).toBeUndefined();
  });

  it('работает на ReadonlyAr — клиент решает тем же вопросом', () => {
    const active = WishAr.readonly({
      ...stored('confirmed'),
      uuid: crypto.randomUUID(),
    });
    const cancelled = WishAr.readonly({
      ...stored('cancelled'),
      uuid: crypto.randomUUID(),
    });
    expect(
      new WishSelectionDqs([cancelled, active]).current(USER, target),
    ).toBe(active);
  });
});

// Выбор «текущего» — решение домена, а не хранилища: среди активных —
// последнее созданное, иначе последнее созданное из всех.
describe('WishSelectionDqs.latest — последнее желание, активные в приоритете', () => {
  const wish = (status: WishStatus, createdAt: number): WishAr =>
    WishAr.restore({ ...stored(status), uuid: crypto.randomUUID(), createdAt });
  const latest = (wishes: WishAr[]) => new WishSelectionDqs(wishes).latest();

  it('нет желаний — нет текущего', () => {
    expect(latest([])).toBeUndefined();
  });

  it('активных нет — последнее созданное из всех', () => {
    const older = wish('cancelled', T0);
    const newer = wish('abandoned', T1);
    expect(latest([newer, older])).toBe(newer);
  });

  it('активное предпочитается более позднему неактивному', () => {
    const active = wish('confirmed', T0);
    const cancelled = wish('cancelled', T1);
    expect(latest([cancelled, active])).toBe(active);
  });

  it('несколько активных — последнее созданное', () => {
    const first = wish('expressed', T0);
    const middle = wish('pending', T1);
    const last = wish('confirmed', T1 + 1);
    expect(latest([middle, last, first])).toBe(last);
  });
});
