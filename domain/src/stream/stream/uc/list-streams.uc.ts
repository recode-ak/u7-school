import { allowAll, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef, StreamView } from '../stream.ar';
import { StreamState } from '../stream.state';

const { entries } = StreamState;

/** Потоки по необязательным фильтрам; чтение открыто всем (`allowAll`). */
export const ListStreamsUcDef = UseCaseDef.define({
  name: 'listStreams',
  label: 'Потоки',
  description: 'Список потоков с фильтрами по статусу, ментору и школе.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({
    status: v.pipe(
      v.optional(entries.status),
      v.description('Только потоки в этом статусе'),
    ),
    mentorId: v.pipe(
      v.optional(entries.mentorId),
      v.description('Только потоки этого ментора'),
    ),
    schoolId: v.pipe(
      v.optional(entries.schoolId),
      v.description('Только потоки этой школы'),
    ),
  }),
  output: v.pipe(v.array(StreamView), v.description('Потоки')),
  errors: [],
});
