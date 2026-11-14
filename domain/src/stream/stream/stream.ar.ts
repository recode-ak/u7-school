import type { ContentSnapshot } from '@u7-scl/domain/course/contract';
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
import { StreamErrors } from './stream.errors';
import { StreamEvents } from './stream.events';
import { StreamState } from './stream.state';
import type { StepPlace } from './stream.types';

const {
  NOT_ENROLLING,
  NOT_ACTIVE,
  NOT_COMPLETED,
  ALREADY_ARCHIVED,
  CONTENT_NOT_SYNCABLE,
} = StreamErrors;

/**
 * Статусы, в которых снимок контента можно заменить (F-80, ФР-1). Это не
 * переход статуса, поэтому не в `transitions`.
 */
const SYNCABLE_STATUSES: readonly string[] = ['enrollment', 'active'];

/** Число шагов снимка: дубликат `stepId` считается один раз, как в `stepPlace`. */
function stepCount(snapshot: ContentSnapshot): number {
  return new Set(snapshot.flatMap((p) => p.lessons.flatMap((l) => l.stepIds)))
    .size;
}

/** Ключ снимка по значению: только поля схемы в фиксированном порядке. */
function snapshotKey(snapshot: ContentSnapshot): string {
  return JSON.stringify(
    snapshot.map((p) => [
      p.projectId,
      p.projectTitle,
      p.lessons.map((l) => [l.lessonId, l.lessonTitle, l.stepIds]),
    ]),
  );
}

export const StreamArDef = AggregateDef.define({
  name: 'stream',
  label: 'Поток',
  description:
    'Поток обучения по модулю курса: набор, занятия, завершение и архив.',
  state: StreamState,
  statuses: {
    enrollment: { label: 'Набор' },
    active: { label: 'Идёт' },
    completed: { label: 'Завершён' },
    archived: { label: 'В архиве' },
  },
  transitions: {
    activate: {
      from: ['enrollment'],
      to: 'active',
      rejects: {
        active: NOT_ENROLLING,
        completed: NOT_ENROLLING,
        archived: NOT_ENROLLING,
      },
    },
    complete: {
      from: ['active'],
      to: 'completed',
      rejects: {
        enrollment: NOT_ACTIVE,
        completed: NOT_ACTIVE,
        archived: NOT_ACTIVE,
      },
    },
    archive: {
      from: ['completed'],
      to: 'archived',
      rejects: {
        enrollment: NOT_COMPLETED,
        active: NOT_COMPLETED,
        archived: ALREADY_ARCHIVED,
      },
    },
  },
  events: StreamEvents,
  errors: StreamErrors,
});

export type StreamError = ErrorsOf<typeof StreamArDef>;
type StreamEvent = EventsOf<typeof StreamArDef>;

/**
 * Поток наружу: state без кодового слова — вместо него признак
 * `requiresEnrollmentKey`. Сам ключ проверяет только зачисление.
 */
export const StreamView = v.object({
  ...v.omit(StreamState, ['enrollmentKey']).entries,
  requiresEnrollmentKey: F.boolean('Для зачисления нужно кодовое слово'),
});

export type StreamView = v.InferOutput<typeof StreamView>;

/** Вход создания: поля state, которые задаёт вызывающий; статус — всегда набор. */
export type CreateStream = Omit<
  StreamState,
  'status' | 'createdAt' | 'updatedAt' | 'version'
>;

/**
 * Агрегат Stream — учебный поток.
 *
 * Жизненный цикл (правила — в `StreamArDef.transitions`): набор → идёт →
 * завершён → архив. Завершение требует исходов у всех студентов — это
 * инвариант двух агрегатов (`StreamRules.rules.studentsSettled`).
 * Снимок контента отвечает на вопросы студента: первый шаг, место шага.
 */
export class StreamAr extends Aggregate<typeof StreamArDef, StreamView> {
  private constructor(state: StreamState, events?: readonly StreamEvent[]) {
    super(StreamArDef, state, events);
  }

  /**
   * Новый поток сразу в наборе: создание и открытие набора — один факт,
   * событие `created`.
   */
  static create(input: CreateStream, at: Timestamp): Result<StreamAr, never> {
    const state: StreamState = {
      ...StreamAr.newState(input.uuid, at),
      ...input,
      status: 'enrollment',
    };
    const created = StreamEvents.created.make({
      streamId: input.uuid,
      moduleId: input.moduleId,
    });
    return ok(new StreamAr(state, [created]));
  }

  /** Восстановление из хранилища — запись разобрана `StreamArDef.state`. */
  static restore(snapshot: StreamState): StreamAr {
    return new StreamAr(snapshot);
  }

  // ── Вопросы ──

  /** Ведёт ли поток этот ментор. */
  isMentoredBy(userId: string): boolean {
    return this.state.mentorId === userId;
  }

  /**
   * Первый шаг потока: первый шаг первого урока, в котором шаги есть.
   * `undefined` — в потоке нет шагов.
   */
  firstStepId(): string | undefined {
    for (const project of this.state.contentSnapshot) {
      for (const lesson of project.lessons) {
        if (lesson.stepIds.length > 0) return lesson.stepIds[0];
      }
    }
    return undefined;
  }

  /** Допустим ли запуск в текущем статусе — по `StreamArDef.transitions.activate.from`. */
  canActivate(): boolean {
    return this.allows('activate');
  }

  /** Допустимо ли завершение в текущем статусе. */
  canComplete(): boolean {
    return this.allows('complete');
  }

  /** Допустим ли перенос в архив в текущем статусе. */
  canArchive(): boolean {
    return this.allows('archive');
  }

  /**
   * Поток в наборе: студент может записаться. Сегодня совпадает с
   * `canActivate()`, но смысл другой (запись студента, а не запуск).
   */
  isEnrolling(): boolean {
    return this.canActivate();
  }

  /** Модуль, по которому идёт поток. */
  moduleId(): string {
    return this.state.moduleId;
  }

  /** Принимает ли поток введённое кодовое слово; слова у потока нет — принимает любое. */
  acceptsEnrollmentKey(key?: string): boolean {
    const expected = this.state.enrollmentKey;
    return expected === undefined || expected === key;
  }

  /** Есть ли шаг в снимке контента потока. */
  hasStep(stepId: string): boolean {
    return this.state.contentSnapshot.some((project) =>
      project.lessons.some((lesson) => lesson.stepIds.includes(stepId)),
    );
  }

  /**
   * Шаги запрошенных уроков по снимку: `lessonId → stepIds` в порядке запроса;
   * урока нет в снимке — нет и ключа.
   */
  lessonSteps(lessonIds: readonly string[]): ReadonlyMap<string, string[]> {
    const inSnapshot = new Map(
      this.state.contentSnapshot.flatMap((project) =>
        project.lessons.map((lesson) => [lesson.lessonId, lesson.stepIds]),
      ),
    );
    const result = new Map<string, string[]>();
    for (const lessonId of lessonIds) {
      const stepIds = inSnapshot.get(lessonId);
      if (stepIds !== undefined) result.set(lessonId, [...stepIds]);
    }
    return result;
  }

  /**
   * Место шага в снимке контента: следующий шаг (по порядку обхода проектов
   * и уроков), урок и проект шага, последний ли он в уроке, последний ли
   * урок в проекте. `undefined` — шага в снимке нет.
   */
  stepPlace(stepId: string): StepPlace | undefined {
    const order = this.state.contentSnapshot.flatMap((project) =>
      project.lessons.flatMap((lesson) => lesson.stepIds),
    );
    const index = order.indexOf(stepId);
    if (index === -1) return undefined;
    const nextStepId = order[index + 1];
    for (const project of this.state.contentSnapshot) {
      for (const [li, lesson] of project.lessons.entries()) {
        const at = lesson.stepIds.indexOf(stepId);
        if (at === -1) continue;
        return {
          ...(nextStepId !== undefined && { nextStepId }),
          lessonId: lesson.lessonId,
          projectId: project.projectId,
          lastInLesson: at === lesson.stepIds.length - 1,
          lastLessonInProject: li === project.lessons.length - 1,
        };
      }
    }
    return undefined;
  }

  /** Состояние наружу: копия без кодового слова, с признаком его наличия. */
  override view(): StreamView {
    const { enrollmentKey, ...rest } = structuredClone(this.state);
    return { ...rest, requiresEnrollmentKey: Boolean(enrollmentKey) };
  }

  /** Можно ли заменить снимок контента: поток в наборе или идёт (ФР-1). */
  canSyncContent(): boolean {
    return SYNCABLE_STATUSES.includes(this.state.status);
  }

  private allows(op: keyof typeof StreamArDef.transitions): boolean {
    const from: readonly string[] = StreamArDef.transitions[op].from;
    return from.includes(this.state.status);
  }

  // ── Переходы ──

  /** Запуск: набор → идёт. */
  activate(
    at: Timestamp,
  ): Result<void, RejectOf<typeof StreamArDef, 'activate'>> {
    return this.transition('activate', at, () => ok());
  }

  /** Завершение: идёт → завершён. Исходы студентов проверяет правило. */
  complete(
    at: Timestamp,
  ): Result<void, RejectOf<typeof StreamArDef, 'complete'>> {
    return this.transition('complete', at, () => ok());
  }

  /** Архив: завершён → в архиве. */
  archive(
    at: Timestamp,
  ): Result<void, RejectOf<typeof StreamArDef, 'archive'>> {
    return this.transition('archive', at, () => ok());
  }

  /**
   * Замена снимка контента (F-80): событие `contentSynced` со счётчиками
   * шагов. Снимок совпадает по значению — `unchanged` без изменений.
   * Судьбу студентов решает `StreamContentSyncDcs` до вызова.
   */
  replaceContent(
    snapshot: ContentSnapshot,
    at: Timestamp,
  ): Result<'replaced' | 'unchanged', ErrorOf<typeof CONTENT_NOT_SYNCABLE>> {
    if (!this.canSyncContent()) return CONTENT_NOT_SYNCABLE.err();
    const before = this.state.contentSnapshot;
    if (snapshotKey(before) === snapshotKey(snapshot)) return ok('unchanged');
    return this.change(at, (draft, emit) => {
      draft.contentSnapshot = structuredClone(snapshot);
      emit(
        StreamEvents.contentSynced.make({
          streamId: this.state.uuid,
          moduleId: this.state.moduleId,
          stepsBefore: stepCount(before),
          stepsAfter: stepCount(snapshot),
        }),
      );
      return ok('replaced');
    });
  }
}
