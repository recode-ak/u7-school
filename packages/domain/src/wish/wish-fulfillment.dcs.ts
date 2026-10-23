import { ok, type RejectOf, type Result, type Timestamp } from 'dmg-core';
import type { WishAr, WishArDef } from './wish/wish.ar';
import type {
  FulfillmentAnswer,
  FulfillmentQuestion,
} from './wish-fulfillment.types';

/**
 * Реализация желаний пользователя зачислением на поток модуля `moduleId`.
 *
 * Идентичность курсов и модулей решает модуль курсов, поэтому операция в
 * два шага: `question()` — что спросить у курса (батч по реализуемым
 * желаниям, по вопросу на вид цели), `fulfill(answer)` — реализовать
 * желания, цели которых курс признал. Что реализуемо и чья цель совпала —
 * отвечает каждый `WishAr`; сервис только собирает батч и применяет ответ.
 */
export class WishFulfillmentDcs {
  constructor(
    private readonly moduleId: string,
    private readonly wishes: readonly WishAr[],
  ) {}

  /** Вопросы к курсу; пустой объект — реализуемых желаний нет. */
  question(): FulfillmentQuestion {
    const targets = this.wishes.map((wish) => wish.fulfillmentTargets());
    const courseIds = targets.flatMap((t) => t.courseIds);
    const moduleIds = targets.flatMap((t) => t.moduleIds);
    const { moduleId } = this;
    return {
      ...(courseIds.length > 0 && { courses: { moduleId, courseIds } }),
      ...(moduleIds.length > 0 && { modules: { moduleId, moduleIds } }),
    };
  }

  /**
   * Реализует желания по ответу курса и возвращает изменённые — их
   * регистрирует вызывающий. Нереализуемые и непризнанные не меняются.
   */
  fulfill(
    answer: FulfillmentAnswer,
    at: Timestamp,
  ): Result<readonly WishAr[], RejectOf<typeof WishArDef, 'fulfill'>> {
    const enrolled = {
      courseIds: answer.courses?.courseIds ?? [],
      moduleIds: answer.modules?.moduleIds ?? [],
    };
    const fulfilled: WishAr[] = [];
    for (const wish of this.wishes) {
      if (!wish.isFulfilledBy(enrolled)) continue;
      const res = wish.fulfill(at);
      if (!res.ok) return res;
      fulfilled.push(wish);
    }
    return ok(fulfilled);
  }
}
