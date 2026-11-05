import {
  type LessonAr,
  type ModuleAr,
  ModulePolicy,
  type StepAr,
} from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetStepsByLessonsUcDef,
  type StepsByLesson,
} from '@u7-scl/domain/course/contract';
import { type Caller, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Loaded = {
  readonly lessons: readonly LessonAr[];
  readonly steps: readonly StepAr[];
};
type Input = ParsedInputOf<typeof GetStepsByLessonsUcDef>;

/**
 * Шаги уроков для навигации: уроки и шаги читаются одним запросом каждый,
 * модуль-владелец — один раз на различный `moduleId`. Видимость шага решает
 * `ModulePolicy` его модуля; невидимый, отсутствующий шаг и шаг с
 * неизвестным модулем молча пропускаются (поведение v0.2.6).
 */
export class GetStepsByLessonsUc extends UseCaseFromDef<
  typeof GetStepsByLessonsUcDef,
  CourseModuleDeps,
  Loaded,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetStepsByLessonsUcDef, deps, module);
  }

  protected async load({ lessonIds }: Input) {
    const lessons = await this.resolve.lessons.findByIds(lessonIds);
    const stepIds = [...new Set(lessons.flatMap((it) => it.stepIds()))];
    const steps = await this.resolve.steps.findByIds(stepIds);
    return ok({ lessons, steps });
  }

  protected async execute(
    _: Input,
    { lessons, steps }: Loaded,
    __: UnitOfWork,
    caller: Caller<CourseUser>,
  ) {
    const byId = new Map(steps.map((step) => [step.uuid, step]));
    const canSee = await this.visibility(steps, caller);
    const result: StepsByLesson = {};

    for (const lesson of lessons) {
      const items: StepsByLesson[string] = [];
      for (const stepId of lesson.stepIds()) {
        const step = byId.get(stepId);
        const allowed = step && canSee.get(step.moduleId);
        const summary =
          step && allowed !== undefined ? step.summaryFor(allowed) : undefined;
        if (summary !== undefined) items.push(summary);
      }
      if (items.length > 0) result[lesson.uuid] = items;
    }

    return ok(result);
  }

  /**
   * Право на неопубликованное по модулю шага: модуль каждого шага
   * спрашивается один раз, отсутствующий в ответе не попадает — его шаги
   * пропускаются.
   */
  private async visibility(
    steps: readonly StepAr[],
    caller: Caller<CourseUser>,
  ): Promise<Map<string, boolean>> {
    const modules = new Map<string, ModuleAr | undefined>();
    for (const step of steps) {
      if (modules.has(step.moduleId)) continue;
      const module = await this.resolve.modules.findById(step.moduleId);
      modules.set(step.moduleId, module);
    }

    const rule = ModulePolicy.rules.canSeeUnpublished;
    const canSee = new Map<string, boolean>();
    for (const [moduleId, module] of modules) {
      if (module === undefined) continue;
      canSee.set(moduleId, rule.evaluate(caller.subject(), { module }).allowed);
    }
    return canSee;
  }
}
