import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamErrors } from '../../stream/stream.errors';
import { StudentArDef } from '../student.ar';
import { StudentErrors } from '../student.errors';
import { StudentEvents } from '../student.events';
import { StudentPolicy } from '../student.policy';

/**
 * Исход студента, который указывает ментор потока или администратор: прошёл
 * или не прошёл (исход можно сменить). Уход с учёбы — `markAbandoned`.
 */
export const CompleteStudentUcDef = UseCaseDef.define({
  name: 'completeStudent',
  label: 'Указать исход студента',
  description:
    'Фиксирует исход студента в потоке: прошёл (advanced) или не прошёл (not_advanced).',
  type: 'command',
  aggregate: StudentArDef,
  callers: ['user'],
  policy: StudentPolicy.rules.canComplete,
  input: v.object({
    streamId: F.uuid('потока'),
    studentId: F.uuid('записи студента'),
    outcome: F.picklist(['advanced', 'not_advanced'], 'исхода'),
  }),
  output: v.pipe(v.optional(v.object({})), v.description('Без данных')),
  errors: [
    StudentErrors.NOT_FOUND,
    StreamErrors.NOT_FOUND,
    StudentErrors.NOT_COMPLETABLE,
  ],
  emits: [StudentEvents.completed],
});
