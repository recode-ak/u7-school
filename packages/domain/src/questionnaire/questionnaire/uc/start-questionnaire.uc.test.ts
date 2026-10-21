import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { QuestionnaireEvents } from '../questionnaire.events';
import { StartQuestionnaireUcDef } from './start-questionnaire.uc';

const pool = {
  questions: [
    { question: 'Зачем?', questionCode: 'why', type: 'text' as const },
  ],
};
const owner = { courseId: '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f' };

describe('StartQuestionnaireUcDef', () => {
  it('command для других модулей: запускает анкету, публикует started', () => {
    expect(normalize(StartQuestionnaireUcDef)).toMatchObject({
      name: 'startQuestionnaire',
      type: 'command',
      aggregate: 'questionnaire',
      callers: ['module'],
      errors: [],
      emits: ['questionnaire.questionnaire.started'],
    });
    expect(StartQuestionnaireUcDef.emits).toEqual([
      QuestionnaireEvents.started,
    ]);
  });

  it('вход — пул анкеты и данные владельца; пул проверяется схемой', () => {
    const { input } = StartQuestionnaireUcDef;
    expect(v.parse(input, { pool, owner })).toEqual({ pool, owner });
    expect(v.safeParse(input, { pool: { questions: [] }, owner }).success).toBe(
      false,
    );
    expect(v.safeParse(input, { pool }).success).toBe(false);
  });

  it('выход пустой — как у legacy start', () => {
    expect(v.parse(StartQuestionnaireUcDef.output, {})).toEqual({});
  });
});
