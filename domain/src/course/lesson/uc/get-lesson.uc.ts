import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { ModuleErrors } from '../../module/module.errors';
import { LessonArDef, LessonView } from '../lesson.ar';
import { LessonErrors } from '../lesson.errors';

/**
 * Урок для показа: чтение открыто всем, право на неопубликованное считает
 * `ModulePolicy` здесь — гость субъекта не имеет, правилом Def UC это не
 * выражается, а `undefined` от `viewFor` становится отказом.
 */
export const GetLessonUcDef = UseCaseDef.define({
  name: 'getLesson',
  label: 'Урок',
  description:
    'Урок по идентификатору: неопубликованный виден автору и администратору модуля-владельца, остальным — отказ.',
  type: 'query',
  aggregate: LessonArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({ lessonId: F.uuid('урока') }),
  output: LessonView,
  errors: [LessonErrors.NOT_FOUND, ModuleErrors.NOT_FOUND],
});
