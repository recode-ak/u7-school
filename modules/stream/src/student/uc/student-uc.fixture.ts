import {
  CourseModuleDef,
  GetModulePrerequisiteUcDef,
  GetModuleSnapshotUcDef,
  type ModulePrerequisite,
} from '@u7-scl/domain/course/contract';
import type {
  StreamState,
  StudentAr,
  StudentState,
} from '@u7-scl/domain/stream';
import { Role } from '@u7-scl/domain/user/contract';
import { ok, type Result, UserCaller } from 'dmg-core';
import { ModuleFacades } from 'dmg-core/app';
import { StubFacade, testAppContext } from 'dmg-core/testing';
import { StreamRepoFake } from '../../stream/stream.repo.fake';
import {
  contentSnapshot,
  OTHER_ID,
  SCHOOL,
  STEP_1,
  STREAM,
  state as streamState,
  T0,
} from '../../stream/uc/stream-uc.fixture';
import { StudentRepoFake } from '../student.repo.fake';

export {
  admin,
  anonymous,
  contentSnapshot,
  guestRole,
  MENTOR_ID,
  MODULE,
  mentor,
  OTHER_ID,
  otherMentor,
  REQ,
  SCHOOL,
  STEP_1,
  STEP_2,
  STREAM,
  T0,
} from '../../stream/uc/stream-uc.fixture';

/** Общие данные тестов UC студента (фейки репозиториев, фасад курсов). */
export const STUDENT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
export const OTHER_STREAM = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const PREV_MODULE = '12345678-1234-4234-8234-123456789012';
export const DAY = 24 * 60 * 60 * 1000;

/** Владелец записи студента и посторонний пользователь. */
export const owner = new UserCaller({ uuid: USER, roles: [Role.STUDENT] });
export const stranger = new UserCaller({
  uuid: OTHER_ID,
  roles: [Role.STUDENT],
});

/** Вердикт курса (D-65) — ответ заглушки `getModulePrerequisite`. */
type Prerequisite = Result<ModulePrerequisite, never>;

export const studentState = (
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

export const issued = (stepId: string, at = T0) => ({
  stepId,
  status: 'issued' as const,
  issuedAt: at,
});
export const done = (stepId: string, issuedAt = T0, at = T0) => ({
  stepId,
  status: 'completed' as const,
  issuedAt,
  completedAt: at,
});
export const withStep = (extra: Partial<StudentState> = {}) =>
  studentState('active', { steps: [issued(STEP_1)], ...extra });

/**
 * Стенд UC студента: часы на `T0`, фейки репозиториев потоков и студентов,
 * фасад `course` (снимок — по умолчанию). Заглушка допуска отвечает по входу,
 * как курс: `passedModuleIds` содержит `PREV_MODULE` — `admitted`, иначе —
 * вердикт `env.prerequisite` (по умолчанию `admitted`). Так сбор
 * `passedModuleIds` из записей студента проверяется, а не подменяется полем.
 * Выборки студентов отвечают по текущей базе фейка.
 */
export function makeEnv(at = T0) {
  const ctx = testAppContext({ at });
  const streams = new StreamRepoFake();
  const students = new StudentRepoFake();
  const stand = {
    prerequisite: ok({ admitted: true }) as Prerequisite,
  };
  const course = new StubFacade(CourseModuleDef)
    .answer(GetModulePrerequisiteUcDef, ({ passedModuleIds }) =>
      passedModuleIds.includes(PREV_MODULE)
        ? (ok({ admitted: true }) as Prerequisite)
        : stand.prerequisite,
    )
    .answer(GetModuleSnapshotUcDef, () => ok(contentSnapshot));
  const deps = {
    app: ctx.app,
    facades: new ModuleFacades([course]),
    streams,
    students,
    schoolId: SCHOOL,
  };

  const known = new Set<string>();
  const rows = (): StudentAr[] => {
    for (const saved of students.saved) known.add(saved.uuid);
    return [...known]
      .map((id) => students.restored(id))
      .filter((s): s is StudentAr => s !== undefined);
  };

  /** Кладёт студентов в базу фейка и подключает выборки к ней. */
  const seedStudents = (...states: StudentState[]) => {
    students.seed(...states);
    for (const s of states) known.add(s.uuid);
    students.findByStream = async (id: string) =>
      rows().filter((s) => s.belongsToStream(id));
    students.findByUser = async (id: string) =>
      rows().filter((s) => s.isOwnedBy(id));
    students.findStudying = async () => rows().filter((s) => s.isInProgress());
  };
  const seedStreams = (...states: StreamState[]) => streams.seed(...states);
  return Object.assign(stand, {
    ctx,
    streams,
    students,
    course,
    deps,
    seedStudents,
    seedStreams,
    rows,
  });
}

export const streamOf = (
  status: StreamState['status'],
  extra: Partial<StreamState> = {},
) => streamState(status, extra);

/** Состояние потока другого модуля курса (для проверки допуска). */
export const prevStream = () =>
  streamState('completed', { uuid: OTHER_STREAM, moduleId: PREV_MODULE });
