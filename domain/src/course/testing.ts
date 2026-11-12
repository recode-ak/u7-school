/**
 * Вход `testing` модуля `course` для тестов вне модуля (TST-07). Здесь —
 * только то, чего нет в контракте (`…/course/contract`): формы записей на
 * диске и Def, нужные мирам u7-bot для проверки инвариантов.
 */

/** Миры u7-bot: Def агрегата курса — проверка инвариантов мира. */
export { CourseArDef } from './course/course.ar';
/** Миры u7-bot: запись курса на диске (`courses.json`). */
export type { CourseState } from './course/course.state';
/** Миры u7-bot: инвариант программы курса — проверка инвариантов мира. */
export { CourseProgramInvariant } from './course/course.state';
/** Миры u7-bot: запись урока на диске. */
export type { LessonState } from './lesson/lesson.state';
/** Миры u7-bot: запись модуля на диске. */
export type { ModuleState, ProjectEntity } from './module/module.state';
/** Миры u7-bot: статус в записи курса на диске. */
export { Status } from './status';
/** Миры u7-bot: запись шага на диске. */
export type { StepState } from './step/step.state';
