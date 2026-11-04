import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamErrors } from '../../stream/stream.errors';
import { StudentArDef } from '../student.ar';
import { StudentErrors } from '../student.errors';
import { StudentPolicy } from '../student.policy';
import { CompletionResultVo } from '../student.types';

/**
 * Завершение шага студентом. Шаги выдаёт и переходы определяет
 * `StepCompletionDcs`; завершать шаг может только сам студент (Т8, в legacy
 * не проверялось). Исход студента при последнем шаге потока не меняется —
 * его указывает ментор (`completeStudent`).
 */
export const CompleteStepUcDef = UseCaseDef.define({
  name: 'completeStep',
  label: 'Завершить шаг',
  description:
    'Отмечает шаг выполненным и выдаёт следующий; результат — уровень перехода (шаг, урок, проект, поток).',
  type: 'command',
  aggregate: StudentArDef,
  callers: ['user'],
  policy: StudentPolicy.rules.isSelf,
  input: v.object({
    studentId: F.uuid('записи студента'),
    streamId: F.uuid('потока'),
    stepId: F.uuid('шага'),
  }),
  output: CompletionResultVo,
  errors: [
    StudentErrors.NOT_FOUND,
    StreamErrors.NOT_FOUND,
    StudentErrors.STEP_NOT_IN_STREAM,
    StudentErrors.STEP_NOT_ISSUED,
    StudentErrors.STEP_ALREADY_ISSUED,
  ],
});
