import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef, StreamView } from '../stream.ar';
import { StreamErrors } from '../stream.errors';

/**
 * Поток для показа: чтение открыто всем (`allowAll`), как в legacy.
 * `canManage` — право вызывающего управлять потоком: UI по нему показывает
 * кнопки, права сам не вычисляет.
 */
export const GetStreamUcDef = UseCaseDef.define({
  name: 'getStream',
  label: 'Поток',
  description: 'Поток по идентификатору с признаком права управления.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({ streamId: F.uuid('потока') }),
  output: v.object({
    ...StreamView.entries,
    canManage: F.boolean('Вызывающий управляет потоком'),
  }),
  errors: [StreamErrors.NOT_FOUND],
});

/** Поток с правом управления. */
export type StreamWithRights = OutputOf<typeof GetStreamUcDef>;
