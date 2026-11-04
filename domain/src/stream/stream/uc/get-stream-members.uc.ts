import { allowAll, F, type OutputOf, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { RosterEntryVo } from '../../student/student.types';
import { StreamArDef } from '../stream.ar';

/**
 * Состав потока для других модулей: ментор и студенты со статусами; `roster` —
 * отставание по каждому (медиана — по учащимся). Потока нет — `undefined`.
 * `allowAll`: вызывают система и экраны без прав.
 */
export const GetStreamMembersUcDef = UseCaseDef.define({
  name: 'getStreamMembers',
  label: 'Состав потока',
  description:
    'Ментор потока и его студенты со статусами и признаком «не начинал»; потока нет — пусто.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['system', 'user', 'guest'],
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
            studentId: F.uuid('записи студента'),
            userId: F.uuid('студента'),
            status: F.picklist(
              ['enrolled', 'active', 'abandoned', 'advanced', 'not_advanced'],
              'статуса студента в потоке',
            ),
            neverStarted: F.boolean('студент не начинал учёбу'),
            inProgress: F.boolean('студент учится или только зачислен'),
          }),
        ),
        v.description('Студенты потока со статусами'),
      ),
      roster: v.optional(
        v.pipe(
          v.array(RosterEntryVo),
          v.description(
            'Отставание каждого студента на момент запроса: время без активности и уровень',
          ),
        ),
      ),
    }),
  ),
  errors: [],
});

/** Состав потока; `undefined` — потока нет. */
export type StreamMembersView = OutputOf<typeof GetStreamMembersUcDef>;
