import { F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef } from '../stream.ar';
import { StreamErrors } from '../stream.errors';
import { StreamPolicy } from '../stream.policy';

/** Отправка завершённого потока в архив. */
export const ArchiveStreamUcDef = UseCaseDef.define({
  name: 'archiveStream',
  label: 'Отправить поток в архив',
  description: 'Отправляет завершённый поток в архив; больше он не меняется.',
  type: 'command',
  aggregate: StreamArDef,
  callers: ['user'],
  policy: StreamPolicy.rules.canManage,
  input: v.object({ streamId: F.uuid('потока') }),
  output: v.pipe(v.optional(v.object({})), v.description('Без данных')),
  errors: [
    StreamErrors.NOT_FOUND,
    StreamErrors.NOT_COMPLETED,
    StreamErrors.ALREADY_ARCHIVED,
  ],
});
