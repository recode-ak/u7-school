import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamErrors } from '../../stream/stream.errors';
import { StudentArDef } from '../student.ar';
import { StudentErrors } from '../student.errors';
import { StudentEvents } from '../student.events';
import { StudentPolicy } from '../student.policy';

/**
 * Снятие студента с учёбы ментором потока или администратором: по причине
 * `inactivity` (бездействие) или `by_mentor` (по решению ментора).
 */
export const MarkAbandonedUcDef = UseCaseDef.define({
  name: 'markAbandoned',
  label: 'Снять студента с учёбы',
  description:
    'Снимает студента с учёбы по решению ментора: из-за бездействия или по его усмотрению.',
  type: 'command',
  aggregate: StudentArDef,
  callers: ['user'],
  policy: StudentPolicy.rules.canMarkAbandoned,
  input: v.object({
    streamId: F.uuid('потока'),
    studentId: F.uuid('записи студента'),
    cause: F.picklist(['inactivity', 'by_mentor'], 'причины снятия'),
  }),
  output: v.pipe(v.optional(v.object({})), v.description('Без данных')),
  errors: [
    StudentErrors.NOT_FOUND,
    StreamErrors.NOT_FOUND,
    StudentErrors.NOT_STUDYING,
  ],
  emits: [StudentEvents.abandoned],
});
