import { describe, expect, it } from 'bun:test';
import { QuestionnaireScreen } from './questionnaire-screen';

// Кнопка «Далее» — часть экрана (разбор a-root: `getNextButtonText`).
// Остальные экраны проверяются через `QuestionnaireAr.screen()` и `handleAction`.

describe('QuestionnaireScreen.getNextButtonText', () => {
  it('next:<код вопроса> — как в legacy', () => {
    expect(QuestionnaireScreen.getNextButtonText('q2')).toBe('next:q2');
    expect(QuestionnaireScreen.getNextButtonText('mq')).toBe('next:mq');
  });
});
