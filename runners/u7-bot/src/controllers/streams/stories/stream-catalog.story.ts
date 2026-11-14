import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import type { MenuButton } from '@u7-scl/bot/u7-menu';
import { type MdText, md, mdConcat } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse, KbButton } from '@u7-scl/core/ui';
import {
  ListStreamsUcDef,
  StreamModuleDef,
  StreamStatus,
} from '@u7-scl/domain/stream/contract';
import { buttons } from '../../shared/buttons';

const STATUS_EMOJI: Record<string, string> = {
  enrollment: '🟡',
  active: '🔵',
  completed: '🟢',
  archived: '⚫',
};

const LEGEND = md`\n\n🟡 — идёт набор   🔵 — идёт обучение   🟢 — завершён   ⚫ — в архиве`;

/**
 * S01: Просмотр витрины потоков (Каталог).
 * Показывает список активных потоков и потоков с открытым набором.
 * Кнопки потоков — мосты в view-stream (валидный штамп).
 */
export class CatalogStory extends U7BotUiStory {
  readonly name = 'catalog';

  override async menuButtons(_actor: U7BotActor): Promise<MenuButton[]> {
    return [];
  }

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    const showCompleted =
      action === 'list-with-completed' || action === 'list-with-all';
    const showArchived = action === 'list-with-all';
    if (action !== 'list' && !showCompleted) {
      return this.unknownCommand(action, actor, session);
    }

    // Группы по статусу — фильтр UC, статус из view не читаем (D-72)
    const byStatus = (status: StreamStatus) =>
      this.dispatchUc(
        StreamModuleDef,
        ListStreamsUcDef.command({ status }),
        actor,
      );
    const enrollment = await byStatus(StreamStatus.ENROLLMENT);
    if (!enrollment.ok) return this.ucErrorNotify(enrollment.error);
    const active = await byStatus(StreamStatus.ACTIVE);
    if (!active.ok) return this.ucErrorNotify(active.error);
    const completed = await byStatus(StreamStatus.COMPLETED);
    if (!completed.ok) return this.ucErrorNotify(completed.error);
    const archived = await byStatus(StreamStatus.ARCHIVED);
    if (!archived.ok) return this.ucErrorNotify(archived.error);
    const enrollmentStreams = enrollment.value;
    const activeStreams = active.value;
    const completedStreams = completed.value;
    const archivedStreams = archived.value;

    const hasCompleted = completedStreams.length > 0;
    const hasArchived = archivedStreams.length > 0;

    // Формируем список для показа
    const visible = [...enrollmentStreams, ...activeStreams];
    if (showCompleted) {
      visible.push(...completedStreams);
    }
    if (showArchived) {
      visible.push(...archivedStreams);
    }

    // Нет потоков для показа
    if (visible.length === 0) {
      const toggleRows: KbButton[][] = [];
      if (hasCompleted && !showCompleted) {
        toggleRows.push([
          this.btn('🟢 Вкл. завершённые', this.cb('list-with-completed')),
        ]);
      }
      if (hasArchived && !showArchived) {
        toggleRows.push([
          this.btn('⚫ Вкл. архивированные', this.cb('list-with-all')),
        ]);
      }
      toggleRows.push([this.#backToSchoolButton()]);
      if (hasCompleted || hasArchived) {
        return this.screen(md`📚 *Нет активных потоков*`, this.kb(toggleRows));
      }

      return this.screen(md`📚 Нет доступных потоков`, this.kb(toggleRows));
    }

    // Кросс-стори колбэки: ссылаемся на ViewStreamStory
    const rows: KbButton[][] = visible.map((s) => [
      this.btn(
        `${STATUS_EMOJI[s.status] ?? '❓'} ${s.title}`,
        this.cbFor('view-stream', 'view', s.uuid),
      ),
    ]);

    // Кнопки-переключатели
    const toggles: KbButton[] = [];
    if (hasCompleted && !showCompleted) {
      toggles.push(
        this.btn('🟢 Вкл. завершённые', this.cb('list-with-completed')),
      );
    }
    if (hasArchived && !showArchived) {
      toggles.push(
        this.btn('⚫ Вкл. архивированные', this.cb('list-with-all')),
      );
    }
    if (showCompleted && !showArchived && hasArchived) {
      toggles.push(
        this.btn('⚫ Вкл. архивированные', this.cb('list-with-all')),
      );
    }
    if ((showCompleted || showArchived) && toggles.length === 0) {
      toggles.push(this.btn('🔵 Только активные', this.cb('list')));
    }
    if (toggles.length > 0) {
      rows.push(toggles);
    }

    // Кнопка «⬅️ Назад в школу» последней строкой
    rows.push([this.#backToSchoolButton()]);

    return this.screen(this.#catalogTitle(), this.kb(rows));
  }

  /** Заголовок каталога с легендой статусов. */
  #catalogTitle(): MdText {
    return mdConcat(md`📚 *Потоки курсов*`, LEGEND);
  }

  /** Кнопка «⬅️ Назад в школу» — возврат в хаб школы. */
  #backToSchoolButton(): { text: string; code: string } {
    return buttons.backToSchool();
  }
}
