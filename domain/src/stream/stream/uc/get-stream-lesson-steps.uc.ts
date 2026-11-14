import {
  GetSnapshotStepsUcDef,
  StepsByLessonVo,
} from '@u7-scl/domain/course/contract';
import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef } from '../stream.ar';
import { StreamErrors } from '../stream.errors';
import { StreamPolicy } from '../stream.policy';

/**
 * Шаги уроков потока по снимку — для навигации участника; форма — как у
 * `getStepsByLessons`, но без статусного фильтра. Право — `canReadContent`;
 * уроки берёт `StreamAr.lessonSteps`, шаги — один вызов `getSnapshotSteps`,
 * ответ собирает `StreamLessonStepsDqs`.
 */
export const GetStreamLessonStepsUcDef = UseCaseDef.define({
  name: 'getStreamLessonSteps',
  label: 'Шаги уроков потока',
  description:
    'Шаги уроков из программы потока по порядку прохождения, для его студента, ментора или администратора — независимо от статуса шагов в курсе; урока вне программы в ответе нет.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['user'],
  policy: StreamPolicy.rules.canReadContent,
  calls: [GetSnapshotStepsUcDef],
  input: v.object({
    streamId: F.uuid('потока'),
    lessonIds: v.pipe(v.array(F.uuid('урока')), v.description('Уроки')),
  }),
  output: StepsByLessonVo,
  errors: [StreamErrors.NOT_FOUND],
});
