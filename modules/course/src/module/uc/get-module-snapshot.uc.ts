import {
  type ModuleAr,
  ModulePolicy,
  ModuleSnapshotDqs,
  type SkippedSnapshotItem,
} from '@u7-scl/domain/course';
import {
  type CourseModuleDef,
  GetModuleSnapshotUcDef,
  ModuleErrors,
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
};
type Input = ParsedInputOf<typeof GetModuleSnapshotUcDef>;

/**
 * Снимок контента модуля: проекты и уроки только `published`, порядок — из
 * данных. Модуль виден автору и администратору в любом статусе, остальным —
 * только опубликованный. Неопубликованный урок и шаг пропускаются
 * (`ModuleSnapshotDqs`), каждый пропуск — `warn` с `moduleId` и id. Шаги
 * уроков читаются одним запросом.
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
    if (!module) return err(ModuleErrors.NOT_FOUND.make({ moduleId }));
    return ok({ module });
  }

  protected async execute(
    _: Input,
    { module }: Loaded,
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

    // Урок одного модуля может входить в несколько проектов: uuid без повторов.
    const lessonIds = [
      ...new Set(module.publishedOutline().flatMap((it) => it.lessonIds)),
    ];
    const lessons = await this.resolve.lessons.findByIds(lessonIds);
    const stepIds = [...new Set(lessons.flatMap((it) => it.stepIds()))];
    const steps = await this.resolve.steps.findByIds(stepIds);

    const dqs = new ModuleSnapshotDqs(module, lessons, steps);
    for (const item of dqs.skipped()) {
      this.warnSkipped(module.uuid, item);
    }
    return ok(dqs.build());
  }

  /** Запись warn: id и в тексте, и в meta (журнал может хранить только текст). */
  private warnSkipped(moduleId: string, item: SkippedSnapshotItem) {
    const ids =
      item.kind === 'lesson'
        ? { lessonId: item.lessonId }
        : { lessonId: item.lessonId, stepId: item.stepId };
    const what = item.kind === 'lesson' ? 'урок' : 'шаг';
    const text = Object.entries(ids)
      .map(([key, id]) => `${key}=${id}`)
      .join(' ');
    this.resolve.app.logger.warn(
      'getModuleSnapshot',
      `${what} не в снимке (не опубликован): moduleId=${moduleId} ${text}`,
      { moduleId, ...ids },
    );
  }
}
