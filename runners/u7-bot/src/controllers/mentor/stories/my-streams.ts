import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import { md, mdJoin, mdRaw } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse, KbButton } from '@u7-scl/core/ui';
import {
  ListStreamsUcDef,
  StreamModuleDef,
  StreamStatus,
  type StreamView,
} from '@u7-scl/domain/stream/contract';

const STATUS_EMOJI: Record<string, string> = {
  enrollment: '🟡',
  active: '🔵',
  completed: '🟢',
  archived: '⚫',
};

const LEGEND = mdRaw(
  '\n\n🟡 — идёт набор   🔵 — идёт обучение   🟢 — завершён   ⚫ — в архиве',
);

/**
 * Список потоков ментора с фильтрацией по статусу.
 * Доступен через подменю «Инструменты ментора».
 */
export class MyStreamsStory extends U7BotUiStory {
  readonly name = 'my-streams';

  async handleCallback(
    action: string,
    actor: U7BotActor,
    _session: BotSession,
  ): Promise<DialogResponse> {
    // Парсим фильтры: list[:completed:1][:archived:1]
    const segments = action.split(':');
    const showCompleted = segments.includes('completed');
    const showArchived = segments.includes('archived');

    if (segments[0] !== 'list') {
      return this.unknownCommand(action, actor, _session);
    }

    return this.#handleList(actor, showCompleted, showArchived);
  }

  // ── Приватные методы ──

  async #handleList(
    actor: U7BotActor,
    showCompleted: boolean,
    showArchived: boolean,
  ): Promise<DialogResponse> {
    try {
      // Только потоки текущего ментора; группы по статусу — фильтр UC (D-72)
      const byStatus = (status: StreamStatus) =>
        this.dispatchUc(
          StreamModuleDef,
          ListStreamsUcDef.command({ mentorId: actor.user.uuid, status }),
          actor,
        );
      const statuses = [StreamStatus.ENROLLMENT, StreamStatus.ACTIVE];
      if (showCompleted) statuses.push(StreamStatus.COMPLETED);
      if (showArchived) statuses.push(StreamStatus.ARCHIVED);
      let myStreams: StreamView[] = [];
      for (const status of statuses) {
        const listed = await byStatus(status);
        if (!listed.ok) return this.ucErrorNotify(listed.error);
        myStreams = [...myStreams, ...listed.value];
      }

      // Кнопки-переключатели
      const toggleRow: KbButton[] = [];
      if (!showArchived && !showCompleted) {
        toggleRow.push(
          this.btn('⚫ Вкл. архивированные', this.cb('list:archived:1')),
        );
        toggleRow.push(
          this.btn('🟢 Вкл. завершённые', this.cb('list:completed:1')),
        );
      } else if (showArchived && !showCompleted) {
        toggleRow.push(
          this.btn(
            '🟢 Вкл. завершённые',
            this.cb('list:completed:1:archived:1'),
          ),
        );
      } else if (!showArchived && showCompleted) {
        toggleRow.push(
          this.btn(
            '⚫ Вкл. архивированные',
            this.cb('list:completed:1:archived:1'),
          ),
        );
      }
      // Если оба включены — переключателей нет

      const rows: KbButton[][] = [];
      if (toggleRow.length > 0) {
        rows.push(toggleRow);
      }

      if (myStreams.length === 0) {
        rows.push([this.btn('🔙 Назад', this.cbFor('submenu', 'start'))]);
        return this.screen(
          mdJoin([
            md`📋 *Мои потоки*`,
            md``,
            md`У вас пока нет потоков\\.`,
            LEGEND,
          ]),
          this.kb(rows),
        );
      }

      // Строки потоков
      for (const s of myStreams) {
        rows.push([
          this.btn(
            `${STATUS_EMOJI[s.status] ?? '❓'} ${s.title}`,
            this.cbFor('view-stream-mentor', 'view', s.uuid),
          ),
        ]);
      }

      rows.push([this.btn('🔙 Назад', this.cbFor('submenu', 'start'))]);

      return this.screen(mdJoin([md`📋 *Мои потоки*`, LEGEND]), this.kb(rows));
    } catch {
      return this.screen(md`⚠️ Не удалось загрузить список потоков\\.`);
    }
  }
}
