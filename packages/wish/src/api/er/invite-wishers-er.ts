import type { ErMeta } from '@u7-scl/core/api';
import { EventReaction } from '@u7-scl/core/api';
import { legacyEventBus } from '@u7-scl/core/legacy-bridge';
import type { WishApiModuleResolver, WishState } from '@u7-scl/domain/wish';
import { WishEvents } from '@u7-scl/domain/wish/contract';
import type { StreamCreatedEvent } from '@u7-scl/stream/domain';
import { publishWishEvents } from '../legacy-publish';

/** Метаданные реакции приглашения желающих при открытии набора. */
export interface InviteWishersErMeta extends ErMeta<StreamCreatedEvent> {
  erName: 'invite-wishers';
}

/**
 * Реакция на создание потока (открытие набора).
 *
 * Course-ветка: желания на курс зовутся только на поток первого модуля
 * курса (place.isFirst); набор на стартовый модуль — реализация course-желания.
 * Module-ветка: желания на модуль зовутся на поток любого модуля
 * (ретейкеры, «следующий модуль»).
 * Историческая идентичность (форки) решается только фасадом курсов.
 *
 * Приглашение — событие `WishEvents.invited` (FQN `wish.wish.invited`,
 * строит ER: состояние желания не меняется) с адресацией (userId, telegramId)
 * и целью желания; карточку с кнопкой отмены рендерит UI-сторя
 * wish-invite (контроллер courses, канал invite). Тексты карточки —
 * забота UI, ER только адресует. Поток недоступен или у желающего нет
 * telegramId — приглашение невозможно, пропуск (лог-предупреждение).
 */
export class InviteWishersEr extends EventReaction<
  InviteWishersErMeta,
  WishApiModuleResolver
> {
  protected readonly eventNames = ['stream.created'] as const;
  protected readonly erName = 'invite-wishers' as const;
  protected readonly erLabel = 'Пригласить желающих при открытии набора';

  async handle(event: InviteWishersErMeta['event']): Promise<void> {
    const { streamId, moduleId } = event.payload;

    // Место модуля потока в опубликованном курсе.
    // undefined — модуль вне опубликованных программ: course-ветка молчит.
    const place = await this.resolve.courseFacade.getModulePlace(moduleId);

    // Course-ветка — только набор на стартовый модуль курса.
    if (place?.isFirst) {
      const candidates = await this.resolve.wishRepo.findAllByKind('course', [
        'expressed',
        'confirmed',
      ]);
      const courseCandidates = candidates.filter(
        (
          w,
        ): w is WishState & { target: { kind: 'course'; courseId: string } } =>
          w.target.kind === 'course',
      );
      const matched = new Set(
        await this.resolve.courseFacade.whichCoursesIncludeModule(
          moduleId,
          courseCandidates.map((w) => w.target.courseId),
        ),
      );
      for (const wish of courseCandidates) {
        if (!matched.has(wish.target.courseId)) {
          continue;
        }
        await this.#invite(wish, streamId, event);
      }
    }

    // Module-ветка — поток на любой модуль.
    const candidates = await this.resolve.wishRepo.findAllByKind('module', [
      'expressed',
      'confirmed',
    ]);
    if (candidates.length > 0) {
      const moduleCandidates = candidates.filter(
        (
          w,
        ): w is WishState & { target: { kind: 'module'; moduleId: string } } =>
          w.target.kind === 'module',
      );
      const matched = new Set(
        await this.resolve.courseFacade.whichModulesAreSame(
          moduleId,
          moduleCandidates.map((w) => w.target.moduleId),
        ),
      );
      for (const wish of moduleCandidates) {
        if (!matched.has(wish.target.moduleId)) {
          continue;
        }
        await this.#invite(wish, streamId, event);
      }
    }
  }

  /** Публикация события приглашения. Поток недоступен — пропуск. */
  async #invite(
    wish: WishState,
    streamId: string,
    cause: InviteWishersErMeta['event'],
  ): Promise<void> {
    const stream = await this.resolve.streamFacade.getStream(streamId);
    if (!stream) return;

    const addressee = await this.resolve.userFacade.getUserByUuid(wish.userId);
    if (!addressee?.telegramId) {
      this.resolve.appResolver.logger.warn(
        'invite-wishers',
        `У желающего ${wish.userId} нет telegramId — приглашение не отправлено`,
      );
      return;
    }

    const to = {
      userId: wish.userId,
      telegramId: addressee.telegramId,
      streamId,
    };
    const invited = WishEvents.invited.make(
      wish.target.kind === 'course'
        ? { ...to, targetKind: 'course', courseId: wish.target.courseId }
        : { ...to, targetKind: 'module', moduleId: wish.target.moduleId },
    );
    publishWishEvents(legacyEventBus(this.resolve.eventBus), {
      events: [invited],
      aggregateId: wish.uuid,
      source: this.erName,
      cause,
      at: Date.now(),
    });
  }
}
