import type { LessonState, StepState } from '@u7-scl/domain/course';
import { ModuleFacades } from 'dmg-core/app';
import { testAppContext } from 'dmg-core/testing';
import { CourseRepoFake } from './course/course.repo.fake';
import type { CourseModuleDeps } from './course.module';
import { LessonRepoFake } from './lesson/lesson.repo.fake';
import { ModuleRepoFake } from './module/module.repo.fake';
import { MODULE, T0 } from './module/uc/module-uc.fixture';
import { StepRepoFake } from './step/step.repo.fake';

export {
  AUTHOR_ID,
  admin,
  anonymous,
  author,
  MODULE,
  OTHER_ID,
  otherMentor,
  PROJECT_PUBLISHED,
  plainAuthor,
  projectState,
  REQ,
  roleAuthor,
  state as moduleState,
  student,
  subscriber,
  system,
  T0,
} from './module/uc/module-uc.fixture';

/**
 * Общие данные тестов UC уроков, шагов и снимка модуля: второй модуль
 * (автор — `OTHER_ID`), идентификаторы уроков и шагов, построители state.
 */
export const OTHER_MODULE = '4a3b2c1d-0e9f-4a8b-9c7d-6e5f4a3b2c1d';
export const LESSON_1 = '33333333-3333-4333-8333-333333333333';
export const LESSON_2 = '44444444-4444-4444-8444-444444444444';
export const LESSON_3 = '77777777-7777-4777-8777-777777777771';
export const STEP_1 = '55555555-5555-4555-8555-555555555551';
export const STEP_2 = '55555555-5555-4555-8555-555555555552';
export const STEP_3 = '55555555-5555-4555-8555-555555555553';
export const STEP_4 = '55555555-5555-4555-8555-555555555554';

export const lessonState = (
  uuid: string,
  status: LessonState['status'],
  extra: Partial<LessonState> = {},
): LessonState => ({
  uuid,
  moduleId: MODULE,
  title: `Урок ${uuid.slice(0, 2)}`,
  status,
  stepIds: [],
  mentorStepIds: [],
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

export const textStep = (
  uuid: string,
  status: StepState['status'],
  extra: Partial<Extract<StepState, { kind: 'text' }>> = {},
): StepState => ({
  uuid,
  moduleId: MODULE,
  kind: 'text',
  description: `Шаг ${uuid.slice(-1)}`,
  content: 'Текст шага',
  status,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

/** Что UC спросил у репозиториев — по порядку вызовов. */
export type Asked = {
  readonly modules: string[];
  readonly lessons: (readonly string[])[];
  readonly lessonById: string[];
  readonly steps: (readonly string[])[];
  readonly stepById: string[];
};

/**
 * Стенд UC: часы, шина, фейки репозиториев модулей, уроков и шагов. Фейки
 * записывают обращения в `asked`; `reversed.on = true` заставляет `findByIds`
 * отвечать в обратном порядке (порядок результата UC задают входные списки).
 */
export function makeContentEnv() {
  const ctx = testAppContext({ at: T0 });
  const modules = new ModuleRepoFake();
  const lessons = new LessonRepoFake();
  const steps = new StepRepoFake();
  const asked: Asked = {
    modules: [],
    lessons: [],
    lessonById: [],
    steps: [],
    stepById: [],
  };
  const reversed = { on: false };
  const order = <T>(found: T[]) => (reversed.on ? [...found].reverse() : found);

  const moduleById = modules.findById;
  modules.findById = async (id) => {
    asked.modules.push(id);
    return moduleById(id);
  };
  const lessonById = lessons.findById;
  lessons.findById = async (id) => {
    asked.lessonById.push(id);
    return lessonById(id);
  };
  const lessonsByIds = lessons.findByIds;
  lessons.findByIds = async (ids) => {
    asked.lessons.push(ids);
    return order(await lessonsByIds(ids));
  };
  const stepById = steps.findById;
  steps.findById = async (id) => {
    asked.stepById.push(id);
    return stepById(id);
  };
  const stepsByIds = steps.findByIds;
  steps.findByIds = async (ids) => {
    asked.steps.push(ids);
    return order(await stepsByIds(ids));
  };

  const deps: CourseModuleDeps = {
    app: ctx.app,
    facades: new ModuleFacades(),
    courses: new CourseRepoFake(),
    modules,
    lessons,
    steps,
  };
  return { ctx, modules, lessons, steps, deps, asked, reversed };
}
