import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StudentArDef, StudentView } from '../student.ar';
import { StudentErrors } from '../student.errors';
import {
  LessonStepsVo,
  NavigationTreeVo,
  ProgressVo,
  StepPositionVo,
  StudentCardVo,
} from '../student.types';

/**
 * Прогресс студента: запись и расчёты по снимку контента потока (`progress`),
 * нужные экранам, — бот видит только контракт, а не DQS. `step` и
 * `lesson` заполняются только при переданных `stepId`/`lessonId`; потока нет
 * — нет и `progress`. `allowAll`: прогресс виден любому, как в legacy.
 */
export const GetStudentProgressUcDef = UseCaseDef.define({
  name: 'getStudentProgress',
  label: 'Прогресс студента',
  description:
    'Запись студента и расчёты прогресса по программе потока: модуль, проекты, карточка, дерево навигации, шаг и урок.',
  type: 'query',
  aggregate: StudentArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({
    studentId: F.uuid('записи студента'),
    stepId: v.pipe(
      v.optional(F.uuid('шага')),
      v.description('Шаг, для которого нужны позиция и прогресс урока'),
    ),
    lessonId: v.pipe(
      v.optional(F.uuid('урока')),
      v.description('Урок, шаги которого нужны'),
    ),
  }),
  output: v.object({
    student: StudentView,
    progress: v.optional(
      v.pipe(
        v.object({
          module: v.pipe(ProgressVo, v.description('Прогресс по шагам модуля')),
          projects: v.pipe(
            ProgressVo,
            v.description('Прогресс по проектам модуля'),
          ),
          card: StudentCardVo,
          tree: NavigationTreeVo,
          step: v.optional(
            v.pipe(
              v.object({
                position: v.pipe(
                  v.optional(StepPositionVo),
                  v.description('Позиция шага в программе; шага нет — пусто'),
                ),
                lessonProgress: v.pipe(
                  ProgressVo,
                  v.description('Прогресс в уроке этого шага'),
                ),
              }),
              v.description('Шаг, заданный в запросе'),
            ),
          ),
          lesson: v.optional(LessonStepsVo),
        }),
        v.description('Расчёты по снимку контента потока'),
      ),
    ),
  }),
  errors: [StudentErrors.NOT_FOUND],
});

/** Прогресс студента: запись и расчёты по программе потока. */
export type StudentProgress = OutputOf<typeof GetStudentProgressUcDef>;
