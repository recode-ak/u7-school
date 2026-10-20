import { defineEvents, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * События потока — контракт внешнего модуля `stream` (D-37).
 * Публикует legacy-агрегат `StreamAr`; в DMG их доставляет карта `inbound`.
 * При миграции модуля контракт остаётся.
 */
export const StreamEvents = defineEvents('stream.stream', {
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
