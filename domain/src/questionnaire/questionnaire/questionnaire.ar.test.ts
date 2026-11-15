import { describe, expect, it } from 'bun:test';
import { expectErr, expectOk } from 'dmg-core/testing';
import { QuestionnaireAr } from './questionnaire.ar';
import { QuestionnaireEvents } from './questionnaire.events';
import {
  HOUR,
  likertInput,
  OWNER_INFO,
  QUESTIONNAIRE,
  RESPONDENT,
  refOf,
  simplePool,
  standardInput,
  stored,
  T0,
  T1,
} from './questionnaire.fixture';

// Перенос `standard/questionnaire-ar.test.ts` (создание, приглашение, start,
// decline, abandon, restore, события) и `questionnaire-factory.test.ts` на Ar по
// Def: бросавшие `throwBadRequest` ветки стали `Err` с кодом `QUESTIONNAIRE_*`,
// события — из `QuestionnaireEvents`, даты — числа UTC, момент — аргумент `at`.
// Ответы — `questionnaire.ar.answers.test.ts`, likert — `questionnaire.ar.likert.test.ts`,
// простой и флаги — `questionnaire.ar.idle.test.ts`.

const restore = (
  status: Parameters<typeof stored>[0],
  extra: Parameters<typeof stored>[1] = {},
) => QuestionnaireAr.restore(stored(status, extra));
const standard = () =>
  expectOk(QuestionnaireAr.createStandard(standardInput(), T0));

describe('QuestionnaireAr.createStandard (Т6, Р7)', () => {
  it('анкета сразу in_progress: первый вопрос выставлен, пул и ownerInfo сохранены', () => {
    const ar = standard();
    expect(ar.snapshot()).toMatchObject({
      kind: 'standard',
      uuid: QUESTIONNAIRE,
      respondentId: RESPONDENT,
      status: 'in_progress',
      currentQuestionCode: 'q1',
      draftAnswers: {},
      answers: [],
      questionPool: simplePool(),
      ownerInfo: OWNER_INFO,
      completedAt: null,
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  it('флаги простоя и причина прерывания не заданы', () => {
    const state = standard().snapshot();
    expect(state.warnedAt).toBeUndefined();
    expect(state.continueInvitedAt).toBeUndefined();
    expect(state.abandonReason).toBeUndefined();
  });

  it('единственное событие started { questionnaireId, respondentId, kind, ownerInfo }', () => {
    const ar = standard();
    expect(ar.pullEvents()).toEqual([
      QuestionnaireEvents.started.make(refOf('standard')),
    ]);
    expect(ar.pullEvents()).toEqual([]);
  });
});

describe('QuestionnaireAr.createLikert (Т6)', () => {
  it('анкета invited, kind likert, без вопроса; assessment не хранится', () => {
    const ar = expectOk(QuestionnaireAr.createLikert(likertInput(), T0));
    const state = ar.snapshot();
    expect(state).toMatchObject({
      kind: 'likert',
      status: 'invited',
      currentQuestionCode: null,
      answers: [],
      ownerInfo: refOf('likert').ownerInfo,
      createdAt: T0,
      updatedAt: T0,
    });
    expect('assessment' in state).toBe(false);
  });

  it('единственное событие invited { questionnaireId, respondentId, kind: likert, ownerInfo }', () => {
    const ar = expectOk(QuestionnaireAr.createLikert(likertInput(), T0));
    expect(ar.pullEvents()).toEqual([
      QuestionnaireEvents.invited.make(refOf('likert')),
    ]);
  });
});

describe('QuestionnaireAr.screen — приглашение и итоговые статусы', () => {
  it('invited: приглашение с inviteText, whyText и cancelWarning', () => {
    const ar = restore('invited', {
      questionPool: simplePool({ cancelWarning: 'Прогресс будет потерян' }),
    });
    expect(ar.screen()).toEqual({
      type: 'invited',
      questionnaireId: QUESTIONNAIRE,
      inviteText: 'Приглашаем пройти опрос',
      whyText: 'Это улучшит твои метрики',
      cancelWarning: 'Прогресс будет потерян',
    });
  });

  it('in_progress: текущий вопрос с прогрессом', () => {
    const screen = restore('in_progress').screen();
    expect(screen).toMatchObject({
      type: 'new_question',
      questionnaireId: QUESTIONNAIRE,
      selectedAnswers: [],
      questionIndex: 1,
      poolSize: 2,
    });
  });

  it.each(['completed', 'abandoned'] as const)(
    '%s: { type: completed } без вопроса',
    (status) => {
      const ar = restore(status, {
        abandonReason: status === 'abandoned' ? 'timeout' : undefined,
      });
      expect(ar.screen()).toEqual({
        type: 'completed',
        questionnaireId: QUESTIONNAIRE,
      });
    },
  );
});

describe('QuestionnaireAr.start (invited → in_progress)', () => {
  it('выдаёт первый вопрос, статус in_progress, updatedAt = at', () => {
    const ar = restore('invited');
    expectOk(ar.start(T1));
    expect(ar.snapshot()).toMatchObject({
      status: 'in_progress',
      currentQuestionCode: 'q1',
      updatedAt: T1,
    });
    const screen = ar.screen();
    expect(screen.type).toBe('new_question');
    if (screen.type === 'new_question') {
      expect(screen.question.questionCode).toBe('q1');
    }
  });

  it('событий не публикует — started только при создании (Т5)', () => {
    const ar = restore('invited');
    expectOk(ar.start(T1));
    expect(ar.pullEvents()).toEqual([]);
  });

  it('likert: invited → in_progress, первый вопрос по шкале Лайкерта', () => {
    const ar = expectOk(QuestionnaireAr.createLikert(likertInput(), T0));
    ar.pullEvents();
    expectOk(ar.start(T1));
    expect(ar.snapshot().status).toBe('in_progress');
    expect(ar.pullEvents()).toEqual([]);
    const screen = ar.screen();
    expect(screen.type).toBe('new_question');
    if (screen.type === 'new_question') {
      expect(screen.question.questionCode).toBe('m1');
    }
  });

  it.each(['in_progress', 'completed', 'abandoned'] as const)(
    'из %s — QUESTIONNAIRE_NOT_INVITED, состояние не меняется',
    (status) => {
      const ar = restore(status, {
        abandonReason: status === 'abandoned' ? 'by_user' : undefined,
      });
      const before = ar.snapshot();
      const error = expectErr(ar.start(T1), 'QUESTIONNAIRE_NOT_INVITED');
      expect(error.kind).toBe('conflict');
      expect(ar.snapshot()).toEqual(before);
      expect(ar.pullEvents()).toEqual([]);
    },
  );
});

describe('QuestionnaireAr.decline (invited → abandoned, Т4)', () => {
  it('в state причина by_user, статус abandoned', () => {
    const ar = restore('invited');
    expectOk(ar.decline(T1));
    expect(ar.snapshot()).toMatchObject({
      status: 'abandoned',
      abandonReason: 'by_user',
      updatedAt: T1,
    });
  });

  it('событие abandoned с reason: declined (не by_user)', () => {
    const ar = restore('invited');
    expectOk(ar.decline(T1));
    expect(ar.pullEvents()).toEqual([
      QuestionnaireEvents.abandoned.make({
        ...refOf('standard'),
        reason: 'declined',
      }),
    ]);
  });

  it('likert: событие abandoned с kind likert и reason declined', () => {
    const ar = expectOk(QuestionnaireAr.createLikert(likertInput(), T0));
    ar.pullEvents();
    expectOk(ar.decline(T1));
    expect(ar.pullEvents()).toEqual([
      QuestionnaireEvents.abandoned.make({
        ...refOf('likert'),
        reason: 'declined',
      }),
    ]);
  });

  it.each(['in_progress', 'completed', 'abandoned'] as const)(
    'из %s — QUESTIONNAIRE_NOT_INVITED, события нет',
    (status) => {
      const ar = restore(status, {
        abandonReason: status === 'abandoned' ? 'by_user' : undefined,
      });
      expectErr(ar.decline(T1), 'QUESTIONNAIRE_NOT_INVITED');
      expect(ar.pullEvents()).toEqual([]);
      expect(ar.snapshot().status).toBe(status);
    },
  );
});

describe('QuestionnaireAr.abandon', () => {
  it.each(['by_user', 'timeout'] as const)(
    'in_progress → abandoned, причина %s в state и в событии',
    (reason) => {
      const ar = restore('in_progress');
      expectOk(ar.abandon(T1, reason));
      expect(ar.snapshot()).toMatchObject({
        status: 'abandoned',
        abandonReason: reason,
        updatedAt: T1,
      });
      expect(ar.pullEvents()).toEqual([
        QuestionnaireEvents.abandoned.make({ ...refOf('standard'), reason }),
      ]);
    },
  );

  it('invited → abandoned: прерывание работает и из приглашения', () => {
    const ar = restore('invited');
    expectOk(ar.abandon(T1, 'by_user'));
    expect(ar.snapshot().status).toBe('abandoned');
    expect(ar.pullEvents()).toHaveLength(1);
  });

  it('повтор на abandoned — Ok без события, состояние прежнее (Т3)', () => {
    const ar = restore('in_progress');
    expectOk(ar.abandon(T1, 'timeout'));
    ar.pullEvents();
    const before = ar.snapshot();

    expectOk(ar.abandon(T1 + HOUR, 'by_user'));

    expect(ar.pullEvents()).toEqual([]);
    expect(ar.snapshot()).toEqual(before);
    expect(ar.snapshot().abandonReason).toBe('timeout');
  });

  it('на completed — QUESTIONNAIRE_NOT_ACTIVE', () => {
    const ar = restore('completed', { completedAt: T0 });
    const error = expectErr(
      ar.abandon(T1, 'timeout'),
      'QUESTIONNAIRE_NOT_ACTIVE',
    );
    expect(error.kind).toBe('conflict');
    expect(ar.pullEvents()).toEqual([]);
    expect(ar.snapshot().status).toBe('completed');
  });
});

describe('QuestionnaireAr.restore и инвариант хранилища', () => {
  it('abandoned без abandonReason — нарушение инварианта, исключение', () => {
    const corrupted = stored('abandoned', { abandonReason: undefined });
    expect(() => QuestionnaireAr.restore(corrupted)).toThrow();
  });
});

describe('QuestionnaireAr.isOpen', () => {
  it('приглашена и заполняется — открыта; завершена и прервана — нет', () => {
    expect(restore('invited').isOpen()).toBe(true);
    expect(restore('in_progress').isOpen()).toBe(true);
    expect(restore('completed').isOpen()).toBe(false);
    expect(restore('abandoned', { abandonReason: 'timeout' }).isOpen()).toBe(
      false,
    );
  });
});
