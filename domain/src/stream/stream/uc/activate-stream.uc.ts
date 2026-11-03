import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef } from '../stream.ar';
import { StreamErrors } from '../stream.errors';
import { StreamPolicy } from '../stream.policy';

/**
 * Запуск потока: набор → идёт. Первый шаг студентам выдаёт прикладной слой
 * после записи потока (мост к legacy-студентам).
 */
export const ActivateStreamUcDef = UseCaseDef.define({
  name: 'activateStream',
  label: 'Запустить поток',
  description:
    'Переводит поток из набора в активный; зачисленные студенты получают первый шаг.',
  type: 'command',
  aggregate: StreamArDef,
  callers: ['user'],
  policy: StreamPolicy.rules.canManage,
  input: v.object({ streamId: F.uuid('потока') }),
  output: v.pipe(v.optional(v.object({})), v.description('Без данных')),
  errors: [StreamErrors.NOT_FOUND, StreamErrors.NOT_ENROLLING],
});
