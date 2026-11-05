import type { ReadonlyAr } from 'dmg-core';
import type { LessonAr } from './lesson/lesson.ar';
import type { StepAr } from './step/step.ar';
import type { StepsByLesson } from './step/uc/get-steps-by-lessons.uc';

/**
 * DQS шагов уроков: `lessonId → [{ uuid, description }]` в порядке `stepIds`
 * урока. Только читает.
 *
 * Право на неопубликованное вызывающий решает заранее по модулю шага и
 * передаёт картой `canSee`; шаг модуля, которого в карте нет, висячий
 * `stepId` и невидимый шаг молча пропускаются (DOM-13; долг — маскирует
 * рассогласование данных). Видимость урока не проверяется (v0.2.6).
 */
export class LessonStepsDqs {
  constructor(
    private readonly lessons: readonly ReadonlyAr<LessonAr>[],
    private readonly steps: readonly ReadonlyAr<StepAr>[],
    private readonly canSee: ReadonlyMap<string, boolean>,
  ) {}

  /** Урок без видимых шагов в ответ не попадает. */
  build(): StepsByLesson {
    const byId = new Map(this.steps.map((step) => [step.uuid, step]));
    const result: StepsByLesson = {};

    for (const lesson of this.lessons) {
      const items: StepsByLesson[string] = [];
      for (const stepId of lesson.stepIds()) {
        const step = byId.get(stepId);
        if (step === undefined) continue;
        const allowed = this.canSee.get(step.moduleId);
        if (allowed === undefined) continue;
        const summary = step.summaryFor(allowed);
        if (summary !== undefined) items.push(summary);
      }
      if (items.length > 0) result[lesson.uuid] = items;
    }

    return result;
  }
}
