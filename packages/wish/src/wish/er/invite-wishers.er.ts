import {
  GetCoursesStartingWithModuleUcDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import { GetStreamPresenceUcDef } from '@u7-scl/domain/stream/contract';
import { GetTelegramAddressesUcDef } from '@u7-scl/domain/user/contract';
import {
  type InvitationMatchAnswer,
  type InvitationMatchQuestion,
  type InvitationReachAnswer,
  type InvitationReachQuestion,
  InviteWishersErDef,
  WishInvitationDcs,
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

type Def = typeof InviteWishersErDef;

/**
 * Приглашение желающих при открытии набора: что спросить у курсов, потоков
 * и пользователей и кого пригласить, решает `WishInvitationDcs`; реакция
 * только загружает желания, передаёт вопросы другим модулям и регистрирует
 * приглашённых (событие приглашения строит `WishAr.invite`).
 */
export class InviteWishersEr extends ReactionFromDef<Def, WishDeps> {
  constructor(deps: WishDeps, module: typeof WishModuleDef) {
    super(InviteWishersErDef, deps, module);
  }

  protected async react(
    event: ReactionEnvelopeOf<Def>,
    uow: UnitOfWork,
    caller: SystemCaller,
    trace: Trace,
  ) {
    const { streamId, moduleId } = event.payload;
    const { wishes } = this.resolve;
    const invitation = new WishInvitationDcs(streamId, moduleId, [
      ...(await wishes.findAllByKind('course', ['expressed', 'confirmed'])),
      ...(await wishes.findAllByKind('module', ['expressed', 'confirmed'])),
    ]);
    const match = await this.askMatch(
      invitation.matchQuestion(),
      caller,
      trace,
    );
    if (!match.ok) return match;
    const reach = await this.askReach(
      invitation.reachQuestion(match.value),
      caller,
      trace,
    );
    if (!reach.ok) return reach;
    const outcome = invitation.invite(match.value, reach.value, this.now());
    if (!outcome.ok) return outcome;
    for (const wish of outcome.value.invited) uow.register(wish, wishes);
    for (const userId of outcome.value.unreachable) {
      this.resolve.app.logger.warn(
        this.def.name,
        `У желающего ${userId} нет telegramId — приглашение не отправлено`,
      );
    }
    return ok();
  }

  /**
   * Раунд 1: спрашивает курсы (каждый вопрос — один батч-вызов); вопроса
   * нет — нет и вызова. Первый отказ — ответ реакции.
   */
  private async askMatch(
    question: InvitationMatchQuestion,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<InvitationMatchAnswer, CoreError>> {
    let answer: InvitationMatchAnswer = {};
    if (question.courses) {
      const courses = await this.call(
        GetCoursesStartingWithModuleUcDef,
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

  /** Раунд 2: спрашивает поток и адреса пользователей, если есть о чём. */
  private async askReach(
    question: InvitationReachQuestion,
    caller: SystemCaller,
    trace: Trace,
  ): Promise<Result<InvitationReachAnswer, CoreError>> {
    let answer: InvitationReachAnswer = {};
    if (question.stream) {
      const stream = await this.call(
        GetStreamPresenceUcDef,
        question.stream,
        caller,
        trace,
      );
      if (!stream.ok) return stream;
      answer = { ...answer, stream: stream.value };
    }
    if (question.addresses) {
      const addresses = await this.call(
        GetTelegramAddressesUcDef,
        question.addresses,
        caller,
        trace,
      );
      if (!addresses.ok) return addresses;
      answer = { ...answer, addresses: addresses.value };
    }
    return ok(answer);
  }
}
