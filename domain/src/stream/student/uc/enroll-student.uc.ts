import { GetModulePrerequisiteUcDef } from '@u7-scl/domain/course/contract';
import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamErrors } from '../../stream/stream.errors';
import { StudentArDef } from '../student.ar';
import { StudentErrors } from '../student.errors';
import { StudentEvents } from '../student.events';
import { StudentRules } from '../student.rules';

/**
 * Зачисление на поток. Студент — сам вызывающий (`userId` не во входе):
 * записать другого нельзя, поэтому `allowAll`. Порядок отказов — как в
 * legacy (`StudentRules`): кодовое слово (через контекст загрузки) → живая
 * запись → допуск к модулю → шаги. Статус потока не проверяется.
 */
export const EnrollStudentUcDef = UseCaseDef.define({
  name: 'enrollStudent',
  label: 'Записаться на поток',
  description:
    'Зачисляет вызывающего на поток: проверяет кодовое слово, отсутствие живой записи, допуск к модулю и наличие шагов.',
  type: 'command',
  aggregate: StudentArDef,
  callers: ['user'],
  policy: allowAll,
  rules: [
    StudentRules.rules.enrollmentKeyAccepted,
    StudentRules.rules.notStudyingElsewhere,
    StudentRules.rules.prerequisitePassed,
    StudentRules.rules.streamHasSteps,
  ],
  calls: [GetModulePrerequisiteUcDef],
  input: v.object({
    streamId: F.uuid('потока'),
    enrollmentKey: v.pipe(
      v.optional(v.string()),
      v.description('Кодовое слово потока, если оно задано'),
    ),
  }),
  output: v.object({ studentId: F.uuid('записи студента') }),
  errors: [
    StreamErrors.NOT_FOUND,
    StudentErrors.WRONG_ENROLLMENT_KEY,
    StudentErrors.ALREADY_STUDYING,
    StudentErrors.PREREQUISITE_NOT_PASSED,
    StudentErrors.NO_STEPS,
  ],
  emits: [StudentEvents.enrolled],
});
