// DEBT-21, DEBT-22: субъект вызывающего — legacy `User` (`@u7-scl/app`):
// его ждёт адаптер анкет TR-11 (`startStandard`); уйдёт с миграцией анкет.
import type { User } from '@u7-scl/app/domain';
import type { CourseEnrollment } from '@u7-scl/domain/course/contract';
import {
  CreateCourseWishUcDef,
  WishAr,
  type WishTargetVo,
} from '@u7-scl/domain/wish';
import { type Caller, ok } from 'dmg-core';
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
  User
> {
  constructor(deps: WishDeps) {
    super(CreateCourseWishUcDef, deps);
  }

  /** Ответ курса — через фасад (D-42), желания — все на эту цель. */
  protected async load(
    { courseId }: Input,
    caller: Caller<User>,
    trace: Trace,
  ) {
    const call = this.callContext(caller, trace);
    const enrollment = await this.resolve.course.getCourseEnrollment(
      call,
      courseId,
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
    caller: Caller<User>,
    trace: Trace,
  ) {
    const created = WishAr.createForCourse(
      { uuid: crypto.randomUUID(), userId, courseId },
      this.now(),
    );
    if (!created.ok) return created;
    const { wish, outcome, questionnaire } = created.value;
    uow.register(wish, this.resolve.wishes);

    if (questionnaire) {
      const started = await this.resolve.questionnaire.startQuestionnaire(
        this.callContext(caller, trace),
        questionnaire.pool,
        questionnaire.owner,
      );
      if (!started.ok) return started;
    }
    return ok({ outcome });
  }
}
