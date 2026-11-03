import { allowAll, F, UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef, StreamView } from '../stream.ar';

/**
 * Поток по Telegram-группе — для обработки вступления и выхода участников.
 * Группа сравнивается строкой, при нескольких потоках берётся первый.
 */
export const FindStreamByTelegramGroupUcDef = UseCaseDef.define({
  name: 'findStreamByTelegramGroup',
  label: 'Поток по Telegram-группе',
  description: 'Поток, у которого указана эта Telegram-группа; нет — пусто.',
  type: 'query',
  aggregate: StreamArDef,
  callers: ['user', 'guest'],
  policy: allowAll,
  input: v.object({
    telegramGroupId: F.string('Идентификатор Telegram-группы'),
  }),
  output: v.pipe(v.optional(StreamView), v.description('Поток или пусто')),
  errors: [],
});
