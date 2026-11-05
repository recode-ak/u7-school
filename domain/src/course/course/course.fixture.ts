import type { CourseState, PhaseVo } from './course.state';

/** Общие идентификаторы и состояние курса для тестов домена курса. */
export const COURSE = '29adc3be-873e-47ec-aa30-61f5e6e25d4e';
export const AUTHOR = '660e8400-e29b-41d4-a716-446655440004';
export const M1 = '11111111-1111-4111-8111-111111111111';
export const M2 = '22222222-2222-4222-8222-222222222222';
export const M3 = '33333333-3333-4333-8333-333333333333';
export const M4 = '44444444-4444-4444-8444-444444444444';
/** Модуль вне всех программ тестов. */
export const OUTSIDE = '99999999-9999-4999-8999-999999999999';

export const T0 = Date.UTC(2026, 6, 8, 18, 35);

/** Метка этапа: заголовок, модуль начала и (необязательно) трек. */
export const phase = (
  title: string,
  fromModuleId: string,
  track?: string,
): PhaseVo =>
  track === undefined
    ? { title, fromModuleId }
    : { title, fromModuleId, track };

/**
 * Состояние курса в хранилище: программа из четырёх модулей и один этап
 * «Основы JS» с первого модуля — как у боевого курса (один этап на всё).
 */
export const stored = (
  status: CourseState['status'],
  extra: Partial<CourseState> = {},
): CourseState => ({
  uuid: COURSE,
  title: 'Fullstack JS',
  description: 'Полный курс по JavaScript',
  authorId: AUTHOR,
  moduleIds: [M1, M2, M3, M4],
  phases: [phase('Основы JS', M1, 'tech')],
  status,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});
