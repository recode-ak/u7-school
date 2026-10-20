import { BaseEntityFields, defineAggregate, defineErrors } from 'dmg-core';
import * as v from 'valibot';
import { StreamEvents } from './stream.events';

/**
 * Def агрегата внешнего модуля (D-37): только контракт событий.
 * Состояние и ошибки — пустой минимум; агрегат реализует legacy-код.
 */
export const StreamArDef = defineAggregate({
  name: 'stream',
  label: 'Поток',
  description: 'Поток обучения по модулю курса: набор, занятия, завершение.',
  state: v.object({ ...BaseEntityFields }),
  events: StreamEvents,
  errors: defineErrors('STREAM', {}),
});
