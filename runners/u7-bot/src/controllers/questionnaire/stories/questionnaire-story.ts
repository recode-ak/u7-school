import type { UserView } from '@u7-scl/domain/user/contract';
import { U7BotUiStory } from '../../../core/u7-bot-ui-story';

/** Профиль респондента с адресом доставки в Telegram. */
export type AddressedRespondent = { user: UserView; telegramId: number };

/**
 * Общая основа stories анкет: адрес для проактивных сообщений. События
 * анкеты адреса не несут, `telegramId` берётся по профилю респондента
 * (`getUser`).
 */
export abstract class QuestionnaireStory extends U7BotUiStory {
  /**
   * Профиль и `telegramId` респондента; нет профиля или сбой чтения —
   * `warn` и `undefined` (сообщение не отправляется).
   */
  protected async resolveRespondent(
    respondentId: string,
    questionnaireId: string,
  ): Promise<AddressedRespondent | undefined> {
    let user: UserView | undefined;
    try {
      user = await this.findUser(respondentId);
    } catch (error) {
      this.logger?.warn(
        this.name,
        'Сообщение по анкете не отправлено: сбой чтения профиля респондента',
        { respondentId, questionnaireId, error: String(error) },
      );
      return undefined;
    }

    if (!user) {
      this.logger?.warn(
        this.name,
        'Сообщение по анкете не отправлено: профиль респондента не найден',
        { respondentId, questionnaireId },
      );
      return undefined;
    }

    return { user, telegramId: user.telegramId };
  }
}
