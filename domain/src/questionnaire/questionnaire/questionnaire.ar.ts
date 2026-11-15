import {
  Aggregate,
  AggregateDef,
  type ErrorOf,
  type EventsOf,
  ok,
  type RejectOf,
  type Result,
  type Timestamp,
} from 'dmg-core';
import * as v from 'valibot';
import {
  LIKERT_SCALE,
  type LikertQuestion,
  type LikertQuestionPool,
  LikertQuestionPoolSchema,
  type LikertScore,
  LikertScoreSchema,
} from './likert/likert-question';
import {
  type ChoiceQuestion,
  type Question,
  type QuestionnairePool,
  QuestionnairePoolSchema,
} from './question';
import { QuestionnaireErrors } from './questionnaire.errors';
import { QuestionnaireEvents } from './questionnaire.events';
import {
  type AnswerVo,
  type QuestionnaireState,
  QuestionnaireState as QuestionnaireStateSchema,
} from './questionnaire.state';
import type { QuestionnaireActionResponse } from './questionnaire.types';
import { QuestionnaireEngine } from './questionnaire-engine';
import {
  NEXT_BUTTON_PREFIX,
  QuestionnaireScreen,
  splitAnswerCodes,
} from './questionnaire-screen';

const HOUR_MS = 60 * 60 * 1000;

/** Порог приглашения продолжить анкету — 3 часа простоя. */
export const INVITE_AFTER_HOURS = 3;
/** Порог предупреждения о закрытии анкеты — 6 часов простоя. */
export const WARN_AFTER_HOURS = 6;
/** Порог закрытия анкеты по простою — 9 часов. */
export const ABANDON_AFTER_HOURS = 9;

export const INVITE_AFTER_IDLE_MS = INVITE_AFTER_HOURS * HOUR_MS;
export const WARN_AFTER_IDLE_MS = WARN_AFTER_HOURS * HOUR_MS;
export const ABANDON_AFTER_IDLE_MS = ABANDON_AFTER_HOURS * HOUR_MS;
export const INTERVAL_MS = INVITE_AFTER_IDLE_MS;

const { NOT_ACTIVE, NOT_IN_PROGRESS, CHOICE_EXPECTED, EMPTY_ANSWER_CODE } =
  QuestionnaireErrors;

type ActionError =
  | ErrorOf<typeof NOT_IN_PROGRESS>
  | ErrorOf<typeof CHOICE_EXPECTED>
  | ErrorOf<typeof EMPTY_ANSWER_CODE>;

export type QuestionnaireAction = {
  readonly type: 'callback' | 'text';
  readonly value: string;
};

export type CreateStandardQuestionnaire = {
  readonly uuid: string;
  readonly respondentId: string;
  readonly pool: QuestionnairePool;
  readonly ownerInfo: Record<string, unknown>;
};

export type CreateLikertQuestionnaire = {
  readonly uuid: string;
  readonly respondentId: string;
  readonly pool: v.InferOutput<typeof LikertQuestionPoolSchema>;
  readonly ownerInfo: Record<string, unknown>;
};

/** Поля payload событий анкеты. */
type QuestionnaireRef = {
  readonly questionnaireId: string;
  readonly respondentId: string;
  readonly kind: 'standard' | 'likert';
  readonly ownerInfo: Record<string, unknown>;
};

export const QuestionnaireArDef = AggregateDef.define({
  name: 'questionnaire',
  label: 'Анкета',
  description:
    'Анкета респондента: приглашение, заполнение вопросов, завершение или прерывание.',
  state: QuestionnaireStateSchema,
  statuses: {
    invited: { label: 'Приглашена' },
    in_progress: { label: 'Заполняется' },
    completed: { label: 'Завершена' },
    abandoned: { label: 'Прервана' },
  },
  transitions: {
    start: {
      from: ['invited'],
      to: 'in_progress',
      rejects: {
        in_progress: QuestionnaireErrors.NOT_INVITED,
        completed: QuestionnaireErrors.NOT_INVITED,
        abandoned: QuestionnaireErrors.NOT_INVITED,
      },
    },
    decline: {
      from: ['invited'],
      to: 'abandoned',
      rejects: {
        in_progress: QuestionnaireErrors.NOT_INVITED,
        completed: QuestionnaireErrors.NOT_INVITED,
        abandoned: QuestionnaireErrors.NOT_INVITED,
      },
    },
    abandon: {
      from: ['invited', 'in_progress'],
      to: 'abandoned',
      rejects: {
        completed: NOT_ACTIVE,
        abandoned: NOT_ACTIVE,
      },
    },
    complete: {
      from: ['in_progress'],
      to: 'completed',
      rejects: {
        invited: NOT_IN_PROGRESS,
        completed: NOT_IN_PROGRESS,
        abandoned: NOT_IN_PROGRESS,
      },
    },
  },
  events: QuestionnaireEvents,
  errors: QuestionnaireErrors,
});

type QuestionnaireEvent = EventsOf<typeof QuestionnaireArDef>;

/**
 * Анкета респондента. Жизненный цикл — в `QuestionnaireArDef.transitions`;
 * ответы и черновики — через `change`; экран собирает `QuestionnaireScreen`.
 */
export class QuestionnaireAr extends Aggregate<typeof QuestionnaireArDef> {
  private readonly engine: QuestionnaireEngine;

  private constructor(
    state: QuestionnaireState,
    events: readonly QuestionnaireEvent[] = [],
  ) {
    super(QuestionnaireArDef, state, events);
    if (
      this.state.status === 'abandoned' &&
      this.state.abandonReason === undefined
    ) {
      // biome-ignore lint/plugin: нарушен инвариант «abandoned ⇒ abandonReason» записи — это дефект данных, а не отказ операции
      throw new Error(
        `Анкета ${this.state.uuid}: статус abandoned без причины прерывания`,
      );
    }
    this.engine = buildEngine(this.state);
  }

  /** Создание обычной анкеты: сразу в работе, первый вопрос, событие `started`. */
  static createStandard(
    input: CreateStandardQuestionnaire,
    at: Timestamp,
  ): Result<QuestionnaireAr, never> {
    const pool = v.parse(QuestionnairePoolSchema, input.pool);
    const first = firstQuestion(new QuestionnaireEngine(pool.questions));
    const state: QuestionnaireState = {
      ...QuestionnaireAr.newState(input.uuid, at),
      kind: 'standard',
      respondentId: input.respondentId,
      status: 'in_progress',
      currentQuestionCode: first.questionCode,
      draftAnswers: {},
      answers: [],
      questionPool: pool,
      ownerInfo: input.ownerInfo,
      completedAt: null,
    };
    return ok(
      new QuestionnaireAr(state, [
        QuestionnaireEvents.started.make(refOf(state)),
      ]),
    );
  }

  /** Создание likert-анкеты: приглашение без текущего вопроса, событие `invited`. */
  static createLikert(
    input: CreateLikertQuestionnaire,
    at: Timestamp,
  ): Result<QuestionnaireAr, never> {
    const pool = v.parse(LikertQuestionPoolSchema, input.pool);
    const state: QuestionnaireState = {
      ...QuestionnaireAr.newState(input.uuid, at),
      kind: 'likert',
      respondentId: input.respondentId,
      status: 'invited',
      currentQuestionCode: null,
      draftAnswers: {},
      answers: [],
      questionPool: pool,
      ownerInfo: input.ownerInfo,
      completedAt: null,
    };
    return ok(
      new QuestionnaireAr(state, [
        QuestionnaireEvents.invited.make(refOf(state)),
      ]),
    );
  }

  /** Восстановление из хранилища — запись разобрана `QuestionnaireArDef.state`. */
  static restore(snapshot: QuestionnaireState): QuestionnaireAr {
    return new QuestionnaireAr(snapshot);
  }

  // ── Вопросы ──

  /** Респондент ли пользователь. */
  isOf(userId: string): boolean {
    return this.state.respondentId === userId;
  }

  /** Открыта ли анкета: приглашена или заполняется (не завершена и не прервана). */
  isOpen(): boolean {
    return (
      this.state.status === 'invited' || this.state.status === 'in_progress'
    );
  }

  /** Простой в мс от последней активности; флаги простоя его не сдвигают. */
  idleFor(at: Timestamp): number {
    return at - this.lastActivityAt();
  }

  /** Нужен ли обход: достигнута ступень без выставленного флага. */
  needsSweep(at: Timestamp): boolean {
    if (!this.isOpen()) return false;
    const idle = this.idleFor(at);
    if (idle >= ABANDON_AFTER_IDLE_MS) return true;
    if (this.state.status === 'invited') return false;
    if (idle >= WARN_AFTER_IDLE_MS) return this.state.warnedAt === undefined;
    if (idle >= INVITE_AFTER_IDLE_MS) {
      return this.state.continueInvitedAt === undefined;
    }
    return false;
  }

  /** Экран анкеты: приглашение, текущий вопрос или завершение. */
  screen(): QuestionnaireActionResponse {
    return this.screenBuilder().current();
  }

  // ── Переходы ──

  /** Запуск приглашённой анкеты: первый вопрос, флаги простоя сброшены. */
  start(
    at: Timestamp,
  ): Result<void, RejectOf<typeof QuestionnaireArDef, 'start'>> {
    return this.transition('start', at, (draft) => {
      delete draft.warnedAt;
      delete draft.continueInvitedAt;
      draft.currentQuestionCode = firstQuestion(this.engine).questionCode;
      return ok();
    });
  }

  /** Отказ от приглашения: причина `by_user`, событие `reason: declined`. */
  decline(
    at: Timestamp,
  ): Result<void, RejectOf<typeof QuestionnaireArDef, 'decline'>> {
    return this.transition('decline', at, (draft, emit) => {
      draft.abandonReason = 'by_user';
      emit(
        QuestionnaireEvents.abandoned.make({
          ...this.ref(),
          reason: 'declined',
        }),
      );
      return ok();
    });
  }

  /** Прерывание анкеты: повтор на `abandoned` — Ok без события. */
  abandon(
    at: Timestamp,
    reason: 'by_user' | 'timeout',
  ): Result<void, RejectOf<typeof QuestionnaireArDef, 'abandon'>> {
    if (this.state.status === 'abandoned') return ok();
    return this.transition('abandon', at, (draft, emit) => {
      draft.abandonReason = reason;
      emit(QuestionnaireEvents.abandoned.make({ ...this.ref(), reason }));
      return ok();
    });
  }

  /** Ответ пользователя: черновик, следующий вопрос или завершение. */
  handleAction(
    at: Timestamp,
    action: QuestionnaireAction,
  ): Result<QuestionnaireActionResponse, ActionError> {
    if (this.state.status !== 'in_progress') return NOT_IN_PROGRESS.err();
    this.resetIdleFlags();
    const code = this.currentQuestionCode();
    const question = this.engine.getRequiredByCode(code);
    const screen = this.screenBuilder();
    const { type, value } = action;

    if (type === 'text') {
      if (question.type === 'choice') return CHOICE_EXPECTED.err();
      return this.submit(at, question, value, []);
    }

    if (value.startsWith(NEXT_BUTTON_PREFIX)) {
      if (
        value !== QuestionnaireScreen.getNextButtonText(code) ||
        question.type !== 'choice' ||
        !question.multiple
      ) {
        return ok(screen.stale(question, 'stale_button', this.state.answers));
      }
      const draftCodes = splitAnswerCodes(this.state.draftAnswers[code]);
      if (draftCodes.length === 0) {
        return ok(
          screen.stale(question, 'empty_selection', this.state.answers),
        );
      }
      return this.submit(at, question, draftCodes.join(','), draftCodes);
    }

    if (question.type === 'text') {
      return ok(screen.stale(question, 'stale_button', this.state.answers));
    }
    if (value === '') return EMPTY_ANSWER_CODE.err();
    if (!screen.isKnownAnswerCode(question, value)) {
      return ok(screen.stale(question, 'stale_button', this.state.answers));
    }
    if (question.multiple) return this.toggleDraftAnswer(at, question, value);
    return this.submit(at, question, value, [value]);
  }

  /** Ступень обхода простоя: приглашение, предупреждение или закрытие. */
  sweepIdle(at: Timestamp): Result<void, ErrorOf<typeof NOT_ACTIVE>> {
    const status = this.state.status;
    if (status === 'completed' || status === 'abandoned') return ok();
    const idle = this.idleFor(at);
    if (idle >= ABANDON_AFTER_IDLE_MS) return this.abandon(at, 'timeout');
    if (status === 'invited') return ok();
    if (idle >= WARN_AFTER_IDLE_MS) {
      if (this.state.warnedAt !== undefined) return ok();
      return this.change(this.lastActivityAt(), (draft, emit) => {
        draft.warnedAt = at;
        emit(QuestionnaireEvents.abandonWarning.make(this.ref()));
        return ok();
      });
    }
    if (idle >= INVITE_AFTER_IDLE_MS) {
      if (this.state.continueInvitedAt !== undefined) return ok();
      return this.change(this.lastActivityAt(), (draft, emit) => {
        draft.continueInvitedAt = at;
        emit(QuestionnaireEvents.continueInvite.make(this.ref()));
        return ok();
      });
    }
    return ok();
  }

  // ── Внутреннее ──

  /** Переключение выбора multiple-вопроса в черновике. */
  private toggleDraftAnswer(
    at: Timestamp,
    question: ChoiceQuestion,
    answerCode: string,
  ): Result<QuestionnaireActionResponse, never> {
    const code = question.questionCode;
    const current = splitAnswerCodes(this.state.draftAnswers[code]);
    const next = current.includes(answerCode)
      ? current.filter((item) => item !== answerCode)
      : [...current, answerCode];
    const draftAnswers = { ...this.state.draftAnswers };
    if (next.length === 0) delete draftAnswers[code];
    else draftAnswers[code] = next.join(',');
    const response = this.screenBuilder().waitNext(
      question,
      next,
      this.state.answers,
    );
    return this.change(at, (draft) => {
      draft.draftAnswers = draftAnswers;
      return ok(response);
    });
  }

  /** Фиксация ответа: следующий вопрос или завершение анкеты. */
  private submit(
    at: Timestamp,
    question: Question,
    rawValue: string,
    selected: string[],
  ): Result<QuestionnaireActionResponse, ActionError> {
    const code = question.questionCode;
    const parsed = v.safeParse(
      this.engine.buildValidationSchema(code),
      question.type === 'choice' && question.multiple ? selected : rawValue,
    );
    if (!parsed.success) {
      return ok(
        this.screenBuilder().stale(
          question,
          question.type === 'choice' && question.multiple
            ? 'empty_selection'
            : 'stale_button',
          this.state.answers,
        ),
      );
    }
    const answerCode =
      question.type === 'choice' && question.multiple
        ? selected.join(',')
        : String(parsed.output);
    const entry: AnswerVo =
      question.type === 'text'
        ? {
            questionCode: code,
            answerCode: 'text',
            answerText: String(parsed.output),
            answeredAt: at,
          }
        : { questionCode: code, answerCode, answeredAt: at };
    const answers = [...this.state.answers, entry];
    const next = this.engine.getNextQuestion(code, answers);

    if (next !== null) {
      const response = this.screenBuilder().afterAnswer(
        question,
        selected,
        next,
        answers,
      );
      return this.change(at, (draft) => {
        draft.answers.push(entry);
        delete draft.draftAnswers[code];
        draft.currentQuestionCode = next.questionCode;
        return ok(response);
      });
    }

    const response = this.screenBuilder().afterLastAnswer(question, selected);
    return this.transition('complete', at, (draft, emit) => {
      draft.answers.push(entry);
      delete draft.draftAnswers[code];
      draft.currentQuestionCode = null;
      draft.completedAt = at;
      emit(this.completedEvent(draft.answers));
      return ok(response);
    });
  }

  /** Сброс флагов простоя при активности: `updatedAt` не сдвигается. */
  private resetIdleFlags(): void {
    if (
      this.state.warnedAt === undefined &&
      this.state.continueInvitedAt === undefined
    ) {
      return;
    }
    this.change(this.lastActivityAt(), (draft) => {
      delete draft.warnedAt;
      delete draft.continueInvitedAt;
      return ok();
    });
  }

  private completedEvent(answers: AnswerVo[]): QuestionnaireEvent {
    if (this.state.kind === 'likert') {
      return QuestionnaireEvents.completed.make({
        ...refOf(this.state),
        likertScores: this.likertScores(answers),
      });
    }
    return QuestionnaireEvents.completed.make(refOf(this.state));
  }

  /** Средневзвешенные баллы по подкатегориям: Σ(ответ × вес) / Σ(вес). */
  private likertScores(answers: AnswerVo[]): LikertScore[] {
    if (this.state.kind !== 'likert') return [];
    const questions = new Map(
      this.state.questionPool.questions.map((q) => [q.questionCode, q]),
    );
    const groups = new Map<
      string,
      {
        category: string;
        subcategory: string;
        weighted: number;
        weight: number;
      }
    >();
    for (const answer of answers) {
      const question = questions.get(answer.questionCode);
      if (question === undefined) continue;
      const score = Number(answer.answerCode);
      if (!Number.isFinite(score)) continue;
      const { category, subcategory, weight } = (question as LikertQuestion)
        .likertMapping;
      const key = `${category}\u0000${subcategory}`;
      const group = groups.get(key) ?? {
        category,
        subcategory,
        weighted: 0,
        weight: 0,
      };
      group.weighted += score * weight;
      group.weight += weight;
      groups.set(key, group);
    }
    const scores = [...groups.values()]
      .filter((group) => group.weight > 0)
      .map((group) => ({
        category: group.category,
        subcategory: group.subcategory,
        score: group.weighted / group.weight,
      }));
    return v.parse(v.array(LikertScoreSchema), scores);
  }

  /** Код текущего вопроса; анкета в работе без вопроса — дефект записи. */
  private currentQuestionCode(): string {
    const code = this.state.currentQuestionCode;
    if (code === null) {
      // biome-ignore lint/plugin: нарушен инвариант «in_progress ⇒ currentQuestionCode» записи — это дефект данных, а не отказ операции
      throw new Error(
        `Анкета ${this.state.uuid}: статус in_progress без текущего вопроса`,
      );
    }
    return code;
  }

  private lastActivityAt(): Timestamp {
    return this.state.updatedAt ?? this.state.createdAt;
  }

  private ref(): QuestionnaireRef {
    return refOf(this.state);
  }

  private screenBuilder(): QuestionnaireScreen {
    return new QuestionnaireScreen(this.state, this.engine);
  }
}

function refOf<K extends QuestionnaireRef['kind']>(
  state: Extract<QuestionnaireState, { kind: K }>,
): QuestionnaireRef & { readonly kind: K } {
  return {
    questionnaireId: state.uuid,
    respondentId: state.respondentId,
    kind: state.kind,
    ownerInfo: state.ownerInfo,
  };
}

/** Первый вопрос пула; пул без показываемого вопроса — дефект данных. */
function firstQuestion(engine: QuestionnaireEngine): Question {
  const first = engine.getNextQuestion(null, []);
  if (first === null) {
    // biome-ignore lint/plugin: пул без первого вопроса — дефект данных, а не отказ операции
    throw new Error('Пул анкеты не содержит показываемого первого вопроса');
  }
  return first;
}

function buildEngine(state: QuestionnaireState): QuestionnaireEngine {
  if (state.kind === 'likert') {
    return new QuestionnaireEngine(
      (state.questionPool as LikertQuestionPool).questions.map(
        toChoiceQuestion,
      ),
    );
  }
  return new QuestionnaireEngine(
    (state.questionPool as QuestionnairePool).questions,
  );
}

function toChoiceQuestion(question: LikertQuestion): ChoiceQuestion {
  return {
    question: question.question,
    questionCode: question.questionCode,
    type: 'choice',
    multiple: false,
    answers: [...LIKERT_SCALE],
  };
}
