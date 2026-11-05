import {
  Aggregate,
  AggregateDef,
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

const { NOT_ENROLLING, NOT_ACTIVE, NOT_COMPLETED, ALREADY_ARCHIVED } =
  StreamErrors;

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

  /** Модуль, по которому идёт поток. */
  moduleId(): string {
    return this.state.moduleId;
  }

  /** Принимает ли поток введённое кодовое слово; слова у потока нет — принимает любое. */
  acceptsEnrollmentKey(key?: string): boolean {
    const expected = this.state.enrollmentKey;
    return expected === undefined || expected === key;
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
}
