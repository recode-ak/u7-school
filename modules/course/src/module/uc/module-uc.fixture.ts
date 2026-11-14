import { ModuleAr, type ModuleState } from '@u7-scl/domain/course';
import { userSubject } from '@u7-scl/domain/user/testing';
import { GuestCaller, SystemCaller, UserCaller } from 'dmg-core';
import { ModuleFacades } from 'dmg-core/app';
import { TEST_TRACE, testAppContext } from 'dmg-core/testing';
import { CourseRepoFake } from '../../course/course.repo.fake';
import type { CourseModuleDeps, CourseUser } from '../../course.module';
import { LessonRepoFake } from '../../lesson/lesson.repo.fake';
import { StepRepoFake } from '../../step/step.repo.fake';
import { ModuleRepoFake } from '../module.repo.fake';

/** Общие данные тестов UC модуля курса (фейк репозитория, вызывающие). */
export const MODULE = '3f2e1d0c-9b8a-4765-8432-10fedcba9876';
export const AUTHOR_ID = '660e8400-e29b-41d4-a716-446655440004';
export const OTHER_ID = '77777777-7777-4777-8777-777777777778';
export const PROJECT_PUBLISHED = '11111111-1111-4111-8111-111111111111';
export const PROJECT_DRAFT = '22222222-2222-4222-8222-222222222222';
export const LESSON = '33333333-3333-4333-8333-333333333333';
export const REQ = TEST_TRACE;
export const T0 = Date.UTC(2026, 6, 8, 18, 35);

/** Автор модуля — без роли AUTHOR (авторство по uuid). */
export const author = new UserCaller(
  userSubject({ uuid: AUTHOR_ID, roles: ['MENTOR'] }),
);
/** Автор модуля без роли ментора: авторство — по uuid. */
export const plainAuthor = new UserCaller(
  userSubject({ uuid: AUTHOR_ID, roles: ['GUEST'] }),
);
export const student = new UserCaller(
  userSubject({
    uuid: OTHER_ID,
    roles: ['GUEST'],
  }),
);
export const otherMentor = new UserCaller(
  userSubject({
    uuid: OTHER_ID,
    roles: ['MENTOR'],
  }),
);
/** Администратор: видит неопубликованное в любом модуле. */
export const admin = new UserCaller(
  userSubject({ uuid: OTHER_ID, roles: ['ADMIN'] }),
);
/** Роль AUTHOR, но не автор этого модуля (читает тело шага, черновики — нет). */
export const roleAuthor = new UserCaller(
  userSubject({ uuid: OTHER_ID, roles: ['AUTHOR'] }),
);
/** Подписчик: как студент, права на тело шага нет. */
export const subscriber = new UserCaller(
  userSubject({ uuid: OTHER_ID, roles: ['SUBSCRIBER'] }),
);
export const anonymous = new GuestCaller();
/** Системный вызов без человека: субъекта нет, при человеке — `CourseUser`. */
export const system = new SystemCaller<CourseUser>({
  kind: 'useCase',
  module: 'probe',
  name: 'probe',
});

export const state = (
  status: ModuleState['status'],
  extra: Partial<ModuleState> = {},
): ModuleState => ({
  uuid: MODULE,
  title: 'Основы JS',
  description: 'Изучаем синтаксис языка',
  authorId: AUTHOR_ID,
  tags: ['js'],
  status,
  projects: [],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

export const projectState = (
  status: 'draft' | 'published' | 'archived',
): ModuleState['projects'][number] => ({
  uuid: status === 'published' ? PROJECT_PUBLISHED : PROJECT_DRAFT,
  title: status === 'published' ? 'Проект 1' : 'Черновик',
  status,
  lessonIds: [LESSON],
});

/** Что последним спросили у репозитория при выборке (ответ задаёт тест). */
export type Answered = { filter?: unknown };

/** Стенд UC: часы, шина, фейк репозитория модулей. */
export function makeEnv() {
  const ctx = testAppContext({ at: T0 });
  const modules = new ModuleRepoFake();
  const lessons = new LessonRepoFake();
  const steps = new StepRepoFake();
  const deps: CourseModuleDeps = {
    app: ctx.app,
    facades: new ModuleFacades(),
    courses: new CourseRepoFake(),
    modules,
    lessons,
    steps,
  };
  const asked: Answered = {};
  /** Выборка репозитория отвечает модулями из `states` (в этом порядке). */
  const answerWith = (...states: ModuleState[]) => {
    modules.findAll = async (filter?: unknown) => {
      asked.filter = filter;
      return states.map((s) => ModuleAr.restore(s));
    };
  };
  return { ctx, modules, deps, asked, answerWith };
}
