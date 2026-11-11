import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import { md } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import {
  ActivateStreamUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';

/**
 * US-7: Запуск потока (старт обучения).
 * Ментор активирует поток — студенты получают первый шаг.
 */
export class ActivateStreamStory extends U7BotUiStory {
  readonly name = 'activate-stream';

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    const [cmd, streamId] = action.split(':');
    if (cmd !== 'activate' || !streamId) {
      return this.unknownCommand(action, actor, session);
    }
    const res = await this.dispatchUc(
      StreamModuleDef,
      ActivateStreamUcDef.command({ streamId }),
      actor,
    );
    if (!res.ok) return this.ucErrorNotify(res.error);

    return this.screen(
      md`🚀 *Поток запущен\\!* Первые задания выданы студентам\\. Они увидят их в разделе «🎓 Моя учёба»\\.`,
      this.kb([
        [
          this.btn(
            '⬅️ Назад к потоку',
            this.cbFor('view-stream-mentor', 'view', streamId),
          ),
        ],
      ]),
    );
  }
}
