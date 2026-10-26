import { type ErrorOf, ok, type Result, type Timestamp } from 'dmg-core';
import type { WishAr } from './wish/wish.ar';
import type { WishErrors } from './wish/wish.errors';
import type {
  InvitationMatchAnswer,
  InvitationMatchQuestion,
  InvitationOutcome,
  InvitationReachAnswer,
  InvitationReachQuestion,
} from './wish-invitation.types';

/**
 * Приглашение желающих на поток `streamId` модуля `moduleId` при открытии
 * набора.
 *
 * Чужие знания (стартовый ли модуль в курсе, тот ли модуль, есть ли поток,
 * какой у пользователя адрес) домену недоступны, поэтому операция идёт
 * «вопрос → ответ» в два раунда:
 * 1. `matchQuestion()` — какие цели желаний набор затрагивает (вопросы к
 *    курсам по виду цели);
 * 2. `reachQuestion(match)` — только если есть совпавшие: существует ли
 *    поток и каковы адреса их пользователей;
 * затем `invite(match, reach)` — пригласить. Что приглашаемо и чья цель
 * совпала — отвечает каждый `WishAr`; сервис собирает батч и применяет ответы.
 */
export class WishInvitationDcs {
  constructor(
    private readonly streamId: string,
    private readonly moduleId: string,
    private readonly wishes: readonly WishAr[],
  ) {}

  /** Раунд 1: вопросы к курсам; пустой объект — приглашаемых желаний нет. */
  matchQuestion(): InvitationMatchQuestion {
    const targets = this.wishes.map((wish) => wish.invitationTargets());
    const courseIds = targets.flatMap((t) => t.courseIds);
    const moduleIds = targets.flatMap((t) => t.moduleIds);
    const { moduleId } = this;
    return {
      ...(courseIds.length > 0 && { courses: { moduleId, courseIds } }),
      ...(moduleIds.length > 0 && { modules: { moduleId, moduleIds } }),
    };
  }

  /** Раунд 2: вопросы о потоке и адресах; пустой объект — совпавших нет. */
  reachQuestion(match: InvitationMatchAnswer): InvitationReachQuestion {
    const userIds = [
      ...new Set(this.matched(match).map((w) => w.addresseeId())),
    ];
    if (userIds.length === 0) return {};
    return {
      stream: { streamId: this.streamId },
      addresses: { userIds },
    };
  }

  /**
   * Приглашает совпавших и возвращает приглашённых — их регистрирует
   * вызывающий. Потока нет — никого; без адреса — в `unreachable`.
   */
  invite(
    match: InvitationMatchAnswer,
    reach: InvitationReachAnswer,
    at: Timestamp,
  ): Result<InvitationOutcome, ErrorOf<typeof WishErrors.NOT_INVITABLE>> {
    const matched = this.matched(match);
    if (reach.stream?.exists !== true || matched.length === 0) {
      return ok({ invited: [], unreachable: [] });
    }
    const telegramIds = new Map(
      (reach.addresses?.addresses ?? []).map((a) => [a.userId, a.telegramId]),
    );
    const invited: WishAr[] = [];
    const unreachable = new Set<string>();
    for (const wish of matched) {
      const telegramId = telegramIds.get(wish.addresseeId());
      if (telegramId === undefined) {
        unreachable.add(wish.addresseeId());
        continue;
      }
      const res = wish.invite(at, { streamId: this.streamId, telegramId });
      if (!res.ok) return res;
      invited.push(wish);
    }
    return ok({ invited, unreachable: [...unreachable] });
  }

  /** Желания, которых набор приглашает по ответу курсов. */
  private matched(match: InvitationMatchAnswer): readonly WishAr[] {
    const targets = {
      courseIds: match.courses?.courseIds ?? [],
      moduleIds: match.modules?.moduleIds ?? [],
    };
    return this.wishes.filter((wish) => wish.isInvitedBy(targets));
  }
}
