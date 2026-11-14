import type { StepsByLesson, StepView } from '@u7-scl/domain/course/contract';

/**
 * DQS шагов уроков потока: `lessonId → [{ uuid, description, status }]` по
 * снимку (`StreamAr.lessonSteps`) из шагов, которые курс отдал без статусного
 * фильтра. Форма — как у `getStepsByLessons`; шаг, которого курс не отдал,
 * пропускается, урок без шагов в ответ не попадает. Только читает.
 */
export class StreamLessonStepsDqs {
  constructor(
    private readonly lessons: ReadonlyMap<string, readonly string[]>,
    private readonly steps: readonly StepView[],
  ) {}

  build(): StepsByLesson {
    const byId = new Map(this.steps.map((step) => [step.uuid, step]));
    const result: StepsByLesson = {};
    for (const [lessonId, stepIds] of this.lessons) {
      const items = stepIds
        .map((stepId) => byId.get(stepId))
        .filter((step): step is StepView => step !== undefined)
        .map(({ uuid, description, status }) => ({
          uuid,
          description,
          status,
        }));
      if (items.length > 0) result[lessonId] = items;
    }
    return result;
  }
}
