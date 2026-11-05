import {
  CourseAr,
  type CourseState,
  ModuleAr,
  type ModuleState,
} from '@u7-scl/domain/course';
import { ModuleFacades } from 'dmg-core/app';
import { testAppContext } from 'dmg-core/testing';
import type { CourseModuleDeps } from '../../course.module';
import { LessonRepoFake } from '../../lesson/lesson.repo.fake';
import { ModuleRepoFake } from '../../module/module.repo.fake';
import { state as moduleState, T0 } from '../../module/uc/module-uc.fixture';
import { StepRepoFake } from '../../step/step.repo.fake';
import type { CourseFilter } from '../course.repo';
import { CourseRepoFake } from '../course.repo.fake';

export {
  admin,
  anonymous,
  author,
  otherMentor,
  REQ,
  student,
  system,
  T0,
} from '../../module/uc/module-uc.fixture';

/**
 * Общие данные тестов UC курса: идентификаторы курсов и модулей (в том числе
 * общий модуль `a1a1…` — второй в `fafa…` и первый в `cccc…`), построители
 * state курса и этапа.
 */
export const COURSE = '29adc3be-873e-47ec-aa30-61f5e6e25d4e';
export const AUTHOR = '660e8400-e29b-41d4-a716-446655440004';
export const OTHER_AUTHOR = '880e8400-e29b-41d4-a716-446655440009';
export const M1 = '11111111-1111-4111-8111-111111111111';
export const M2 = '22222222-2222-4222-8222-222222222222';
export const M3 = '33333333-3333-4333-8333-333333333333';
export const M4 = '44444444-4444-4444-8444-444444444444';
/** Модуль вне всех программ тестов. */
export const OUTSIDE = '99999999-9999-4999-8999-999999999999';
export const FAFA = 'fafafafa-baba-4aba-8aba-babababababa';
export const CCCC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
export const A0 = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0';
export const A1 = 'a1a1a1a1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';

/** Метка этапа. */
export const phase = (
  title: string,
  fromModuleId: string,
  track?: string,
): CourseState['phases'][number] =>
  track === undefined
    ? { title, fromModuleId }
    : { title, fromModuleId, track };

/** Состояние курса: по умолчанию программа M1..M4 и один этап с первого модуля. */
export const courseState = (
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

/** Курс без этапов с заданной программой. */
export const plainCourse = (
  uuid: string,
  moduleIds: string[],
  status: CourseState['status'] = 'published',
  extra: Partial<CourseState> = {},
): CourseState =>
  courseState(status, {
    uuid,
    moduleIds,
    phases: [],
    title: `Курс ${uuid.slice(0, 2)}`,
    ...extra,
  });

/** Что UC спросил у репозитория курсов — по порядку вызовов. */
export type Asked = {
  readonly filters: (CourseFilter | undefined)[];
  readonly byIds: (readonly string[])[];
  readonly byId: string[];
};

/**
 * Стенд UC курса: часы, шина, фейки репозиториев курсов и модулей. Курсы
 * лежат в порядке посева (это «порядок файла» настоящего репозитория):
 * `findAll` отвечает ими с отбором по `status`, `findByIds` — в порядке
 * посева без повторов и неизвестных (контракт порта), при `reversed.on` — в
 * обратном (порядок результата UC задают входные списки). Обращения
 * записываются в `asked`.
 */
export function makeCourseEnv() {
  const ctx = testAppContext({ at: T0 });
  const courses = new CourseRepoFake();
  const modules = new ModuleRepoFake();
  const lessons = new LessonRepoFake();
  const steps = new StepRepoFake();
  const asked: Asked = { filters: [], byIds: [], byId: [] };
  const reversed = { on: false };

  const courseRows: CourseState[] = [];
  const moduleRows: ModuleState[] = [];

  courses.findAll = async (filter?: CourseFilter) => {
    asked.filters.push(filter);
    return courseRows
      .filter((row) => !filter?.status || row.status === filter.status)
      .map((row) => CourseAr.restore(row));
  };
  const byId = courses.findById;
  courses.findById = async (uuid: string) => {
    asked.byId.push(uuid);
    return byId(uuid);
  };
  courses.findByIds = async (ids: readonly string[]) => {
    asked.byIds.push(ids);
    const found = courseRows
      .filter((row) => ids.includes(row.uuid))
      .map((row) => CourseAr.restore(row));
    return reversed.on ? found.reverse() : found;
  };
  modules.findAll = async () => moduleRows.map((row) => ModuleAr.restore(row));

  const deps: CourseModuleDeps = {
    app: ctx.app,
    facades: new ModuleFacades(),
    modules,
    lessons,
    steps,
    courses,
  };

  /** Курсы в базу фейка, в порядке файла. */
  const seedCourses = (...states: CourseState[]) => {
    courses.seed(...states);
    courseRows.push(...states);
  };
  /** Модули (по умолчанию опубликованные с названием по id) в базу фейка. */
  const seedModules = (...states: ModuleState[]) => {
    modules.seed(...states);
    moduleRows.push(...states);
  };
  /** Модуль с названием по умолчанию `Модуль <первые два символа id>`. */
  const moduleWithTitle = (uuid: string, title?: string): ModuleState =>
    moduleState('published', {
      uuid,
      title: title ?? `Модуль ${uuid.slice(0, 2)}`,
    });

  return {
    ctx,
    courses,
    modules,
    deps,
    asked,
    reversed,
    seedCourses,
    seedModules,
    moduleWithTitle,
  };
}
