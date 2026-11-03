import type { StreamState } from './stream.state';

/** Общие идентификаторы и состояние потока для тестов домена потока. */
export const STREAM = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
export const SCHOOL = 'a0000000-0000-4000-8000-000000000001';
export const MENTOR = '66666666-6666-4666-8666-666666666666';
export const OTHER_MENTOR = '77777777-7777-4777-8777-777777777778';
export const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
export const STEP_1 = '33333333-3333-4333-8333-333333333333';
export const STEP_2 = '44444444-4444-4444-8444-444444444444';

export const T0 = Date.UTC(2026, 5, 1, 10);
export const T1 = Date.UTC(2026, 5, 2);
export const START = Date.UTC(2026, 5, 1, 12);

export const snapshot = [
  {
    projectId: '11111111-1111-4111-8111-111111111111',
    projectTitle: 'Введение',
    lessons: [
      {
        lessonId: '22222222-2222-4222-8222-222222222222',
        lessonTitle: 'Урок 1',
        stepIds: [STEP_1, STEP_2],
      },
    ],
  },
];

export const stored = (
  status: StreamState['status'],
  extra: Partial<StreamState> = {},
): StreamState => ({
  uuid: STREAM,
  schoolId: SCHOOL,
  title: 'Поток JS-1',
  description: 'Основной поток курса JavaScript',
  mentorId: MENTOR,
  moduleId: MODULE,
  startDate: START,
  status,
  contentSnapshot: snapshot,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});
