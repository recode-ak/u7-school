import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef } from '../stream.ar';
import { StreamErrors } from '../stream.errors';
import { StreamPolicy } from '../stream.policy';
import { StreamRules } from '../stream.rules';

/**
 * Завершение потока: идёт → завершён. Порядок отказов как в legacy: сначала
 * студенты без исхода (`studentsSettled`), затем статус потока.
 */
export const CompleteStreamUcDef = UseCaseDef.define({
  name: 'completeStream',
  label: 'Завершить поток',
  description: 'Завершает активный поток, если у каждого студента есть исход.',
  type: 'command',
  aggregate: StreamArDef,
  callers: ['user'],
  policy: StreamPolicy.rules.canManage,
  rules: [StreamRules.rules.studentsSettled],
  input: v.object({ streamId: F.uuid('потока') }),
  output: v.pipe(v.optional(v.object({})), v.description('Без данных')),
  errors: [
    StreamErrors.NOT_FOUND,
    StreamErrors.STUDENTS_IN_PROGRESS,
    StreamErrors.NOT_ACTIVE,
  ],
});
