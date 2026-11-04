import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { QuestionnaireErrors } from './questionnaire.errors';

// Ошибки агрегата `questionnaire` (ERR-04): код, вид и label — прежние тексты
// legacy-исключений (Р3). `NOT_INVITED` — один код с общим текстом (Т10).

describe('QuestionnaireErrors — коды и kind', () => {
  it('шесть ошибок группы QUESTIONNAIRE', () => {
    expect(
      Object.values(QuestionnaireErrors)
        .map((e): string[] => [e.code, e.kind])
        .sort(),
    ).toEqual(
      [
        ['QUESTIONNAIRE_NOT_FOUND', 'not_found'],
        ['QUESTIONNAIRE_NOT_INVITED', 'conflict'],
        ['QUESTIONNAIRE_NOT_IN_PROGRESS', 'conflict'],
        ['QUESTIONNAIRE_NOT_ACTIVE', 'conflict'],
        ['QUESTIONNAIRE_CHOICE_EXPECTED', 'validation'],
        ['QUESTIONNAIRE_EMPTY_ANSWER_CODE', 'validation'],
      ].sort(),
    );
  });
});

describe('QuestionnaireErrors — тексты, видимые пользователю', () => {
  it.each([
    ['NOT_FOUND', 'Анкета не найдена'],
    [
      'NOT_INVITED',
      'Анкета не в статусе invited, невозможно запустить или отказаться',
    ],
    ['NOT_IN_PROGRESS', 'Анкета уже завершена'],
    ['NOT_ACTIVE', 'Анкета не активна'],
    ['CHOICE_EXPECTED', 'Ожидался ответ с выбором (нажатием кнопки)'],
    ['EMPTY_ANSWER_CODE', 'Код ответа не может быть пустым'],
  ] as const)('%s', (code, label) => {
    expect(QuestionnaireErrors[code].label).toBe(label);
  });
});

describe('QuestionnaireErrors — payload', () => {
  it('NOT_FOUND несёт questionnaireId', () => {
    const { payload } = QuestionnaireErrors.NOT_FOUND;
    expect(payload).toBeDefined();
    if (payload) {
      const id = '11111111-1111-4111-8111-111111111111';
      expect(v.safeParse(payload, { questionnaireId: id }).success).toBe(true);
      expect(v.safeParse(payload, {}).success).toBe(false);
    }
  });
});
