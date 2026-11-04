import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StudentArDef } from '../student.ar';
import { StudentErrors } from '../student.errors';
import { StudentEvents } from '../student.events';
import { StudentPolicy } from '../student.policy';

/** Самовыход студента из потока: зачислен | учится → ушёл `{ self, voluntary }`. */
export const DropStudentUcDef = UseCaseDef.define({
  name: 'dropStudent',
  label: 'Выйти из потока',
  description:
    'Снимает вызывающего студента с учёбы по его собственному решению.',
  type: 'command',
  aggregate: StudentArDef,
  callers: ['user'],
  policy: StudentPolicy.rules.isSelf,
  input: v.object({
    streamId: F.uuid('потока'),
    studentId: F.uuid('записи студента'),
  }),
  output: v.pipe(v.optional(v.object({})), v.description('Без данных')),
  errors: [StudentErrors.NOT_FOUND, StudentErrors.NOT_STUDYING],
  emits: [StudentEvents.abandoned],
});
