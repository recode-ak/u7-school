/**
 * Типы записи анкеты для миров, e2e и метатипов команд.
 * Рантайм-схемы состояния — `questionnaire.state.ts`.
 */

/** Ответ на вопрос анкеты; дата — число UTC или ISO-строка legacy-записи. */
export type Answer = {
  questionCode: string;
  answerCode: string;
  answerText?: string;
  answeredAt: number | string;
};

/** Запись анкеты в мире: даты — ISO или числа UTC. */
export type BaseQuestionnaireState = {
  kind: 'standard' | 'likert';
  uuid: string;
  respondentId: string;
  status: 'invited' | 'in_progress' | 'completed' | 'abandoned';
  currentQuestionCode: string | null;
  draftAnswers: Record<string, string>;
  answers: Answer[];
  questionPool: {
    inviteText?: string;
    whyText?: string;
    completionText?: string;
    cancelWarning?: string;
    questions: unknown[];
  };
  ownerInfo: Record<string, unknown>;
  createdAt: string | number;
  updatedAt?: string | number;
  warnedAt?: string | number;
  continueInvitedAt?: string | number;
  completedAt: string | number | null;
  abandonReason?: 'timeout' | 'by_user';
};

export type Questionnaire = BaseQuestionnaireState;

/** Метаданные агрегата анкеты для метатипов команд. */
export interface BaseQuestionnaireArMeta {
  name: 'Questionnaire';
  label: 'Анкета';
  state: BaseQuestionnaireState;
}
