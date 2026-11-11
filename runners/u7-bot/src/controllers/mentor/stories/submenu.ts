import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import type { MenuButton } from '@u7-scl/bot/u7-menu';
import { md } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import { buttons } from '../../shared/buttons';

/**
 * Подменю «🛠️ Инструменты ментора».
 * Доступно ментору и администратору — по ролям субъекта актора.
 */
export class SubmenuStory extends U7BotUiStory {
  readonly name = 'submenu';

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    if (!this.#isMentor(actor)) {
      return this.screen(md`⚠️ У вас нет доступа к инструментам ментора\\.`);
    }

    if (action === 'start') {
      return this.#buildSubmenu();
    }

    return this.unknownCommand(action, actor, session);
  }

  override async menuButtons(actor: U7BotActor): Promise<MenuButton[]> {
    if (this.#isMentor(actor)) {
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

  #isMentor(actor: U7BotActor): boolean {
    return actor.user.isMentor() || actor.user.isAdmin();
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
