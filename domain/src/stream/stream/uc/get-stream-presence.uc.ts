import { allowAll, defineUseCase, F, type OutputOf } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef } from '../stream.ar';

/**
 * Есть ли поток — для других модулей. Отсутствие потока — не ошибка, а
 * ответ `exists: false`: вызывающий решает, что делать дальше.
 *
 * `allowAll`: ответ не зависит от субъекта — это факт существования потока,
 * а не доступ к его содержимому.
 */
export const GetStreamPresenceUcDef = defineUseCase({
  name: 'getStreamPresence',
  label: 'Наличие потока',
  description: 'Существует ли поток с указанным id, — для других модулей.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({
    streamId: F.uuid('потока'),
  }),
  output: v.object({
    exists: v.pipe(v.boolean(), v.description('Поток существует')),
  }),
  errors: [],
});

/** Ответ: есть ли поток. */
export type StreamPresence = OutputOf<typeof GetStreamPresenceUcDef>;
