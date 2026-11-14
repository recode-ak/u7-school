import {
  CourseModuleDef,
  GetModuleSnapshotUcDef,
} from '@u7-scl/domain/course/contract';
import { StreamAr, type StreamState } from '@u7-scl/domain/stream';
import { userSubject } from '@u7-scl/domain/user/testing';
import { GuestCaller, ok, SystemCaller, UserCaller } from 'dmg-core';
import { ModuleFacades } from 'dmg-core/app';
import { StubFacade, TEST_TRACE, testAppContext } from 'dmg-core/testing';
import { StudentRepoFake } from '../../student/student.repo.fake';
import { StreamRepoFake } from '../stream.repo.fake';

/** Общие данные тестов UC потока (фейки репозиториев, фасад курсов). */
export const STREAM = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
export const SCHOOL = 'a0000000-0000-4000-8000-000000000001';
export const MENTOR_ID = '66666666-6666-4666-8666-666666666666';
export const OTHER_ID = '77777777-7777-4777-8777-777777777778';
export const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
export const STEP_1 = '33333333-3333-4333-8333-333333333333';
export const STEP_2 = '44444444-4444-4444-8444-444444444444';
export const REQ = TEST_TRACE;
export const T0 = Date.UTC(2026, 5, 1, 10);
export const START = Date.UTC(2026, 5, 1, 12);

export const contentSnapshot = [
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

export const mentor = new UserCaller(
  userSubject({ uuid: MENTOR_ID, roles: ['MENTOR'] }),
);
export const otherMentor = new UserCaller(
  userSubject({
    uuid: OTHER_ID,
    roles: ['MENTOR'],
  }),
);
export const admin = new UserCaller(
  userSubject({ uuid: OTHER_ID, roles: ['ADMIN'] }),
);
export const student = new UserCaller(
  userSubject({
    uuid: OTHER_ID,
    roles: ['GUEST'],
  }),
);
export const guestRole = new UserCaller(
  userSubject({
    uuid: OTHER_ID,
    roles: ['GUEST'],
  }),
);
export const anonymous = new GuestCaller();
export const system = new SystemCaller({
  kind: 'useCase',
  module: 'probe',
  name: 'probe',
});

export const state = (
  status: StreamState['status'],
  extra: Partial<StreamState> = {},
): StreamState => ({
  uuid: STREAM,
  schoolId: SCHOOL,
  title: 'Поток JS-1',
  description: 'Основной поток курса JavaScript',
  mentorId: MENTOR_ID,
  moduleId: MODULE,
  startDate: START,
  status,
  contentSnapshot,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

/** Что последним спросили у репозитория при выборках (ответ задаёт тест). */
export type Answered = { filter?: unknown; telegramGroupId?: string };

/** Стенд UC: часы, шина, фейки, фасад курсов (ответ — `contentSnapshot`). */
export function makeEnv(moduleSnapshot = contentSnapshot) {
  const ctx = testAppContext({ at: T0 });
  const streams = new StreamRepoFake();
  const students = new StudentRepoFake();
  students.findByStream = async () => [];
  const course = new StubFacade(CourseModuleDef).answer(
    GetModuleSnapshotUcDef,
    () => ok(moduleSnapshot),
  );
  const deps = {
    app: ctx.app,
    facades: new ModuleFacades([course]),
    streams,
    students,
    schoolId: SCHOOL,
  };
  const asked: Answered = {};
  /** Выборки репозитория отвечают потоками из `states`. */
  const answerWith = (...states: StreamState[]) => {
    streams.findAll = async (filter?: unknown) => {
      asked.filter = filter;
      return states.map((s) => StreamAr.restore(s));
    };
    streams.findByTelegramGroup = async (id: string) => {
      asked.telegramGroupId = id;
      const found = states.find((s) => s.telegramGroupId === id);
      return found && StreamAr.restore(found);
    };
  };
  return { ctx, streams, students, course, deps, asked, answerWith };
}
