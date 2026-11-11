import type { User } from '@u7-scl/app-legacy/domain';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import type { MenuButton } from '@u7-scl/bot/u7-menu';
import { md } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import { buttons } from '../../shared/buttons';

/**
 * Подменю «🛠️ Инструменты ментора».
 * Доступно ментору и администратору — по субъекту резолвера `Caller`.
 */
export class SubmenuStory extends U7BotUiStory {
  readonly name = 'submenu';

  async handleCallback(
    action: string,
    actor: User,
    session: BotSession,
  ): Promise<DialogResponse> {
    if (!(await this.#isMentor(actor))) {
      return this.screen(md`⚠️ У вас нет доступа к инструментам ментора\\.`);
    }

    if (action === 'start') {
      return this.#buildSubmenu();
    }

    return this.unknownCommand(action, actor, session);
  }

  override async menuButtons(actor: User): Promise<MenuButton[]> {
    if (await this.#isMentor(actor)) {
      return [
        {
          kind: 'callback',
          text: '🛠️ Инструменты ментора',
          action: this.cb('start'),
          priority: 30,
          description:
            '🛠️ Инструменты ментора — управление потоками и мониторинг студентов',
        },
      ];
    }
    return [];
  }

  // ── Приватные методы ──

  async #isMentor(actor: User): Promise<boolean> {
    const subject = await this.subjectOf(actor);
    return subject?.isMentor() === true || subject?.isAdmin() === true;
  }

  #buildSubmenu(): DialogResponse {
    return this.screen(
      md`🛠️ *Инструменты ментора*`,
      this.kb([
        [this.btn('📋 Мои потоки', this.cbFor('my-streams', 'list'))],
        [this.btn('➕ Создать поток', this.cbFor('create-stream', 'start'))],
        [buttons.mainMenu('🔙 Назад')],
      ]),
    );
  }
}
