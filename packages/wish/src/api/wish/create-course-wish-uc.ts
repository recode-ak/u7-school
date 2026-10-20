import type { User } from '@u7-scl/app/domain';
import type {
  CreateCourseWishCmd,
  CreateCourseWishCmdMeta,
  CreateCourseWishOutput,
  WishTargetVo,
} from '@u7-scl/domain/wish';
import {
  CreateCourseWishCmdSchema,
  CreateCourseWishOutputSchema,
  findCoursePool,
  WishAr,
  WishRules,
} from '@u7-scl/domain/wish';
import { WishErrors } from '@u7-scl/domain/wish/contract';
import { unwrapInfallible } from '../legacy-reject';
import { WishUseCase } from '../wish-uc';

/**
 * Use-case создания желания пройти курс («запись на курс»).
 * Валидация через фасад: курс доступен для записи (существует и опубликован)
 * и имеет стартовый модуль — статус курса и структура программы решает
 * модуль курсов.
 * Курс с пулом анкеты → желание в pending + запуск анкеты;
 * курс без пула → мгновенная фиксация (expressed).
 */
export class CreateCourseWishUc extends WishUseCase<CreateCourseWishCmdMeta> {
  protected readonly ucName = 'create-course-wish' as const;
  protected readonly ucLabel = 'Создать желание пройти курс' as const;
  protected readonly arMeta = {
    arName: 'Wish' as const,
    arLabel: 'Желание' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = CreateCourseWishCmdSchema;
  protected readonly outputSchema = CreateCourseWishOutputSchema;

  async execute(
    command: CreateCourseWishCmd,
    actor: User,
  ): Promise<CreateCourseWishOutput> {
    // 1. Курс должен быть доступен для записи и иметь стартовый модуль
    //    (draft/archived/пустая программа для студента неотличимы от «не найден»).
    const courseFacade = this.resolve.courseFacade;
    const enrollable = await courseFacade.isCourseEnrollable(command.courseId);
    const startModuleId = enrollable
      ? await courseFacade.getCourseStartModuleId(command.courseId)
      : undefined;
    if (!enrollable || !startModuleId) {
      this.throwWishError(
        WishErrors.COURSE_NOT_FOUND.make({ courseId: command.courseId }),
      );
    }

    // 2. Не более одного активного желания на пару (user, target).
    //    Проверяем ВСЕ желания на цель, а не «последнее»: при равных createdAt
    //    порядок сортировки недетерминирован и активное желание может
    //    оказаться не первым.
    const target: WishTargetVo = { kind: 'course', courseId: command.courseId };
    const wishes = await this.repo.findAllByUserAndTarget(actor.uuid, target);
    const unique = WishRules.rules.unique.check({
      userId: actor.uuid,
      target,
      wishes,
    });
    if (!unique.ok) {
      this.throwWishError(unique.error);
    }

    // 3. Курс с пулом анкеты — анкетная ветка: pending + запуск анкеты.
    const pool = findCoursePool(command.courseId);
    if (pool) {
      const wish = unwrapInfallible(
        WishAr.create(
          {
            uuid: crypto.randomUUID(),
            userId: actor.uuid,
            target,
            status: 'pending',
          },
          Date.now(),
        ),
      );
      await this.repo.save(wish);
      await this.resolve.questionnaireFacade.startStandard<{
        courseId: string;
      }>(actor, pool, { courseId: command.courseId });
      return { outcome: 'questionnaire' };
    }

    // 4. Курс без пула — мгновенная фиксация.
    const wish = unwrapInfallible(
      WishAr.create(
        {
          uuid: crypto.randomUUID(),
          userId: actor.uuid,
          target,
          status: 'expressed',
        },
        Date.now(),
      ),
    );
    await this.repo.save(wish);

    return { outcome: 'instant' };
  }
}
