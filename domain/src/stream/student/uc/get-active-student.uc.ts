import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamView } from '../../stream/stream.ar';
import { StudentArDef, StudentView } from '../student.ar';

/**
 * Живая запись пользователя (учится или зачислен) и её поток — для меню и
 * кнопки «Записаться». Записи нет — пустой ответ, не ошибка.
 */
export const GetActiveStudentUcDef = UseCaseDef.define({
  name: 'getActiveStudent',
  label: 'Живая запись студента',
  description:
    'Первая живая запись студента пользователя и поток этой записи; записи нет — пусто.',
  type: 'query',
  aggregate: StudentArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({ userId: F.uuid('пользователя') }),
  output: v.object({
    student: v.pipe(
      v.optional(StudentView),
      v.description('Живая запись студента'),
    ),
    stream: v.pipe(v.optional(StreamView), v.description('Поток живой записи')),
  }),
  errors: [],
});
