import { MODULE, STEP_1, STREAM } from '../stream/stream.fixture';
import type { StudentState } from './student.state';

/** Общие идентификаторы и состояния студента для тестов домена. */
export {
  MENTOR,
  MODULE,
  OTHER_MENTOR,
  STEP_1,
  STEP_2,
  STREAM,
} from '../stream/stream.fixture';

export const STUDENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
export const OTHER_USER = '99999999-9999-4999-8999-999999999999';
export const STEP_3 = '55555555-5555-4555-8555-555555555555';

export const DAY = 24 * 60 * 60 * 1000;
export const T0 = Date.UTC(2026, 5, 1, 10);
export const T1 = T0 + 60_000;

export const input = {
  uuid: STUDENT,
  streamId: STREAM,
  userId: USER,
  moduleId: MODULE,
  firstStepId: STEP_1,
};

export const issued = (stepId: string, at: number) => ({
  stepId,
  status: 'issued' as const,
  issuedAt: at,
});

export const completed = (stepId: string, issuedAt: number, at: number) => ({
  stepId,
  status: 'completed' as const,
  issuedAt,
  completedAt: at,
});

/** Состояние студента в хранилище; `enrolledAt` и `createdAt` — `T0`. */
export const stored = (
  status: StudentState['status'],
  extra: Partial<StudentState> = {},
): StudentState => ({
  uuid: STUDENT,
  streamId: STREAM,
  userId: USER,
  enrolledAt: T0,
  status,
  currentStepId: STEP_1,
  steps: [],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});
