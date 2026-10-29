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
 * Загруженное — свои данные, контекст правила `unique`: желания пользователя
 * на этот курс.
 */
type Loaded = {
  readonly courseId: string;
  readonly userId: string;
  readonly target: CourseTarget;
  readonly wishes: readonly WishAr[];
};

/** Контекст правила `courseEnrollable` — ответ модуля курсов (D-58, `fetch`). */
type Fetched = { readonly enrollment: CourseEnrollment };

type Input = ParsedInputOf<typeof CreateCourseWishUcDef>;

export class CreateCourseWishUc extends UseCaseFromDef<
  typeof CreateCourseWishUcDef,
  WishDeps,
  Loaded,
  Identified,
  Fetched
> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(CreateCourseWishUcDef, deps, module);
  }

  /** Свои данные: субъект, цель и желания пользователя на неё. */
  protected async load({ courseId }: Input, caller: Caller<Identified>) {
    const userId = this.subject(caller).uuid;
    const target: CourseTarget = { kind: 'course', courseId };
    return ok({
      courseId,
      userId,
      target,
      wishes: await this.resolve.wishes.findAllByUserAndTarget(userId, target),
    });
  }

  /** Ответ модуля курсов — `this.call` (фасад, D-43) после Policy (D-58). */
  protected override async fetch(
    { courseId }: Input,
    _loaded: Loaded,
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
    return ok({ enrollment: enrollment.value });
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
