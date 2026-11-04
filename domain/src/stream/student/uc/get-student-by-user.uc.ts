import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StudentArDef, StudentView } from '../student.ar';
import { StudentErrors } from '../student.errors';

/**
 * Запись студента пользователя: сначала живая (учится или зачислен), иначе
 * первая с исходом. `allowAll`: как в legacy, проверок нет.
 */
export const GetStudentByUserUcDef = UseCaseDef.define({
  name: 'getStudentByUser',
  label: 'Запись студента пользователя',
  description:
    'Живая запись студента пользователя, а если её нет — первая запись с исходом.',
  type: 'query',
  aggregate: StudentArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({ userId: F.uuid('пользователя') }),
  output: StudentView,
  errors: [StudentErrors.NOT_FOUND],
});
