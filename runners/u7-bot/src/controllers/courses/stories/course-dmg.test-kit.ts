/**
 * Набор для тестов UI над модулем `course`: мок `appApi.dispatch` вместо
 * legacy `appApi.execute(name, attrs)`.
 *
 * `dmgDispatch(answers, modules?)` отвечает по имени UC (`XUcDef.name`):
 * значение — `ok(...)`, `refuse(...)` — `err`. Входные ключи Def — `courseId`,
 * `moduleId`, `stepId`, `lessonIds` (не `uuid`). Билдеры — `courseView`,
 * `moduleView`, `stage`; готовые отказы — `courseNotFound`, `moduleNotFound`,
 * `stepNotFound`.
 *
 * Механику `Refusal`/`dmgDispatch` берём у набора потоков.
 */
import {
  CourseErrors,
  CourseModuleDef,
  type CourseStage,
  type CourseView,
  ModuleErrors,
  type ModuleView,
  StepErrors,
} from '@u7-scl/domain/course/contract';
import { WishModuleDef } from '@u7-scl/domain/wish/contract';
import {
  dmgDispatch as dispatchOver,
  type Refusal,
  refuse,
  type UcAnswers,
} from '../../streams/stories/stream-dmg.test-kit';

export { type Refusal, refuse, type UcAnswers };

/** Мок `appApi.dispatch`: модули `course` и `wish`, если не указано иное. */
export function dmgDispatch(
  answers: UcAnswers,
  modules: readonly unknown[] = [CourseModuleDef, WishModuleDef],
) {
  return dispatchOver(answers, modules);
}

/** Отказ «курс не найден» — как у `getCourse`. */
export const courseNotFound = (courseId = 'c-missing') =>
  refuse(
    CourseErrors.NOT_FOUND.code,
    'not_found',
    { courseId },
    'Курс не найден',
  );

/** Отказ «модуль не найден» — как у `getModule`, `getModuleSnapshot`, `getStep`. */
export const moduleNotFound = (moduleId = 'm-missing') =>
  refuse(
    ModuleErrors.NOT_FOUND.code,
    'not_found',
    { moduleId },
    'Модуль не найден',
  );

/** Отказ «шаг не найден» — как у `getStep`. */
export const stepNotFound = (stepId = 's-missing') =>
  refuse(StepErrors.NOT_FOUND.code, 'not_found', { stepId }, 'Шаг не найден');

/** Этап курса: заголовок и срез программы. */
export const stage = (
  title: string,
  moduleIds: string[],
  track?: string,
): CourseStage => ({ title, track, moduleIds });

/**
 * Курс в ответе `listCourses`/`getCourse`. `stages: []` — курс без этапов;
 * `moduleIds` по умолчанию — модули этапов подряд.
 */
export function courseView(
  overrides: Partial<CourseView> & { uuid: string; title: string },
): CourseView {
  const stages = overrides.stages ?? [];
  return {
    description: 'Описание курса',
    authorId: 'author-1',
    status: 'published',
    moduleIds: stages.flatMap((s) => s.moduleIds),
    stages,
    createdAt: Date.parse('2026-01-01T00:00:00.000Z'),
    updatedAt: Date.parse('2026-01-01T00:00:00.000Z'),
    version: 0,
    ...overrides,
  };
}

/** Модуль в ответе `getModule`; проекты — `{ uuid, title, lessonIds }`. */
export function moduleView(
  overrides: Partial<ModuleView> & { uuid: string; title: string },
): ModuleView {
  return {
    description: 'Описание модуля',
    authorId: 'author-1',
    status: 'published',
    tags: [],
    projects: [],
    createdAt: Date.parse('2026-01-01T00:00:00.000Z'),
    updatedAt: Date.parse('2026-01-01T00:00:00.000Z'),
    version: 0,
    ...overrides,
  } as ModuleView;
}
