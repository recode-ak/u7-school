import { describe, expect, test } from 'bun:test';
import { SensitiveMask } from 'dmg-core';
import { QuestionnaireEvents } from './questionnaire.events';
import { QuestionnaireState } from './questionnaire.state';
import { QuestionnaireActionResponseSchema } from './questionnaire.types';
import { HandleActionUcDef } from './uc/handle-action.uc';
import { SendLikertInviteUcDef } from './uc/send-likert-invite.uc';
import { StartQuestionnaireUcDef } from './uc/start-questionnaire.uc';

const mask = new SensitiveMask();

describe('questionnaire: места с персональными данными помечены F.sensitive', () => {
  test.each([
    { place: 'state: answers (поле целиком)', path: 'answers' },
    { place: 'state: draftAnswers', path: 'draftAnswers' },
    { place: 'state: ownerInfo', path: 'ownerInfo' },
  ])('$place', ({ path }) => {
    expect(mask.isSensitive(QuestionnaireState, path)).toBe(true);
  });

  test('помечено поле answers, а не только answerText вложенного VO', () => {
    // Объект ответа целиком под пометкой: любое вложенное поле скрыто.
    expect(mask.isSensitive(QuestionnaireState, 'answers.answerText')).toBe(
      true,
    );
  });

  test.each([
    {
      place: 'startQuestionnaire: вход ownerInfo',
      schema: StartQuestionnaireUcDef.input,
      path: 'ownerInfo',
    },
    {
      place: 'sendLikertInvite: вход ownerInfo',
      schema: SendLikertInviteUcDef.input,
      path: 'ownerInfo',
    },
    {
      place: 'handleAction: вход value',
      schema: HandleActionUcDef.input,
      path: 'value',
    },
    {
      place: 'ответ экрана: selectedAnswers',
      schema: QuestionnaireActionResponseSchema,
      path: 'selectedAnswers',
    },
    {
      place: 'ответ экрана: previousSelectedAnswers',
      schema: QuestionnaireActionResponseSchema,
      path: 'previousSelectedAnswers',
    },
  ])('$place', ({ schema, path }) => {
    expect(mask.isSensitive(schema, path)).toBe(true);
  });

  test('каждое событие анкеты: payload.ownerInfo', () => {
    for (const [name, event] of Object.entries(QuestionnaireEvents)) {
      expect(mask.isSensitive(event.payload, 'ownerInfo'), name).toBe(true);
    }
  });
});
