import type { User } from '@u7-scl/app-legacy/domain';
import { U7BotUiStory } from '../../../core/u7-bot-ui-story';

/** Профиль респондента с адресом доставки в Telegram. */
export type AddressedRespondent = { user: User; telegramId: number };

/**
 * Общая основа stories анкет: адрес для проактивных сообщений. События
 * анкеты адреса не несут, `telegramId` берётся по профилю респондента
 * (legacy `get-user`).
 */
export abstract class QuestionnaireStory extends U7BotUiStory {
  /**
   * Профиль и `telegramId` респондента; нет профиля, сбой чтения или нет
   * `telegramId` — `warn` и `undefined` (сообщение не отправляется).
   */
  protected async resolveRespondent(
    respondentId: string,
    questionnaireId: string,
  ): Promise<AddressedRespondent | undefined> {
    let user: User | null | undefined;
    try {
      user = await this.appApi.execute('get-user', { uuid: respondentId });
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

    if (!user.telegramId) {
      this.logger?.warn(
        this.name,
        'Сообщение по анкете не отправлено: нет telegramId респондента',
        { respondentId, questionnaireId },
      );
      return undefined;
    }
    return { user, telegramId: user.telegramId };
  }
}
