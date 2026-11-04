import { type ErrorOf, ok, type Result, type Timestamp } from 'dmg-core';
import type { StreamAr } from './stream/stream.ar';
import type { StepPlace } from './stream/stream.types';
import type { StudentAr } from './student/student.ar';
import { StudentErrors } from './student/student.errors';
import type { CompletionResult } from './student/student.types';

type StepCompletionError =
  | ErrorOf<typeof StudentErrors.STEP_NOT_IN_STREAM>
  | ErrorOf<typeof StudentErrors.STEP_NOT_ISSUED>
  | ErrorOf<typeof StudentErrors.STEP_ALREADY_ISSUED>;

/** Уровень перехода после шага: следующий шаг, урок или проект. */
function transitionAfter(
  place: StepPlace,
  nextStepId: string,
): CompletionResult {
  if (place.lastInLesson && place.lastLessonInProject) {
    return {
      level: 'project',
      currentStepId: nextStepId,
      completedProjectId: place.projectId,
    };
  }
  if (place.lastInLesson) {
    return {
      level: 'lesson',
      currentStepId: nextStepId,
      completedLessonId: place.lessonId,
    };
  }
  return { level: 'step', currentStepId: nextStepId };
}

/**
 * Завершение шага студентом в потоке: меняет студента по снимку контента
 * потока и определяет уровень перехода (шаг, урок, проект, поток).
 */
export const StepCompletionDcs = {
  /**
   * Завершает шаг и выдаёт следующий. Место шага в потоке спрашивается до
   * `student.completeStep`: шаг вне потока — отказ раньше «не выдан».
   * Повтор завершённого шага — `already_completed`, кроме «хвоста»
   * расширенного снимка (`issueTail`). Последний шаг потока — уровень
   * `stream`; исход студента указывает ментор.
   */
  completeStep(
    stream: StreamAr,
    student: StudentAr,
    stepId: string,
    at: Timestamp,
  ): Result<CompletionResult, StepCompletionError> {
    const place = stream.stepPlace(stepId);
    if (place === undefined) {
      return StudentErrors.STEP_NOT_IN_STREAM.err();
    }
    const done = student.completeStep(stepId, place.nextStepId, at);
    if (!done.ok) return done;
    if (done.value === 'already_completed') {
      return StepCompletionDcs.issueTail(stream, student, place, at);
    }
    if (done.value === 'finished' || place.nextStepId === undefined) {
      return ok({ level: 'stream', completed: true });
    }
    return ok(transitionAfter(place, place.nextStepId));
  },

  /**
   * «Хвост» расширенного снимка: студент завершил все выданные шаги, когда
   * следующего в снимке ещё не было, а потом снимок расширили. Если текущий
   * шаг студента завершён, после него в снимке есть шаг и он не выдан —
   * выдаёт его, уровень перехода — по месту завершённого шага `place`. Иначе —
   * обычный `already_completed`.
   */
  issueTail(
    stream: StreamAr,
    student: StudentAr,
    place: StepPlace,
    at: Timestamp,
  ): Result<CompletionResult, StepCompletionError> {
    const current = student.currentStepId();
    const already: Result<CompletionResult, never> = ok({
      level: 'already_completed',
      currentStepId: current,
    });
    if (!student.hasCompleted(current)) return already;
    const tailStepId = stream.stepPlace(current)?.nextStepId;
    if (tailStepId === undefined || student.hasIssued(tailStepId)) {
      return already;
    }
    const issued = student.issueStep(tailStepId, at);
    if (!issued.ok) return issued;
    return ok(transitionAfter(place, tailStepId));
  },
};
