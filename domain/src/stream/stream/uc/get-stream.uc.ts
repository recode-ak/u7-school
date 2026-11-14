import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef, StreamView } from '../stream.ar';
import { StreamErrors } from '../stream.errors';

/**
 * Поток для показа: чтение открыто всем (`allowAll`), как в legacy.
 * `canManage` — право вызывающего управлять потоком: UI по нему показывает
 * кнопки, права сам не вычисляет. `canActivate`/`canComplete`/`canArchive` —
 * право управления и допустимость перехода по Def; `isEnrolling` — поток в
 * наборе (от права не зависит). UI решает по ним, а не по `status` (D-72).
 */
export const GetStreamUcDef = UseCaseDef.define({
  name: 'getStream',
  label: 'Поток',
  description:
    'Поток по идентификатору с признаками права управления и допустимых переходов.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({ streamId: F.uuid('потока') }),
  output: v.object({
    ...StreamView.entries,
    canManage: F.boolean('Вызывающий управляет потоком'),
    canActivate: F.boolean('Управляет потоком и его можно запустить'),
    canComplete: F.boolean('Управляет потоком и его можно завершить'),
    canArchive: F.boolean('Управляет потоком и его можно отправить в архив'),
    isEnrolling: F.boolean('Поток в наборе: студент может записаться'),
  }),
  errors: [StreamErrors.NOT_FOUND],
});

/** Поток с правом управления. */
export type StreamWithRights = OutputOf<typeof GetStreamUcDef>;
