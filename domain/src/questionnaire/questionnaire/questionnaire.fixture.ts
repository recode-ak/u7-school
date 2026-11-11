import type { LikertQuestionPool } from './likert/likert-question';
import type { Question, QuestionnairePool } from './question';
import type { QuestionnaireState } from './questionnaire.state';

/** Общие данные тестов домена анкет: идентификаторы, время, пулы, состояния. */
export const QUESTIONNAIRE = '00000000-0000-4000-8000-000000000042';
export const RESPONDENT = '00000000-0000-4000-8000-000000000007';
export const OTHER_USER = '00000000-0000-4000-8000-000000000008';
export const ADMIN_USER = '00000000-0000-4000-8000-000000000009';
export const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

export const HOUR = 60 * 60 * 1000;
export const T0 = Date.UTC(2026, 5, 1, 10);
export const T1 = T0 + 60_000;

export const OWNER_INFO = { courseId: COURSE };
export const LIKERT_OWNER_INFO = {
  context: 'module_completed',
  role: 'student_student',
  subjectId: OTHER_USER,
  triggerEvent: {
    type: 'module_completed',
    aggregateId: '00000000-0000-4000-8000-000000000010',
  },
};

export type StandardState = Extract<QuestionnaireState, { kind: 'standard' }>;

const single = (
  questionCode: string,
  answers: [string, string][],
): Question => ({
  question: `Вопрос ${questionCode}`,
  questionCode,
  type: 'choice',
  multiple: false,
  answers: answers.map(([answerCode, answer]) => ({ answerCode, answer })),
});

/** Пул из двух вопросов с одиночным выбором: q1 (yes/no) → q2 (ok). */
export function simplePool(
  extra: Partial<QuestionnairePool> = {},
): QuestionnairePool {
  return {
    inviteText: 'Приглашаем пройти опрос',
    whyText: 'Это улучшит твои метрики',
    questions: [
      single('q1', [
        ['yes', 'Да'],
        ['no', 'Нет'],
      ]),
      single('q2', [['ok', 'OK']]),
    ],
    ...extra,
  };
}

/** Пул из одного вопроса q1 (yes/no). */
export function onePool(): QuestionnairePool {
  return {
    inviteText: 'Приглашаем пройти опрос',
    whyText: 'Это улучшит твои метрики',
    questions: [
      single('q1', [
        ['yes', 'Да'],
        ['no', 'Нет'],
      ]),
    ],
  };
}

/** Пул: одиночный (q1) → множественный (q2) → текстовый (q3). */
export function mixedPool(): QuestionnairePool {
  return {
    inviteText: 'Приглашаем пройти опрос',
    cancelWarning: 'Прогресс будет потерян',
    questions: [
      single('q1', [
        ['yes', 'Да'],
        ['no', 'Нет'],
      ]),
      {
        question: 'Что интересно?',
        questionCode: 'q2',
        type: 'choice',
        multiple: true,
        answers: [
          { answerCode: 'fe', answer: 'Фронтенд' },
          { answerCode: 'be', answer: 'Бэкенд' },
        ],
      },
      { question: 'Расскажи о себе', questionCode: 'q3', type: 'text' },
    ],
  };
}

/** Пул likert: две подкатегории по умолчанию. */
export function likertPool(
  questions: LikertQuestionPool['questions'] = [
    {
      questionCode: 'm1',
      question: 'Пишет код чисто',
      likertMapping: {
        category: 'professional_skills',
        subcategory: 'work_quality',
        weight: 1,
      },
    },
    {
      questionCode: 'm2',
      question: 'Думает алгоритмами',
      likertMapping: {
        category: 'professional_skills',
        subcategory: 'algorithmic_thinking',
        weight: 1,
      },
    },
  ],
): LikertQuestionPool {
  return { questions };
}

export const standardInput = (
  pool: QuestionnairePool = simplePool(),
  ownerInfo: Record<string, unknown> = OWNER_INFO,
) => ({ uuid: QUESTIONNAIRE, respondentId: RESPONDENT, pool, ownerInfo });

export const likertInput = (
  pool: LikertQuestionPool = likertPool(),
  ownerInfo: Record<string, unknown> = LIKERT_OWNER_INFO,
) => ({ uuid: QUESTIONNAIRE, respondentId: RESPONDENT, pool, ownerInfo });

/** Состояние обычной анкеты в хранилище; создана и обновлена в `T0`. */
export const stored = (
  status: StandardState['status'],
  extra: Partial<StandardState> = {},
): StandardState => ({
  kind: 'standard',
  uuid: QUESTIONNAIRE,
  respondentId: RESPONDENT,
  status,
  currentQuestionCode: status === 'in_progress' ? 'q1' : null,
  draftAnswers: {},
  answers: [],
  questionPool: simplePool(),
  ownerInfo: OWNER_INFO,
  completedAt: null,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

/** Общие поля payload событий анкеты (`ref` контракта). */
export const refOf = <K extends 'standard' | 'likert' = 'standard'>(
  kind: K = 'standard' as K,
  ownerInfo: Record<string, unknown> = kind === 'standard'
    ? OWNER_INFO
    : LIKERT_OWNER_INFO,
) => ({
  questionnaireId: QUESTIONNAIRE,
  respondentId: RESPONDENT,
  kind,
  ownerInfo,
});
