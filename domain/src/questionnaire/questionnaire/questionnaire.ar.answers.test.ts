import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { QuestionnaireAr } from './questionnaire.ar';
import { QuestionnaireEvents } from './questionnaire.events';
import {
  mixedPool,
  OWNER_INFO,
  QUESTIONNAIRE,
  RESPONDENT,
  refOf,
  simplePool,
  standardInput,
  stored,
  T0,
} from './questionnaire.fixture';
import { QuestionnaireScreen } from './questionnaire-screen';

// Перенос `standard/questionnaire-ar.test.ts` (handleAction, завершение, multiple,
// прогресс) и `standard/stale-answer.test.ts` (graceful stale-ответы, FR-1).
// Отказы — `Err` с кодом, `stale_answer` — вариант экрана, не ошибка.

const at = (n: number) => T0 + n * 1000;
const cb = (value: string) => ({ type: 'callback' as const, value });
const text = (value: string) => ({ type: 'text' as const, value });
const create = (pool = simplePool()) =>
  expectOk(QuestionnaireAr.createStandard(standardInput(pool), T0));
let tick = 0;
const act = (
  ar: QuestionnaireAr,
  action: { type: 'callback' | 'text'; value: string },
) => expectOk(ar.handleAction(at(++tick), action));
const next = (code: string) => QuestionnaireScreen.getNextButtonText(code);

describe('handleAction — одиночный выбор и текст', () => {
  it('фиксирует ответ, answeredAt = at, переходит к следующему вопросу', () => {
    const ar = create();
    const res = expectOk(ar.handleAction(at(5), cb('yes')));
    expect(res.type).toBe('new_question');
    if (res.type === 'new_question') {
      expect(res.question.questionCode).toBe('q2');
      expect(res.previousQuestion?.questionCode).toBe('q1');
      expect(res.previousSelectedAnswers).toEqual(['yes']);
      expect(res.selectedAnswers).toEqual([]);
    }
    const state = ar.snapshot();
    expect(state.answers).toEqual([
      { questionCode: 'q1', answerCode: 'yes', answeredAt: at(5) },
    ]);
    expect(state).toMatchObject({
      currentQuestionCode: 'q2',
      updatedAt: at(5),
    });
  });

  it('text на text-вопросе: answerCode = text, answerText сохранён', () => {
    const pool = mixedPool();
    const ar = QuestionnaireAr.restore(
      stored('in_progress', {
        questionPool: pool,
        currentQuestionCode: 'q3',
        answers: [
          { questionCode: 'q1', answerCode: 'yes', answeredAt: T0 },
          { questionCode: 'q2', answerCode: 'fe', answeredAt: T0 },
        ],
      }),
    );
    act(ar, text('Я разработчик'));
    expect(ar.snapshot().answers.at(-1)).toMatchObject({
      questionCode: 'q3',
      answerCode: 'text',
      answerText: 'Я разработчик',
    });
  });

  it('text на choice-вопросе — QUESTIONNAIRE_CHOICE_EXPECTED, состояние не меняется', () => {
    const ar = create();
    const before = ar.snapshot();
    const error = expectErr(
      ar.handleAction(at(1), text('привет')),
      'QUESTIONNAIRE_CHOICE_EXPECTED',
    );
    expect(error.kind).toBe('validation');
    expect(ar.snapshot().answers).toEqual(before.answers);
  });

  it('callback с пустым кодом на choice — QUESTIONNAIRE_EMPTY_ANSWER_CODE', () => {
    const ar = create();
    const error = expectErr(
      ar.handleAction(at(1), cb('')),
      'QUESTIONNAIRE_EMPTY_ANSWER_CODE',
    );
    expect(error.kind).toBe('validation');
    expect(ar.snapshot().answers).toEqual([]);
  });
});

describe('handleAction — завершение', () => {
  const finish = () => {
    const ar = create(
      simplePool({ completionText: 'Спасибо! Анкета принята.' }),
    );
    ar.pullEvents();
    act(ar, cb('yes'));
    const res = expectOk(ar.handleAction(at(100), cb('ok')));
    return { ar, res };
  };

  it('после последнего вопроса: completed с completionText, статус completed, completedAt = at', () => {
    const { ar, res } = finish();
    expect(res.type).toBe('completed');
    if (res.type === 'completed') {
      expect(res.completionText).toBe('Спасибо! Анкета принята.');
      expect(res.previousSelectedAnswers).toEqual(['ok']);
    }
    expect(ar.snapshot()).toMatchObject({
      status: 'completed',
      currentQuestionCode: null,
      completedAt: at(100),
      updatedAt: at(100),
    });
    expect(ar.snapshot().answers).toHaveLength(2);
  });

  it('единственное событие completed { kind: standard, ownerInfo } без answers', () => {
    const { ar } = finish();
    const events = ar.pullEvents();
    expect(events).toEqual([
      QuestionnaireEvents.completed.make(refOf('standard', OWNER_INFO)),
    ]);
    expect(events[0]?.payload).not.toHaveProperty('answers');
    expect(events[0]?.payload).not.toHaveProperty('telegramId');
    expect(events[0]?.payload).toMatchObject({
      questionnaireId: QUESTIONNAIRE,
      respondentId: RESPONDENT,
    });
  });

  it.each(['completed', 'abandoned', 'invited'] as const)(
    'handleAction на %s — QUESTIONNAIRE_NOT_IN_PROGRESS',
    (status) => {
      const ar = QuestionnaireAr.restore(
        stored(status, {
          abandonReason: status === 'abandoned' ? 'timeout' : undefined,
        }),
      );
      const error = expectErr(
        ar.handleAction(at(1), cb('yes')),
        'QUESTIONNAIRE_NOT_IN_PROGRESS',
      );
      expect(error.kind).toBe('conflict');
      expect(ar.pullEvents()).toEqual([]);
    },
  );
});

describe('handleAction — multiple choice', () => {
  const atMultiple = () => {
    const ar = create(mixedPool());
    act(ar, cb('yes'));
    return ar;
  };

  it('тоггл черновика: выбор, добавление, снятие; wait_next с nextButton', () => {
    const ar = atMultiple();
    const r1 = act(ar, cb('fe'));
    expect(r1).toMatchObject({
      type: 'wait_next',
      selectedAnswers: ['fe'],
      nextButton: next('q2'),
    });
    expect(ar.snapshot().draftAnswers).toEqual({ q2: 'fe' });

    const r2 = act(ar, cb('be'));
    expect(r2.type === 'wait_next' && r2.selectedAnswers).toEqual(['fe', 'be']);

    const r3 = act(ar, cb('fe'));
    expect(r3.type === 'wait_next' && r3.selectedAnswers).toEqual(['be']);
  });

  it('снятие последнего выбора удаляет ключ черновика, nextButton нет', () => {
    const ar = atMultiple();
    act(ar, cb('fe'));
    const res = act(ar, cb('fe'));
    expect(ar.snapshot().draftAnswers).toEqual({});
    expect(res.type === 'wait_next' && res.nextButton).toBeUndefined();
  });

  it('«Далее» с выбором: ответ из черновика, черновик очищен, следующий вопрос', () => {
    const ar = atMultiple();
    act(ar, cb('fe'));
    act(ar, cb('be'));
    const res = act(ar, cb(next('q2')));
    expect(res.type === 'new_question' && res.question.questionCode).toBe('q3');
    expect(ar.snapshot().draftAnswers).toEqual({});
    expect(ar.snapshot().answers.at(-1)?.answerCode).toBe('fe,be');
  });

  it('get-current: wait_next с выбранными, иначе new_question с selectedAnswers из черновика', () => {
    const ar = atMultiple();
    expect(ar.screen()).toMatchObject({
      type: 'new_question',
      selectedAnswers: [],
    });
    act(ar, cb('fe'));
    expect(ar.screen()).toMatchObject({
      type: 'wait_next',
      selectedAnswers: ['fe'],
      nextButton: next('q2'),
    });
  });

  it('прогресс: questionIndex/poolSize в wait_next и в следующем new_question', () => {
    const ar = atMultiple();
    const draft = act(ar, cb('fe'));
    expect(draft).toMatchObject({ questionIndex: 2, poolSize: 3 });
    const nextQ = act(ar, cb(next('q2')));
    expect(nextQ).toMatchObject({
      type: 'new_question',
      questionIndex: 3,
      poolSize: 3,
    });
  });
});

describe('handleAction — stale-ответы (FR-1, Т2)', () => {
  const snap = (ar: QuestionnaireAr) => {
    const s = ar.snapshot();
    return {
      status: s.status,
      currentQuestionCode: s.currentQuestionCode,
      draftAnswers: s.draftAnswers,
      answers: s.answers,
    };
  };

  it('single: чужой код ответа → stale_answer/stale_button, состояние не меняется', () => {
    const ar = create(mixedPool());
    const before = snap(ar);
    const res = act(ar, cb('alien'));
    expect(res).toMatchObject({
      type: 'stale_answer',
      reason: 'stale_button',
      questionnaireId: QUESTIONNAIRE,
      selectedAnswers: [],
      cancelWarning: 'Прогресс будет потерян',
    });
    expect(res.type === 'stale_answer' && res.question.questionCode).toBe('q1');
    expect(snap(ar)).toEqual(before);
  });

  it('single: чужой код кнопки «Далее» → stale_button', () => {
    const ar = create(mixedPool());
    const res = act(ar, cb('next:q9'));
    expect(res).toMatchObject({ type: 'stale_answer', reason: 'stale_button' });
  });

  it('multiple: тоггл чужого кода → stale_button, черновик сохранён в ответе', () => {
    const ar = create(mixedPool());
    act(ar, cb('yes'));
    act(ar, cb('fe'));
    const before = snap(ar);
    const res = act(ar, cb('alien'));
    expect(res).toMatchObject({
      type: 'stale_answer',
      reason: 'stale_button',
      selectedAnswers: ['fe'],
      nextButton: next('q2'),
    });
    expect(snap(ar)).toEqual(before);
  });

  it('multiple: «Далее» без выбора → stale_answer/empty_selection', () => {
    const ar = create(mixedPool());
    act(ar, cb('yes'));
    const before = snap(ar);
    const res = act(ar, cb(next('q2')));
    expect(res).toMatchObject({
      type: 'stale_answer',
      reason: 'empty_selection',
      selectedAnswers: [],
    });
    expect(snap(ar)).toEqual(before);
  });

  it.each(['fe', next('q2')])(
    'text-вопрос: callback %s → stale_button, состояние не меняется',
    (value) => {
      const ar = create(mixedPool());
      act(ar, cb('yes'));
      act(ar, cb('fe'));
      act(ar, cb(next('q2')));
      const before = snap(ar);
      const res = act(ar, cb(value));
      expect(res).toMatchObject({
        type: 'stale_answer',
        reason: 'stale_button',
      });
      expect(res.type === 'stale_answer' && res.question.questionCode).toBe(
        'q3',
      );
      expect(snap(ar)).toEqual(before);
    },
  );

  it('text: валидный текст завершает анкету', () => {
    const ar = create(mixedPool());
    act(ar, cb('yes'));
    act(ar, cb('fe'));
    act(ar, cb(next('q2')));
    expect(act(ar, text('Меня зовут Иван')).type).toBe('completed');
    expect(ar.snapshot().status).toBe('completed');
  });

  it('stale сбрасывает флаги простоя, но не сдвигает updatedAt (Т2)', () => {
    const ar = QuestionnaireAr.restore(
      stored('in_progress', { warnedAt: T0 + 100, continueInvitedAt: T0 + 50 }),
    );
    const res = expectOk(ar.handleAction(T0 + 1000, cb('alien')));
    expect(res.type).toBe('stale_answer');
    const state = ar.snapshot();
    expect(state.warnedAt).toBeUndefined();
    expect(state.continueInvitedAt).toBeUndefined();
    expect(state.updatedAt).toBe(T0);
  });
});

describe('handleAction — повреждённая запись', () => {
  it('in_progress без текущего вопроса — исключение, а не штатный отказ', () => {
    const ar = QuestionnaireAr.restore(
      stored('in_progress', { currentQuestionCode: null }),
    );
    expect(() => ar.handleAction(at(1), cb('yes'))).toThrow(
      'статус in_progress без текущего вопроса',
    );
  });

  it('текущий вопрос вне пула — исключение, а не штатный отказ', () => {
    const ar = QuestionnaireAr.restore(
      stored('in_progress', { currentQuestionCode: 'нет-такого' }),
    );
    expect(() => ar.handleAction(at(1), cb('yes'))).toThrow('не найден в пуле');
  });
});
