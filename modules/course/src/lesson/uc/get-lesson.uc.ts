import {
  type LessonAr,
  type ModuleAr,
  ModulePolicy,
} from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetLessonUcDef,
  LessonErrors,
  ModuleErrors,
} from '@u7-scl/domain/course/contract';
import { type Caller, CoreErrors, err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Loaded = { readonly lesson: LessonAr; readonly module: ModuleAr };
type Input = ParsedInputOf<typeof GetLessonUcDef>;

/**
 * Урок для показа: чтение открыто всем, а право видеть неопубликованное —
 * правило `ModulePolicy` модуля-владельца (в Def UC не выражается: контекст
 * правила — загруженный модуль, а не урок). `undefined` от `viewFor` — отказ.
 */
export class GetLessonUc extends UseCaseFromDef<
  typeof GetLessonUcDef,
  CourseModuleDeps,
  Loaded,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetLessonUcDef, deps, module);
  }

  protected async load({ lessonId }: Input) {
    const lesson = await this.resolve.lessons.findById(lessonId);
    if (!lesson) return err(LessonErrors.NOT_FOUND.make({ lessonId }));

    const module = await this.resolve.modules.findById(lesson.moduleId);
    if (!module) {
      return err(ModuleErrors.NOT_FOUND.make({ moduleId: lesson.moduleId }));
    }
    return ok({ lesson, module });
  }

  protected async execute(
    _: Input,
    { lesson, module }: Loaded,
    __: UnitOfWork,
    caller: Caller<CourseUser>,
  ) {
    const rule = ModulePolicy.rules.canSeeUnpublished;
    const decision = rule.evaluate(caller.subject(), { module });
    const view = lesson.viewFor(decision.allowed);
    if (view !== undefined) return ok(view);
    return CoreErrors.ACCESS_DENIED.err({
      rule: rule.name,
      denyMessage: rule.denyMessage,
    });
  }
}
