import type { ErMeta } from '@u7-scl/core/api';
import { EventReaction } from '@u7-scl/core/api';
import type { WishAr } from '@u7-scl/domain/wish';
import type { StudentEnrolledEvent } from '@u7-scl/stream/domain';
import type { WishApiModuleResolver } from '../../wish';
import { throwIfRejected } from '../legacy-reject';

/** Метаданные реакции реализации желания при зачислении. */
export interface FulfillWishErMeta extends ErMeta<StudentEnrolledEvent> {
  erName: 'fulfill-wish';
}

/**
 * Реакция на зачисление студента на поток.
 *
 * Course-wish: желания пользователя на курсы, в программу которых входит
 * модуль потока, переходят expressed|confirmed → fulfilled.
 * Module-wish: желания на модуль, исторически тот же (isSameModule),
 * что и модуль потока, — реализуются.
 * Остальные состояния игнорируются (идемпотентность).
 */
export class FulfillWishEr extends EventReaction<
  FulfillWishErMeta,
  WishApiModuleResolver
> {
  protected readonly eventNames = ['student.enrolled'] as const;
  protected readonly erName = 'fulfill-wish' as const;
  protected readonly erLabel = 'Отметить желание реализованным' as const;

  async handle(event: FulfillWishErMeta['event']): Promise<void> {
    const { userId, moduleId } = event.payload;

    const wishes = await this.resolve.wishRepo.findByUser(userId);

    // Кандидаты: желания, реализуемые зачислением (expressed | confirmed) —
    // вопрос «реализуемо ли» решает агрегат — предикат, не статус-поле.
    const active = wishes.filter((w) => w.canFulfill());
    if (active.length === 0) {
      return;
    }

    const courseCandidates = active.flatMap((ar) => {
      const { target } = ar.snapshot();
      return target.kind === 'course'
        ? [{ ar, courseId: target.courseId }]
        : [];
    });
    const moduleCandidates = active.flatMap((ar) => {
      const { target } = ar.snapshot();
      return target.kind === 'module'
        ? [{ ar, moduleId: target.moduleId }]
        : [];
    });

    // Course-ветка: один батч-запрос — какие из курсов кандидатов
    // включают модуль потока (в т.ч. исторически).
    if (courseCandidates.length > 0) {
      const matched = new Set(
        await this.resolve.courseFacade.whichCoursesIncludeModule(
          moduleId,
          courseCandidates.map((c) => c.courseId),
        ),
      );
      for (const { ar, courseId } of courseCandidates) {
        if (!matched.has(courseId)) {
          continue;
        }
        await this.#fulfill(ar);
      }
    }

    // Module-ветка: идентичность модулей решает модуль курсов (isSameModule).
    for (const { ar, moduleId: wishModuleId } of moduleCandidates) {
      const same = await this.resolve.courseFacade.isSameModule(
        moduleId,
        wishModuleId,
      );
      if (same) {
        await this.#fulfill(ar);
      }
    }
  }

  async #fulfill(ar: WishAr): Promise<void> {
    throwIfRejected(ar.fulfill(Date.now()));
    await this.resolve.wishRepo.save(ar);
  }
}
