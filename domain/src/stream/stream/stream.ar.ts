import { AggregateDef, BaseEntityFields, ErrorDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamEvents } from './stream.events';

/**
 * Def агрегата внешнего модуля (D-37): только контракт событий.
 * Состояние и ошибки — пустой минимум; агрегат реализует legacy-код.
 */
export const StreamArDef = AggregateDef.define({
  name: 'stream',
  label: 'Поток',
  description: 'Поток обучения по модулю курса: набор, занятия, завершение.',
  state: v.object({ ...BaseEntityFields }),
  events: StreamEvents,
  errors: ErrorDef.define('STREAM', {}),
});
