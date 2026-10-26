import {
  type CourseEnrollment,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import { StartQuestionnaireUcDef } from '@u7-scl/domain/questionnaire/contract';
import {
  CreateCourseWishUcDef,
  WishAr,
  type WishModuleDef,
  type WishTargetVo,
} from '@u7-scl/domain/wish';
import { type Caller, type Identified, ok } from 'dmg-core';
import {
  type ParsedInputOf,
  type Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import type { WishDeps } from '../../wish.module';

type CourseTarget = Extract<WishTargetVo, { kind: 'course' }>;

/**
 * Загруженное — контекст правил `courseEnrollable` и `unique`: ответ
 * модуля курсов о записи и желания пользователя на этот курс.
 */
type Loaded = {
  readonly courseId: string;
  readonly enrollment: CourseEnrollment;
  readonly userId: string;
  readonly target: CourseTarget;
  readonly wishes: readonly WishAr[];
};

type Input = ParsedInputOf<typeof CreateCourseWishUcDef>;

export class CreateCourseWishUc extends UseCaseFromDef<
  typeof CreateCourseWishUcDef,
  WishDeps,
  Loaded,
  Identified
> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(CreateCourseWishUcDef, deps, module);
  }

  /**
   * Ответ курса — `this.call` (фасад модуля курсов, D-43), желания — все
   * на эту цель.
   */
  protected async load(
    { courseId }: Input,
    caller: Caller<Identified>,
    trace: Trace,
  ) {
    const enrollment = await this.call(
      GetCourseEnrollmentUcDef,
      { courseId },
      caller,
      trace,
    );
    if (!enrollment.ok) return enrollment;
    const userId = this.subject(caller).uuid;
    const target: CourseTarget = { kind: 'course', courseId };
    return ok({
      courseId,
      enrollment: enrollment.value,
      userId,
      target,
      wishes: await this.resolve.wishes.findAllByUserAndTarget(userId, target),
    });
  }

  /**
   * Анкета запускается после `uow.register`, до фиксации (D-41, вариант 1):
   * её отказ — ответ UC, и желание не записывается.
   */
  protected async execute(
    { courseId }: Input,
    { userId }: Loaded,
    uow: UnitOfWork,
    caller: Caller<Identified>,
    trace: Trace,
  ) {
    const created = WishAr.createForCourse(
      { uuid: crypto.randomUUID(), userId, courseId },
      this.now(),
    );
    if (!created.ok) return created;
    const wish = created.value;
    uow.register(wish, this.resolve.wishes);
    const questionnaire = wish.questionnaire();

    if (questionnaire) {
      const started = await this.call(
        StartQuestionnaireUcDef,
        { pool: questionnaire.pool, owner: questionnaire.owner },
        caller,
        trace,
      );
      if (!started.ok) return started;
    }
    return ok({ outcome: wish.outcome() });
  }
}
