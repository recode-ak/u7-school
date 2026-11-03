import { EventDef, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * События потока. `stream.completed` не переносится: подписчиков не было.
 */
export const StreamEvents = EventDef.define('stream.stream', {
  created: {
    label: 'Поток создан',
    description:
      'Поток создан сразу в наборе: создание и открытие набора — один факт.',
    payload: v.object({
      streamId: F.uuid('потока'),
      moduleId: F.uuid('модуля потока'),
    }),
  },
});
