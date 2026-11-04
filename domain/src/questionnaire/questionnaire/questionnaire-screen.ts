import type { ChoiceQuestion, Question } from './question';
import type { AnswerVo, QuestionnaireState } from './questionnaire.state';
import type {
  CompletedResponse,
  InviteResponse,
  NewQuestionResponse,
  QuestionnaireActionResponse,
  StaleAnswerResponse,
  StaleReason,
  WaitNextResponse,
} from './questionnaire.types';
import type { QuestionnaireEngine } from './questionnaire-engine';

/** Префикс callback-кнопки «Далее» (как в legacy). */
export const NEXT_BUTTON_PREFIX = 'next:';

/** Коды ответа из строки: multiple-ответ хранится склейкой через запятую. */
export function splitAnswerCodes(value: string | undefined): string[] {
  if (value === undefined || value === '') return [];
  return value.split(',').filter(Boolean);
}

/**
 * Экран анкеты: собирает ответы `QuestionnaireActionResponse` из состояния
 * и ответов движка. Решений не принимает — их принимает `QuestionnaireAr`.
 */
export class QuestionnaireScreen {
  private readonly state: Readonly<QuestionnaireState>;
  private readonly engine: QuestionnaireEngine;

  constructor(
    state: Readonly<QuestionnaireState>,
    engine: QuestionnaireEngine,
  ) {
    this.state = state;
    this.engine = engine;
  }

  /** Значение callback-кнопки «Далее» для вопроса. */
  static getNextButtonText(questionCode: string): string {
    return `${NEXT_BUTTON_PREFIX}${questionCode}`;
  }

  /** Текущий экран по состоянию анкеты. */
  current(): QuestionnaireActionResponse {
    switch (this.state.status) {
      case 'invited':
        return this.invite();
      case 'completed':
      case 'abandoned':
        return this.finished();
      case 'in_progress':
        return this.currentQuestion();
    }
  }

  /** Приглашение пройти анкету. */
  invite(): InviteResponse {
    return {
      type: 'invited',
      questionnaireId: this.state.uuid,
      inviteText: this.state.questionPool.inviteText,
      whyText: this.state.questionPool.whyText,
      cancelWarning: this.state.questionPool.cancelWarning,
    };
  }

  /** Экран вопроса после ответа на предыдущий. */
  afterAnswer(
    previous: Question,
    previousSelected: string[],
    next: Question,
    answers: AnswerVo[],
  ): NewQuestionResponse {
    return {
      type: 'new_question',
      questionnaireId: this.state.uuid,
      question: next,
      selectedAnswers: [],
      previousQuestion: previous,
      previousSelectedAnswers: previousSelected,
      cancelWarning: this.state.questionPool.cancelWarning,
      ...this.progress(next.questionCode, answers),
    };
  }

  /** Анкета завершена после ответа на последний вопрос. */
  afterLastAnswer(
    previous: Question,
    previousSelected: string[],
  ): CompletedResponse {
    return {
      type: 'completed',
      questionnaireId: this.state.uuid,
      selectedAnswers: previousSelected,
      previousQuestion: previous,
      previousSelectedAnswers: previousSelected,
      completionText: this.state.questionPool.completionText,
    };
  }

  /** Ожидание кнопки «Далее» на multiple-вопросе. */
  waitNext(
    question: ChoiceQuestion,
    selected: string[],
    answers: AnswerVo[],
  ): WaitNextResponse {
    return {
      type: 'wait_next',
      questionnaireId: this.state.uuid,
      currentQuestion: question,
      selectedAnswers: selected,
      nextButton:
        selected.length > 0
          ? QuestionnaireScreen.getNextButtonText(question.questionCode)
          : undefined,
      cancelWarning: this.state.questionPool.cancelWarning,
      ...this.progress(question.questionCode, answers),
    };
  }

  /** Неактуальный ответ: показываем актуальный вопрос без изменения состояния. */
  stale(
    question: Question,
    reason: StaleReason,
    answers: AnswerVo[],
  ): StaleAnswerResponse {
    const selected = splitAnswerCodes(
      this.state.draftAnswers[question.questionCode],
    );
    return {
      type: 'stale_answer',
      questionnaireId: this.state.uuid,
      question,
      selectedAnswers: selected,
      cancelWarning: this.state.questionPool.cancelWarning,
      reason,
      nextButton:
        question.type === 'choice' && question.multiple && selected.length > 0
          ? QuestionnaireScreen.getNextButtonText(question.questionCode)
          : undefined,
      ...this.progress(question.questionCode, answers),
    };
  }

  /** Известен ли код ответа вопросу с выбором. */
  isKnownAnswerCode(question: ChoiceQuestion, answerCode: string): boolean {
    return question.answers.some((a) => a.answerCode === answerCode);
  }

  private currentQuestion(): QuestionnaireActionResponse {
    const code = this.state.currentQuestionCode ?? '';
    const question = this.engine.getRequiredByCode(code);
    const selected = splitAnswerCodes(this.state.draftAnswers[code]);
    if (
      question.type === 'choice' &&
      question.multiple &&
      selected.length > 0
    ) {
      return this.waitNext(question, selected, this.state.answers);
    }
    return {
      type: 'new_question',
      questionnaireId: this.state.uuid,
      question,
      selectedAnswers: selected,
      cancelWarning: this.state.questionPool.cancelWarning,
      ...this.progress(code, this.state.answers),
    };
  }

  private finished(): CompletedResponse {
    return {
      type: 'completed',
      questionnaireId: this.state.uuid,
    };
  }

  private progress(
    questionCode: string,
    answers: AnswerVo[],
  ): { questionIndex?: number; poolSize?: number } {
    const progress = this.engine.getProgress(questionCode, answers);
    if (progress === undefined) return {};
    return { questionIndex: progress.index, poolSize: progress.total };
  }
}
