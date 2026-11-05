import {
  type LessonAr,
  type ModuleAr,
  ModulePolicy,
  ModuleSnapshotDqs,
} from '@u7-scl/domain/course';
import {
  CourseErrors,
  type CourseModuleDef,
  GetModuleSnapshotUcDef,
} from '@u7-scl/domain/course/contract';
import { type Caller, CoreErrors, err, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { CourseModuleDeps, CourseUser } from '../../course.module';

type Loaded = {
  readonly module: ModuleAr;
  readonly lessons: readonly LessonAr[];
};
type Input = ParsedInputOf<typeof GetModuleSnapshotUcDef>;

/**
 * Снимок контента модуля: проекты и уроки только `published`, порядок — из
 * данных. Модуль виден автору и администратору в любом статусе, остальным —
 * только опубликованный; неопубликованный урок опубликованного проекта
 * пропускается (`ModuleSnapshotDqs`). Шаги не читаются: `stepIds` идут как есть.
 */
export class GetModuleSnapshotUc extends UseCaseFromDef<
  typeof GetModuleSnapshotUcDef,
  CourseModuleDeps,
  Loaded,
  CourseUser
> {
  constructor(deps: CourseModuleDeps, module: typeof CourseModuleDef) {
    super(GetModuleSnapshotUcDef, deps, module);
  }

  protected async load({ moduleId }: Input) {
    const module = await this.resolve.modules.findById(moduleId);
    if (!module) return err(CourseErrors.MODULE_NOT_FOUND.make({ moduleId }));

    // Урок одного модуля может входить в несколько проектов: uuid без повторов.
    const lessonIds = [
      ...new Set(module.publishedOutline().flatMap((it) => it.lessonIds)),
    ];
    const lessons = await this.resolve.lessons.findByIds(lessonIds);
    return ok({ module, lessons });
  }

  protected async execute(
    _: Input,
    { module, lessons }: Loaded,
    __: UnitOfWork,
    caller: Caller<CourseUser>,
  ) {
    const rule = ModulePolicy.rules.canSeeUnpublished;
    const decision = rule.evaluate(caller.subject(), { module });
    if (module.viewFor(decision.allowed) === undefined) {
      return CoreErrors.ACCESS_DENIED.err({
        rule: rule.name,
        denyMessage: rule.denyMessage,
      });
    }
    return ok(new ModuleSnapshotDqs(module, lessons).build());
  }
}
