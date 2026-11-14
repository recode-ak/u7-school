import {
  Aggregate,
  AggregateDef,
  type ErrorOf,
  type ErrorsOf,
  type EventsOf,
  F,
  ok,
  type RejectOf,
  type Result,
  type Timestamp,
} from 'dmg-core';
import * as v from 'valibot';
import { StudentErrors } from './student.errors';
import { StudentEvents } from './student.events';
import { type StudentNoticeKind, StudentState } from './student.state';
import {
  NOTICE_EVERY_DAYS,
  type OutcomeCategory,
  OutcomeCategoryVo,
  type OutcomeSign,
  OutcomeSignVo,
  REMOVE_AFTER_DAYS,
  WARN_AFTER_DAYS,
} from './student.types';

const {
  NOT_ENROLLED,
  NOT_STUDYING,
  NOT_COMPLETABLE,
  STEP_ALREADY_ISSUED,
  STEP_NOT_ISSUED,
} = StudentErrors;

export const StudentArDef = AggregateDef.define({
  name: 'student',
  label: 'Студент',
  description:
    'Участие пользователя в потоке: зачисление, прохождение шагов модуля и исход (завершил или ушёл).',
  state: StudentState,
  statuses: {
    enrolled: { label: 'Зачислен' },
    active: { label: 'Учится' },
    abandoned: { label: 'Ушёл' },
    advanced: { label: 'Прошёл' },
    not_advanced: { label: 'Не прошёл' },
  },
  transitions: {
    activate: {
      from: ['enrolled'],
      to: 'active',
      rejects: {
        active: NOT_ENROLLED,
        abandoned: NOT_ENROLLED,
        advanced: NOT_ENROLLED,
        not_advanced: NOT_ENROLLED,
      },
    },
    drop: {
      from: ['enrolled', 'active'],
      to: 'abandoned',
      rejects: {
        abandoned: NOT_STUDYING,
        advanced: NOT_STUDYING,
        not_advanced: NOT_STUDYING,
      },
    },
    abandon: {
      from: ['enrolled', 'active'],
      to: 'abandoned',
      rejects: {
        abandoned: NOT_STUDYING,
        advanced: NOT_STUDYING,
        not_advanced: NOT_STUDYING,
      },
    },
    advance: {
      from: ['active', 'advanced', 'not_advanced'],
      to: 'advanced',
      rejects: { enrolled: NOT_COMPLETABLE, abandoned: NOT_COMPLETABLE },
    },
    notAdvance: {
      from: ['active', 'advanced', 'not_advanced'],
      to: 'not_advanced',
      rejects: { enrolled: NOT_COMPLETABLE, abandoned: NOT_COMPLETABLE },
    },
  },
  events: StudentEvents,
  errors: StudentErrors,
});

export type StudentError = ErrorsOf<typeof StudentArDef>;
type StudentEvent = EventsOf<typeof StudentArDef>;

/**
 * Студент наружу: state без маркеров уведомлений плюс ответы вопросов агрегата.
 * Клиенты не разбирают `status` сами (ФР-1, ФР-10).
 */
export const StudentView = v.pipe(
  v.object({
    ...v.omit(StudentState, ['notices']).entries,
    outcome: v.pipe(
      v.object({
        category: OutcomeCategoryVo,
        signs: v.pipe(
          v.array(OutcomeSignVo),
          v.description('Признаки исхода: завершения или ухода'),
        ),
      }),
      v.description('Категория и признаки исхода студента'),
    ),
    inProgress: F.boolean('студент учится или только зачислен'),
    enrolled: F.boolean('студент зачислен и ещё не начал учиться'),
    neverStarted: F.boolean('выбывший студент не завершил ни одного шага'),
    passed: F.boolean('студент прошёл модуль (advanced)'),
  }),
  v.description('Студент потока: запись, исход и ответы вопросов агрегата'),
);

export type StudentView = v.InferOutput<typeof StudentView>;

/** Вход зачисления: идентификаторы, шаг `firstStepId` — первый шаг потока. */
export type EnrollStudent = {
  readonly uuid: string;
  readonly streamId: string;
  readonly userId: string;
  readonly moduleId: string;
  readonly firstStepId: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * Агрегат Student — запись пользователя на потоке: выдача и завершение шагов,
 * исход и уведомления о бездействии.
 *
 * Жизненный цикл — в `StudentArDef.transitions`. Правила зачисления,
 * затрагивающие поток и другие записи пользователя, — `StudentRules` (D-40).
 */
export class StudentAr extends Aggregate<typeof StudentArDef, StudentView> {
  private constructor(state: StudentState, events?: readonly StudentEvent[]) {
    super(StudentArDef, state, events);
  }

  /** Зачисление: студент `enrolled`, шагов нет, текущий — первый; событие `enrolled`. */
  static enroll(input: EnrollStudent, at: Timestamp): Result<StudentAr, never> {
    const { uuid, streamId, userId, moduleId, firstStepId } = input;
    const state: StudentState = {
      ...StudentAr.newState(uuid, at),
      streamId,
      userId,
      enrolledAt: at,
      status: 'enrolled',
      currentStepId: firstStepId,
      steps: [],
    };
    const enrolled = StudentEvents.enrolled.make({
      studentId: uuid,
      userId,
      streamId,
      moduleId,
    });
    return ok(new StudentAr(state, [enrolled]));
  }

  /** Восстановление из хранилища — запись разобрана `StudentArDef.state`. */
  static restore(snapshot: StudentState): StudentAr {
    return new StudentAr(snapshot);
  }

  // ── Вопросы ──

  /** Принадлежит ли запись пользователю. */
  isOwnedBy(userId: string): boolean {
    return this.state.userId === userId;
  }

  /** Относится ли запись к потоку. */
  belongsToStream(streamId: string): boolean {
    return this.state.streamId === streamId;
  }

  /**
   * Категория исхода: завершил / забросил / учится. Единственная точка
   * знания «статус → категория».
   */
  outcomeCategory(): OutcomeCategory {
    switch (this.state.status) {
      case 'advanced':
      case 'not_advanced':
        return 'completed';
      case 'abandoned':
        return 'abandoned';
      case 'enrolled':
      case 'active':
        return 'in_progress';
    }
  }

  /** Запись «живая»: учится или только зачислен. */
  isInProgress(): boolean {
    return this.outcomeCategory() === 'in_progress';
  }

  /** Зачислен и ещё не начал учиться. */
  isEnrolled(): boolean {
    return this.state.status === 'enrolled';
  }

  /** Судьба разрешена: завершил или ушёл (инвариант завершения потока). */
  isTerminal(): boolean {
    return !this.isInProgress();
  }

  /** Прошёл модуль (`advanced`) — основание записи на следующий; `not_advanced` не «прошёл». */
  isPassed(): boolean {
    return this.state.status === 'advanced';
  }

  /** Шаг, на котором студент сейчас. */
  currentStepId(): string {
    return this.state.currentStepId;
  }

  /** Шаг уже выдан студенту (выдан или завершён). */
  hasIssued(stepId: string): boolean {
    return this.state.steps.some((step) => step.stepId === stepId);
  }

  /** Шаг уже завершён студентом. */
  hasCompleted(stepId: string): boolean {
    return this.state.steps.some(
      (step) => step.stepId === stepId && step.status === 'completed',
    );
  }

  /** Студенту не выдан ни один шаг (статус не важен). */
  hasNoSteps(): boolean {
    return this.state.steps.length === 0;
  }

  /** Выбывший без единого завершённого им самим шага (зачёт синхронизацией не в счёт). */
  neverStarted(): boolean {
    return (
      this.outcomeCategory() === 'abandoned' &&
      !this.ownSteps().some((step) => step.status === 'completed')
    );
  }

  /**
   * Признаки исхода: завершения — для завершивших, ухода — для выбывших.
   * «Не начал» сочетается с причиной ухода.
   */
  outcomeSigns(): OutcomeSign[] {
    switch (this.outcomeCategory()) {
      case 'completed':
        return [this.state.status === 'advanced' ? 'passed' : 'not_passed'];
      case 'abandoned': {
        // Legacy-запись abandoned без abandonDetails — без признака причины
        const cause = this.state.abandonDetails?.cause;
        const signs: OutcomeSign[] = [];
        if (this.neverStarted()) signs.push('never_started');
        if (cause === 'voluntary') signs.push('left_voluntarily');
        else if (cause === 'by_mentor' || cause === 'inactivity') {
          signs.push('removed_by_mentor');
        }
        return signs;
      }
      case 'in_progress':
        return [];
    }
  }

  /**
   * Время последней активности: максимум по шагам из `completedAt`,
   * иначе `issuedAt`; зачтённые синхронизацией — не активность (ФР-6а).
   * `undefined` — своих шагов нет.
   */
  lastActivityAt(): Timestamp | undefined {
    let latest: Timestamp | undefined;
    for (const step of this.ownSteps()) {
      const at = step.completedAt ?? step.issuedAt;
      if (latest === undefined || at > latest) latest = at;
    }
    return latest;
  }

  /**
   * Пора ли уведомить о бездействии: студент учится и пришло время хотя бы
   * одного уведомления — студенту или ментору.
   */
  needsInactivityNotice(at: Timestamp): boolean {
    const due = this.dueNotices(at);
    return due.student || due.mentor;
  }

  /** Состояние наружу: state без `notices` и ответы вопросов. */
  override view(): StudentView {
    const { notices: _, ...rest } = structuredClone(this.state);
    return {
      ...rest,
      outcome: {
        category: this.outcomeCategory(),
        signs: this.outcomeSigns(),
      },
      inProgress: this.isInProgress(),
      enrolled: this.isEnrolled(),
      neverStarted: this.neverStarted(),
      passed: this.isPassed(),
    };
  }

  // ── Переходы ──

  /** Активация: зачислен → учится; сбрасывает цепочку уведомлений о бездействии. */
  activate(
    at: Timestamp,
  ): Result<void, RejectOf<typeof StudentArDef, 'activate'>> {
    return this.transition('activate', at, (draft) => {
      draft.notices = [];
      return ok();
    });
  }

  /** Самовыход из учёбы: зачислен | учится → ушёл `{ self, voluntary }`; событие `abandoned`. */
  drop(at: Timestamp): Result<void, RejectOf<typeof StudentArDef, 'drop'>> {
    return this.transition('drop', at, (draft, emit) => {
      draft.abandonDetails = { who: 'self', cause: 'voluntary' };
      emit(
        StudentEvents.abandoned.make({
          ...this.ref(),
          who: 'self',
          cause: 'voluntary',
        }),
      );
      return ok();
    });
  }

  /** Снятие с учёбы: зачислен | учится → ушёл `{ mentor, cause }`; событие `abandoned`. */
  markAbandoned(
    cause: 'inactivity' | 'by_mentor',
    at: Timestamp,
  ): Result<void, RejectOf<typeof StudentArDef, 'abandon'>> {
    return this.transition('abandon', at, (draft, emit) => {
      draft.abandonDetails = { who: 'mentor', cause };
      emit(
        StudentEvents.abandoned.make({
          ...this.ref(),
          who: 'mentor',
          cause,
        }),
      );
      return ok();
    });
  }

  /**
   * Исход модуля: учится | уже завершил → прошёл или не прошёл (исход можно
   * сменить); `nextPreference` сбрасывается в `undecided`; событие `completed`.
   */
  complete(
    outcome: 'advanced' | 'not_advanced',
    moduleId: string,
    at: Timestamp,
  ): Result<void, RejectOf<typeof StudentArDef, 'advance' | 'notAdvance'>> {
    const op = outcome === 'advanced' ? 'advance' : 'notAdvance';
    return this.transition(op, at, (draft, emit) => {
      draft.completionDetails = { nextPreference: 'undecided' };
      emit(StudentEvents.completed.make({ ...this.ref(), moduleId, outcome }));
      return ok();
    });
  }

  /** Выдача шага: запись `issued`, шаг становится текущим. Повторная выдача — отказ. */
  issueStep(
    stepId: string,
    at: Timestamp,
  ): Result<void, ErrorOf<typeof STEP_ALREADY_ISSUED>> {
    if (this.hasIssued(stepId)) return STEP_ALREADY_ISSUED.err();
    return this.change(at, (draft) => {
      draft.steps.push({ stepId, status: 'issued', issuedAt: at });
      draft.currentStepId = stepId;
      return ok();
    });
  }

  /**
   * Завершение шага и выдача следующего (если он ещё не выдан).
   * Повтор завершённого шага — `already_completed` без изменений; следующего
   * шага нет — `finished`. Возобновление учёбы сбрасывает уведомления.
   */
  completeStep(
    stepId: string,
    nextStepId: string | undefined,
    at: Timestamp,
  ): Result<
    'completed' | 'already_completed' | 'finished',
    ErrorOf<typeof STEP_NOT_ISSUED>
  > {
    const record = this.state.steps.find((step) => step.stepId === stepId);
    if (record === undefined) return STEP_NOT_ISSUED.err();
    if (record.status === 'completed') return ok('already_completed');
    return this.change(at, (draft) => {
      const target = draft.steps.find((step) => step.stepId === stepId);
      if (target === undefined) return STEP_NOT_ISSUED.err();
      target.status = 'completed';
      target.completedAt = at;
      draft.notices = [];
      if (nextStepId === undefined) return ok('finished');
      if (!draft.steps.some((step) => step.stepId === nextStepId)) {
        draft.steps.push({
          stepId: nextStepId,
          status: 'issued',
          issuedAt: at,
        });
        draft.currentStepId = nextStepId;
      }
      return ok('completed');
    });
  }

  /**
   * Зачёт шага синхронизацией контента (F-80, ФР-3): запись становится
   * `completed` с пометкой `content_sync` (нет записи — создаётся). Текущий
   * шаг, уведомления и события не меняются; завершённый — `already_credited`.
   */
  creditStep(
    stepId: string,
    at: Timestamp,
  ): Result<'credited' | 'already_credited', never> {
    if (this.hasCompleted(stepId)) return ok('already_credited');
    return this.change(at, (draft) => {
      const target = draft.steps.find((step) => step.stepId === stepId);
      if (target === undefined) {
        draft.steps.push({
          stepId,
          status: 'completed',
          issuedAt: at,
          completedAt: at,
          completionSource: 'content_sync',
        });
      } else {
        target.status = 'completed';
        target.completedAt = at;
        target.completionSource = 'content_sync';
      }
      return ok('credited');
    });
  }

  /**
   * Уведомления о бездействии: студенту с 5-го дня, ментору с 7-го, затем
   * каждые 2 дня (цепочки независимы). Ставит маркеры с временем до минуты и
   * публикует `inactivityWarning` / `inactivityRemoveCandidate`; `wasWarned` —
   * был ли маркер студента до этого прогона. Нечего слать — без изменений.
   */
  noticeInactivity(at: Timestamp): Result<void, never> {
    const due = this.dueNotices(at);
    if (!due.student && !due.mentor) return ok();
    const wasWarned =
      this.lastNoticeAt('inactivity_warn_student') !== undefined;
    const sentAt = Math.floor(at / MINUTE_MS) * MINUTE_MS;
    return this.change(at, (draft, emit) => {
      const sent: StudentNoticeKind[] = [];
      if (due.student) sent.push('inactivity_warn_student');
      if (due.mentor) sent.push('inactivity_warn_mentor');
      // Последняя запись по виду единственная значимая: историю не копим
      draft.notices = [
        ...(draft.notices ?? []).filter((n) => !sent.includes(n.kind)),
        ...sent.map((kind) => ({ kind, sentAt })),
      ];
      const ids = this.ref();
      if (due.student) {
        emit(StudentEvents.inactivityWarning.make({ ...ids, days: due.days }));
      }
      if (due.mentor) {
        emit(
          StudentEvents.inactivityRemoveCandidate.make({
            ...ids,
            days: due.days,
            wasWarned,
          }),
        );
      }
      return ok();
    });
  }

  // ── Служебное ──

  private ref(): { studentId: string; userId: string; streamId: string } {
    return {
      studentId: this.state.uuid,
      userId: this.state.userId,
      streamId: this.state.streamId,
    };
  }

  /** Записи шагов без зачтённых синхронизацией: работа самого студента. */
  private ownSteps(): StudentState['steps'] {
    return this.state.steps.filter(
      (step) => step.completionSource === undefined,
    );
  }

  private lastNoticeAt(kind: StudentNoticeKind): Timestamp | undefined {
    return this.state.notices?.find((n) => n.kind === kind)?.sentAt;
  }

  /** Полных дней без активности: от последнего шага, иначе от зачисления. */
  private inactiveDays(at: Timestamp): number {
    const from = this.lastActivityAt() ?? this.state.enrolledAt;
    return Math.floor((at - from) / DAY_MS);
  }

  /** Настало ли время уведомления вида `kind`: маркера нет или прошло ≥ периода. */
  private noticeDue(kind: StudentNoticeKind, at: Timestamp): boolean {
    const last = this.lastNoticeAt(kind);
    return (
      last === undefined ||
      Math.floor((at - last) / DAY_MS) >= NOTICE_EVERY_DAYS
    );
  }

  private dueNotices(at: Timestamp): {
    days: number;
    student: boolean;
    mentor: boolean;
  } {
    const days = this.inactiveDays(at);
    const studying = this.isInProgress() && days >= WARN_AFTER_DAYS;
    return {
      days,
      student: studying && this.noticeDue('inactivity_warn_student', at),
      mentor:
        studying &&
        days >= REMOVE_AFTER_DAYS &&
        this.noticeDue('inactivity_warn_mentor', at),
    };
  }
}
