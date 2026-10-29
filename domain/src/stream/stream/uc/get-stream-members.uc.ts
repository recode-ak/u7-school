import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef } from '../stream.ar';

/**
 * Состав потока для других модулей: ментор и студенты со статусами.
 * Проекцию исходов («прошёл»/«не прошёл») делают потребители. Отсутствие
 * потока — штатный исход `undefined`, не ошибка: вызывающий решает сам.
 *
 * `allowAll`: вызывает система (реакция другого модуля), субъекта нет.
 */
export const GetStreamMembersUcDef = UseCaseDef.define({
  name: 'getStreamMembers',
  label: 'Состав потока',
  description:
    'Ментор потока и его студенты со статусами и признаком «не начинал»; потока нет — пусто.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({
    streamId: F.uuid('потока'),
  }),
  output: v.optional(
    v.object({
      mentorId: F.uuid('ментора потока'),
      students: v.pipe(
        v.array(
          v.object({
            userId: F.uuid('студента'),
            status: F.picklist(
              ['enrolled', 'active', 'abandoned', 'advanced', 'not_advanced'],
              'статуса студента в потоке',
            ),
            neverStarted: F.boolean('студент не начинал учёбу'),
          }),
        ),
        v.description('Студенты потока со статусами'),
      ),
    }),
  ),
  errors: [],
});

/** Состав потока; `undefined` — потока нет. */
export type StreamMembersView = OutputOf<typeof GetStreamMembersUcDef>;
