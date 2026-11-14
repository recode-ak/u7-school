import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { md } from '@u7-scl/core/shared';
import type {
  BotSession,
  DialogResponse,
  KbButton,
  KeyboardDescription,
} from '@u7-scl/core/ui';
import {
  ArchiveStreamUcDef,
  CompleteStreamUcDef,
  GetStreamMembersUcDef,
  GetStreamUcDef,
  StreamErrors,
  StreamModuleDef,
  type StreamWithRights,
} from '@u7-scl/domain/stream/contract';
import { ViewStreamStory } from '../../streams/stories/view-stream.story';

/**
 * S02m: Менторский режим карточки потока.
 *
 * Наследует ViewStreamStory, переопределяет buildKeyboard
 * для добавления lifecycle-кнопок (🚀 Запустить, ✅ Завершить, 📁 В архив).
 *
 * Запуск — через «🛠️ Инструменты ментора» → «📋 Мои потоки».
 */
export class ViewStreamMentorStory extends ViewStreamStory {
  override readonly name: string = 'view-stream-mentor';
  protected override storyName = 'view-stream-mentor';

  override async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    const [cmd, streamId] = action.split(':');

    // Делегируем просмотр карточки, программы и деталей родителю
    if (cmd === 'view' && streamId) {
      return this.handleView(streamId, actor);
    }

    if ((cmd === 'program' || cmd === 'prog') && streamId) {
      return this.handleProgramView(action, actor, session);
    }

    if (cmd === 'details' && streamId) {
      return this.handleDetailsView(streamId, actor);
    }

    // Lifecycle-действия
    if (cmd === 'complete-confirm' && streamId) {
      return this.#handleComplete(streamId, actor);
    }

    if (cmd === 'complete' && streamId) {
      return this.#showCompleteConfirm(streamId);
    }

    if (cmd === 'archive-confirm' && streamId) {
      return this.#handleArchive(streamId, actor);
    }

    if (cmd === 'archive' && streamId) {
      return this.#showArchiveConfirm(streamId);
    }

    // Всё остальное (включая students, enroll, cancel) — делегируем родителю
    return super.handleCallback(action, actor, session);
  }

  // ── Переопределение клавиатуры ──

  protected override buildKeyboard(
    stream: StreamWithRights,
    _actor: U7BotActor,
  ): KeyboardDescription {
    const rows: KbButton[][] = [];

    // ── Публичные кнопки (всем) ──

    // Информационные кнопки о курсе — рядом, первой строкой
    // (единый вид со студенческой карточкой ViewStreamStory)
    rows.push([
      this.btn(
        '📖 Программа модуля',
        this.cbFor('view-stream-mentor', 'program', stream.uuid),
      ),
      this.btn(
        '📋 Детали',
        this.cbFor('view-stream-mentor', 'details', stream.uuid),
      ),
    ]);

    rows.push([
      this.btn('👥 Студенты', this.cbFor('monitor', 'students', stream.uuid)),
    ]);

    // ── Lifecycle-кнопки: признаки готового ответа UC (D-72) ──
    const lifecycleRow: KbButton[] = [];

    if (stream.canActivate) {
      lifecycleRow.push(
        this.btn(
          '🚀 Запустить',
          this.cbFor('activate-stream', 'activate', stream.uuid),
        ),
      );
    }

    if (stream.canComplete) {
      lifecycleRow.push(
        this.btn(
          '✅ Завершить',
          this.cbFor('view-stream-mentor', 'complete', stream.uuid),
        ),
      );
    }

    if (stream.canArchive) {
      lifecycleRow.push(
        this.btn(
          '📁 В архив',
          this.cbFor('view-stream-mentor', 'archive', stream.uuid),
        ),
      );
    }

    if (lifecycleRow.length > 0) {
      rows.push(lifecycleRow);
    }

    // Кнопка «Назад» — возврат к моим потокам (не в catalog)
    rows.push([
      this.btn('⬅️ Назад к моим потокам', this.cbFor('my-streams', 'list')),
    ]);

    return this.kb(rows);
  }

  /**
   * Менторский режим списка студентов.
   * Переопределяет родительский: кнопка студента → monitor:detail,
   * + кнопки управления статусом (⛔✅🔄).
   */
  protected override async handleStudentsList(
    streamId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    // Получаем базовый ответ от родителя (текст, статистика, форматирование)
    const baseResponse = await super.handleStudentsList(streamId, actor);
    const baseScreen = baseResponse.screen;
    const baseKeyboard = baseScreen?.keyboard;
    if (!baseScreen || !baseKeyboard) return baseResponse;

    // Получаем данные для построения менторской клавиатуры
    const membersRes = await this.dispatchUc(
      StreamModuleDef,
      GetStreamMembersUcDef.command({ streamId }),
      actor,
    );
    if (!membersRes.ok) return this.ucErrorNotify(membersRes.error);
    const students = membersRes.value?.students ?? [];

    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const canManage = loaded.value.canManage;

    // Перестраиваем клавиатуру: заменяем коды кнопок на monitor:...
    const newRows = baseKeyboard.rows.map((row) => {
      return row.map((btn) => {
        // Заменяем student-detail на monitor:detail
        if (btn.code.includes(':student-detail:')) {
          const parts = btn.code.split(':');
          const studentUuid = parts[parts.length - 1];
          return this.btn(
            btn.text,
            this.cbFor('monitor', 'detail', studentUuid!),
          );
        }
        // Кнопку «Назад к потоку» оставляем как есть (view-stream-mentor:view:...)
        return btn;
      });
    });

    // Добавляем менторские кнопки (⛔✅🔄) для управляемых студентов
    const enrichedRows = newRows.map((row, rowIdx) => {
      // Последняя строка — «Назад» — не трогаем
      if (rowIdx === newRows.length - 1) return row;

      const studentBtn = row[0];
      if (!studentBtn) return row;

      // Извлекаем studentUuid из кода кнопки
      const parts = studentBtn.code.split(':');
      const studentUuid = parts[parts.length - 1];
      const student = students.find((s) => s.studentId === studentUuid);
      if (!student || !canManage) return row;

      const isActive = student.inProgress;
      const extraBtns: KbButton[] = [];

      if (isActive) {
        extraBtns.push(
          this.btn('⛔', this.cbFor('monitor', 'mark-abandoned', studentUuid!)),
        );
        extraBtns.push(
          this.btn('✅', this.cbFor('monitor', 'complete', studentUuid!)),
        );
      } else if (
        student.status === 'advanced' ||
        student.status === 'not_advanced'
      ) {
        extraBtns.push(
          this.btn('🔄', this.cbFor('monitor', 'complete', studentUuid!)),
        );
      }

      return [...row, ...extraBtns];
    });

    return this.screen(baseScreen.text, this.kb(enrichedRows));
  }

  // ── Подтверждения ──

  #showCompleteConfirm(streamId: string): DialogResponse {
    return this.screen(
      md`⚠️ *Завершить поток?*\n\nЭто действие остановит обучение для всех студентов\\. Поток нельзя будет перезапустить\\.`,
      this.kb([
        [
          this.btn(
            '✅ Да, завершить',
            this.cbFor('view-stream-mentor', 'complete-confirm', streamId),
          ),
          this.btn(
            '❌ Отмена',
            this.cbFor('view-stream-mentor', 'view', streamId),
          ),
        ],
      ]),
    );
  }

  #showArchiveConfirm(streamId: string): DialogResponse {
    return this.screen(
      md`⚠️ *Отправить поток в архив?*\n\nПоток будет скрыт из витрины\\. Студенты потеряют доступ к обучению\\.`,
      this.kb([
        [
          this.btn(
            '✅ Да, в архив',
            this.cbFor('view-stream-mentor', 'archive-confirm', streamId),
          ),
          this.btn(
            '❌ Отмена',
            this.cbFor('view-stream-mentor', 'view', streamId),
          ),
        ],
      ]),
    );
  }

  // ── Менторские действия ──

  async #handleComplete(
    streamId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      StreamModuleDef,
      CompleteStreamUcDef.command({ streamId }),
      actor,
    );
    if (!res.ok) {
      // Прежний текст отказа: число студентов без исхода
      if (res.error.code === StreamErrors.STUDENTS_IN_PROGRESS.code) {
        const pending = (
          res.error.payload as { pending: readonly unknown[] } | undefined
        )?.pending;
        return this.warn(
          md`Нельзя завершить поток: ${pending?.length ?? 0} студентов ещё учатся\\. Сначала укажите исход для каждого\\.`,
        );
      }
      return this.ucErrorNotify(res.error);
    }
    return this.screen(
      md`✅ *Поток завершён\\!* Обучение окончено\\.`,
      this.kb([
        [this.btn('⬅️ Назад к списку', this.cbFor('my-streams', 'list'))],
      ]),
    );
  }

  async #handleArchive(
    streamId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      StreamModuleDef,
      ArchiveStreamUcDef.command({ streamId }),
      actor,
    );
    if (!res.ok) return this.ucErrorNotify(res.error);
    return this.screen(
      md`📁 *Поток перемещён в архив\\.*`,
      this.kb([
        [this.btn('⬅️ Назад к списку', this.cbFor('my-streams', 'list'))],
      ]),
    );
  }
}
