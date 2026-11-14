import type { WishState, WishStatus, WishTargetVo } from './wish.state';

/** Общие идентификаторы и состояние желания для тестов домена желаний. */
export const WISH = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
export const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
export const COURSE_TARGET = {
  kind: 'course' as const,
  courseId: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
} satisfies WishTargetVo;

export const T0 = Date.UTC(2026, 7, 26, 10);
export const T1 = Date.UTC(2026, 7, 27);

export const stored = (
  status: WishStatus,
  extra: Partial<WishState> = {},
): WishState => ({
  uuid: WISH,
  userId: USER,
  target: COURSE_TARGET,
  status,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});
