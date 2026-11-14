import type {
  LikertQuestionPool,
  QuestionnairePool,
  QuestionnaireState,
} from '@u7-scl/domain/questionnaire';
import { userSubject } from '@u7-scl/domain/user/testing';
import { type OperationRef, SystemCaller, UserCaller } from 'dmg-core';
import { ModuleFacades, Trace } from 'dmg-core/app';
import { testAppContext } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
import type { QuestionnaireFilter } from '../questionnaire.repo';
import { QuestionnaireRepoFake } from '../questionnaire.repo.fake';

/** Общие данные тестов UC и Job анкет: фейк репозитория, вызывающие, состояния. */
export const QUESTIONNAIRE = '00000000-0000-4000-8000-000000000042';
export const OTHER_QUESTIONNAIRE = '00000000-0000-4000-8000-000000000043';
export const RESPONDENT = '00000000-0000-4000-8000-000000000007';
export const OTHER_USER = '00000000-0000-4000-8000-000000000008';
export const MISSING = '00000000-0000-4000-8000-0000000000ff';
export const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
export const OWNER_INFO = { courseId: COURSE };
export const HOUR = 60 * 60 * 1000;
export const T0 = Date.UTC(2026, 5, 1, 10);
export const REQ = Trace.fromRequest({ requestId: 'r-1' });

export const respondent = new UserCaller(
  userSubject({
    uuid: RESPONDENT,
    roles: ['GUEST'],
  }),
);

const FROM: OperationRef = { kind: 'useCase', module: 'probe', name: 'probe' };
/** Вызов другого модуля за человека (`this.call`) и без человека (ER/Job). */
export const systemFor = (uuid = RESPONDENT) =>
  new SystemCaller(
    FROM,
    new UserCaller(userSubject({ uuid, roles: ['GUEST'] })),
  );
export const systemAlone = new SystemCaller<QuestionnaireUser>(FROM);

export const pool = (): QuestionnairePool => ({
  inviteText: 'Приглашаем пройти опрос',
  whyText: 'Это улучшит твои метрики',
  questions: [
    {
      question: 'Q1',
      questionCode: 'q1',
      type: 'choice',
      multiple: false,
      answers: [
        { answer: 'Да', answerCode: 'yes' },
        { answer: 'Нет', answerCode: 'no' },
      ],
    },
    {
      question: 'Q2',
      questionCode: 'q2',
      type: 'choice',
      multiple: false,
      answers: [{ answer: 'OK', answerCode: 'ok' }],
    },
  ],
});

export const likertPool = (): LikertQuestionPool => ({
  questions: [
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
});

type Standard = Extract<QuestionnaireState, { kind: 'standard' }>;
type Likert = Extract<QuestionnaireState, { kind: 'likert' }>;

export const state = (
  status: Standard['status'],
  extra: Partial<Standard> = {},
): Standard => ({
  kind: 'standard',
  uuid: QUESTIONNAIRE,
  respondentId: RESPONDENT,
  status,
  currentQuestionCode: status === 'in_progress' ? 'q1' : null,
  draftAnswers: {},
  answers: [],
  questionPool: pool(),
  ownerInfo: OWNER_INFO,
  completedAt: null,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...(status === 'abandoned' ? { abandonReason: 'by_user' as const } : {}),
  ...extra,
});

export const likertState = (
  status: Likert['status'],
  extra: Partial<Likert> = {},
): Likert => ({
  kind: 'likert',
  uuid: QUESTIONNAIRE,
  respondentId: RESPONDENT,
  status,
  currentQuestionCode: status === 'in_progress' ? 'm1' : null,
  draftAnswers: {},
  answers: [],
  questionPool: likertPool(),
  ownerInfo: { context: 'module_completed', subjectId: OTHER_USER },
  completedAt: null,
  createdAt: T0,
  updatedAt: T0,
  version: 0,
  ...extra,
});

/**
 * Стенд UC и Job: часы на `at`, фейк репозитория. Выборки отвечают по текущей
 * базе фейка: `findByRespondent` — в порядке записи, `findIdle` — как настоящий
 * (незавершённые, простой от `updatedAt` на момент `at`, фильтр `kinds`).
 */
export function makeEnv(at = T0) {
  const ctx = testAppContext({ at });
  const questionnaires = new QuestionnaireRepoFake();
  const deps = { app: ctx.app, facades: new ModuleFacades([]), questionnaires };
  const ids: string[] = [];

  const rows = () =>
    ids.flatMap((id) => {
      const ar = questionnaires.restored(id);
      return ar ? [ar] : [];
    });

  const seed = (...states: QuestionnaireState[]) => {
    questionnaires.seed(...states);
    for (const s of states) if (!ids.includes(s.uuid)) ids.push(s.uuid);
    questionnaires.findByRespondent = async (
      userId: string,
      { status, kind, courseId }: QuestionnaireFilter = {},
    ) =>
      rows().filter((q) => {
        const s = q.view();
        return (
          q.isOf(userId) &&
          (status === undefined || s.status === status) &&
          (kind === undefined || s.kind === kind) &&
          (courseId === undefined || s.ownerInfo.courseId === courseId)
        );
      });
    questionnaires.findIdle = async ({ idleMs, at: now, kinds }) =>
      rows().filter((q) => {
        const s = q.view();
        if (kinds && !kinds.includes(s.kind)) return false;
        if (s.status !== 'invited' && s.status !== 'in_progress') return false;
        return q.idleFor(now) >= idleMs;
      });
  };
  const stored = (id = QUESTIONNAIRE) =>
    questionnaires.restoredOrThrow(id).view();
  const events = () => ctx.published.map((e) => [e.name, e.payload] as const);
  return { ctx, questionnaires, deps, seed, stored, events, rows };
}
