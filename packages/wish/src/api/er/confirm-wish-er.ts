import type { ErMeta } from '@u7-scl/core/api';
import { EventReaction } from '@u7-scl/core/api';
import { legacyEventBus } from '@u7-scl/core/legacy-bridge';
import type { WishTargetVo } from '@u7-scl/domain/wish';
import type { QuestionnaireCompleteEvent } from '@u7-scl/questionnaire/domain';
import type { WishApiModuleResolver } from '../../wish';
import { publishWishEvents } from '../legacy-publish';
import { throwIfRejected } from '../legacy-reject';

/** Метаданные реакции подтверждения желания. */
export interface ConfirmWishErMeta
  extends ErMeta<QuestionnaireCompleteEvent<{ courseId: string }>> {
  erName: 'confirm-wish';
}

/**
 * Реакция на завершение анкетной ветки желания.
 * Желание в `pending` подтверждается (pending → confirmed);
 * любое другое состояние игнорируется (идемпотентность).
 *
 * После подтверждения публикует события агрегата (`WishEvents.confirmed`,
 * FQN `wish.wish.confirmed`) — уведомление
 * менторам курса рендерит UI-сторя wish-confirmed (контроллер
 * courses); ER только фиксирует факт и адресует по сущности.
 */
export class ConfirmWishEr extends EventReaction<
  ConfirmWishErMeta,
  WishApiModuleResolver
> {
  protected readonly eventNames = ['questionnaire:complete'] as const;
  protected readonly erName = 'confirm-wish' as const;
  protected readonly erLabel =
    'Подтвердить желание по завершении анкеты' as const;

  async handle(event: ConfirmWishErMeta['event']): Promise<void> {
    const target: WishTargetVo = {
      kind: 'course',
      courseId: event.ownerInfo.courseId,
    };
    const userId = event.payload.respondentId;

    const wish = await this.resolve.wishRepo.findCurrentByUserAndTarget(
      userId,
      target,
    );

    // Идемпотентность: подтверждаем только ожидающее анкету желание
    // (вопрос «можно ли» решает агрегат — предикат, не статус-поле).
    if (!wish?.canConfirm()) {
      return;
    }

    const at = Date.now();
    throwIfRejected(wish.confirm(at));
    await this.resolve.wishRepo.save(wish);

    publishWishEvents(legacyEventBus(this.resolve.eventBus), {
      events: wish.pullEvents(),
      aggregateId: wish.uuid,
      source: this.erName,
      cause: event,
      at,
    });
  }
}
