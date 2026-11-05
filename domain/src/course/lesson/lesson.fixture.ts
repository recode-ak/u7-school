import { MODULE, T0 } from '../module/module.fixture';
import type { LessonState } from './lesson.state';

/** Общие идентификаторы и состояние урока для тестов домена урока. */
export const LESSON = '33333333-3333-4333-8333-333333333333';
export const STEP_1 = '55555555-5555-4555-8555-555555555555';
export const STEP_2 = '66666666-6666-4666-8666-666666666666';

export { MODULE, T0 };

export const stored = (
  status: LessonState['status'],
  extra: Partial<LessonState> = {},
): LessonState => ({
  uuid: LESSON,
  moduleId: MODULE,
  title: 'Урок 1',
  status,
  stepIds: [STEP_1, STEP_2],
  mentorStepIds: [],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});
