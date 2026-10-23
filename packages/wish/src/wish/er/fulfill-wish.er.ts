import {
  GetCoursesIncludingModuleUcDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import {
  type FulfillmentAnswer,
  type FulfillmentQuestion,
  FulfillWishErDef,
  WishFulfillmentDcs,
  type WishModuleDef,
} from '@u7-scl/domain/wish';
import { type CoreError, ok, type Result, type SystemCaller } from 'dmg-core';
import {
  type ReactionEnvelopeOf,
  ReactionFromDef,
  type Trace,
  type UnitOfWork,
} from 'dmg-core/app';
import type { WishDeps } from '../../wish.module';

type Def = typeof FulfillWishErDef;

/**
 * Реализация желаний зачислением: что спросить у курса и какие желания
 * реализовать, решает `WishFulfillmentDcs`; реакция только загружает
 * желания, передаёт вопросы модулю курсов и регистрирует изменённые.
 */
export class FulfillWishEr extends ReactionFromDef<Def, WishDeps> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(FulfillWishErDef, deps, module);
  }

  protected async react(
    event: ReactionEnvelopeOf<Def>,
    uow: UnitOfWork,
    caller: SystemCaller,
    trace: Trace,
  ) {
    const { userId, moduleId } = event.payload;
    const { wishes } = this.resolve;
    const fulfillment = new WishFulfillmentDcs(
      moduleId,
      await wishes.findByUser(userId),
    );
    const answer = await this.ask(fulfillment.question(), caller, trace);
    if (!answer.ok) return answer;
    const fulfilled = fulfillment.fulfill(answer.value, this.now());
    if (!fulfilled.ok) return fulfilled;
    for (const wish of fulfilled.value) uow.register(wish, wishes);
    return ok();
  }

  /**
   * Задаёт модулю курсов заданные вопросы (каждый — один батч-вызов);
   * вопроса нет — нет и вызова. Первый отказ — ответ реакции.
   */
  private async ask(
    question: FulfillmentQuestion,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<FulfillmentAnswer, CoreError>> {
    let answer: FulfillmentAnswer = {};
    if (question.courses) {
      const courses = await this.call(
        GetCoursesIncludingModuleUcDef,
        question.courses,
        caller,
        trace,
      );
      if (!courses.ok) return courses;
      answer = { ...answer, courses: courses.value };
    }
    if (question.modules) {
      const modules = await this.call(
        GetSameModulesUcDef,
        question.modules,
        caller,
        trace,
      );
      if (!modules.ok) return modules;
      answer = { ...answer, modules: modules.value };
    }
    return ok(answer);
  }
}
