import { BaseEntityFields, defineAggregate, defineErrors } from 'dmg-core';
import * as v from 'valibot';
import { QuestionnaireEvents } from './questionnaire.events';

/**
 * Def агрегата внешнего модуля (D-37): только контракт событий.
 * Состояние и ошибки — пустой минимум; агрегат реализует legacy-код.
 */
export const QuestionnaireArDef = defineAggregate({
  name: 'questionnaire',
  label: 'Анкета',
  description:
    'Анкета респондента: заполняется по шагам, завершается или прерывается.',
  state: v.object({ ...BaseEntityFields }),
  events: QuestionnaireEvents,
  errors: defineErrors('QUESTIONNAIRE', {}),
});
