import type { User } from '@u7-scl/app-legacy/domain';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import { type MdText, md, mdConcat, mdJoin, mdRaw } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse, KbButton } from '@u7-scl/core/ui';
import {
  CompleteStudentUcDef,
  GetStreamMembersUcDef,
  GetStreamUcDef,
  GetStudentProgressUcDef,
  MarkAbandonedUcDef,
  StreamModuleDef,
  type StudentProgress,
} from '@u7-scl/domain/stream/contract';
import type { StreamDispatch } from '../../learning/shared';
import {
  lagMarker,
  loadStudentRows,
  outcomeIcon,
  outcomeLabel,
} from '../../shared/student-rows';

/**
 * US-8: Мониторинг прогресса группы.
 * Публичный список студентов с прогресс-барами.
 * Детальная карточка — кнопки действий только для ментора потока.
 */
export class MonitorStory extends U7BotUiStory {
  readonly name = 'monitor';

  async handleCallback(
    action: string,
    actor: User,
    session: BotSession,
  ): Promise<DialogResponse> {
    const [cmd, id] = action.split(':');

    // Детальная карточка студента
    if (cmd === 'detail' && id) {
      return this.#handleDetail(id, actor);
    }

    // История шагов — ещё не реализована
    if (cmd === 'history' && id) {
      return this.screen(
        md`🚧 История шагов ещё не реализована, но скоро будет\\.`,
      );
    }

    // mark-abandoned — подтверждение
    if (cmd === 'mark-abandoned' && id) {
      return this.#handleMarkAbandonedConfirm(id, actor);
    }

    // mark-abandoned — выполнить
    if (cmd === 'mark-abandoned-confirm' && id) {
      return this.#handleMarkAbandonedExecute(id, actor);
    }

    // complete-student — выбор исхода
    if (cmd === 'complete' && id) {
      return this.#handleCompleteChoice(id);
    }

    // complete-student — подтверждение исхода (confirm-диалог)
    if (cmd === 'complete-confirm' && id) {
      return this.#handleCompleteConfirm(id, action, actor);
    }

    // complete-student — выполнение (после подтверждения)
    if (cmd === 'complete-confirm-confirm' && id) {
      return this.#handleCompleteExecute(id, actor, action);
    }

    if (cmd === 'students' && id) {
      return this.#handleStudents(id, actor, false);
    }

    // Список студентов — режим «все» (с выбывшими, FR-8)
    if (cmd === 'students-all' && id) {
      return this.#handleStudents(id, actor, true);
    }

    return this.unknownCommand(action, actor, session);
  }

  // ── Приватные методы ──

  async #handleStudents(
    streamId: string,
    actor: User,
    showAll: boolean,
  ): Promise<DialogResponse> {
    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const stream = loaded.value;

    const membersRes = await this.dispatchUc(
      StreamModuleDef,
      GetStreamMembersUcDef.command({ streamId }),
      actor,
    );
    if (!membersRes.ok) return this.ucErrorNotify(membersRes.error);
    const students = membersRes.value?.students ?? [];
    const lagMap = new Map(
      (membersRes.value?.roster ?? []).map((r) => [r.studentId, r.lagLevel]),
    );

    // FR-8: по умолчанию — только активные (active/enrolled);
    // режим «все» показывает и выбывших (метрики в нём — тоже по всем)
    const visible = showAll ? students : students.filter((s) => s.inProgress);

    const built = await loadStudentRows(
      this.#dispatchFor(actor),
      (userId) => this.#userName(userId),
      visible,
      lagMap,
    );
    if (!built.ok) return this.ucErrorNotify(built.error);
    const rows = built.rows;

    // Сортировка: 🛑 → ⚠️ → 🏃 по прогрессу → ✅
    const lagOrder: Record<string, number> = {
      critical: 0,
      lagging: 1,
      on_track: 2,
    };

    rows.sort((a, b) => {
      const la = lagOrder[a.lagLevel] ?? 3;
      const lb = lagOrder[b.lagLevel] ?? 3;
      if (la !== lb) return la - lb;

      // Завершённые (исход зафиксирован) — в конец
      const aDone = a.student.outcome.category !== 'in_progress';
      const bDone = b.student.outcome.category !== 'in_progress';
      if (aDone !== bDone) return aDone ? 1 : -1;

      // По убыванию прогресса
      return b.progress.percent - a.progress.percent;
    });

    // Статистика
    let activeCount = 0;
    let advancedCount = 0;
    let notAdvancedCount = 0;
    let abandonedCount = 0;

    for (const r of rows) {
      const { category, signs } = r.student.outcome;
      if (category === 'in_progress') {
        activeCount++;
      } else if (category === 'abandoned') {
        abandonedCount++;
      } else if (signs.includes('passed')) {
        advancedCount++;
      } else {
        notAdvancedCount++;
      }
    }

    // Клавиатура
    const keyboardRows: KbButton[][] = [];

    const canManage = stream.canManage;

    // Строки студентов для текста сообщения
    const studentLines: MdText[] = [];

    for (const r of rows) {
      const marker = lagMarker(r.lagLevel, r.student);
      // Учится сейчас: живая запись, уже начавшая (не зачисление) —
      // признаки агрегата StudentAr (ФР‑10)
      const isActive = r.student.inProgress && !r.student.enrolled;

      // Текст: маркер, имя, прогресс-бар, категория времени
      const bar = this.#formatProgressBar(
        r.progress.completed,
        r.progress.total,
      );
      const parts: MdText[] = [
        md`${marker} ${r.name}`,
        mdConcat(bar, md` ${r.progress.percent}%`),
      ];
      if (r.dominantCategory && r.medianTimeMinutes !== null) {
        parts.push(
          mdConcat(
            md`${r.dominantCategory.emoji} ${r.dominantCategory.name}: `,
            md`${r.medianTimeMinutes} мин`,
          ),
        );
      }
      studentLines.push(mdJoin(parts, ' \\| '));

      // Кнопка: только эмодзи + имя + процент
      const nameBtn = `${marker} ${r.name} — ${r.progress.percent}%`;

      const studentRow: KbButton[] = [
        this.btn(nameBtn, this.cbFor('monitor', 'detail', r.student.uuid)),
      ];

      if (isActive && canManage) {
        studentRow.push(
          this.btn(
            '⛔',
            this.cbFor('monitor', 'mark-abandoned', r.student.uuid),
          ),
        );
        studentRow.push(
          this.btn('✅', this.cbFor('monitor', 'complete', r.student.uuid)),
        );
      } else if (canManage && r.student.outcome.category === 'completed') {
        studentRow.push(
          this.btn('🔄', this.cbFor('monitor', 'complete', r.student.uuid)),
        );
      }

      keyboardRows.push(studentRow);
    }

    // FR-8: кнопка-переключатель фильтра выбывших
    keyboardRows.push([
      this.btn(
        showAll ? '🙈 Скрыть выбывших' : '🚪 Показать выбывших',
        this.cbFor('monitor', showAll ? 'students' : 'students-all', streamId),
      ),
    ]);

    keyboardRows.push([
      this.btn(
        '⬅️ Назад к потоку',
        this.cbFor('view-stream-mentor', 'view', streamId),
      ),
    ]);

    // Сводка FR-8: всегда видна, от режима не зависит (по всем студентам)
    const activeTotal = students.filter((s) => s.inProgress).length;
    const departedTotal = students.length - activeTotal;
    const countLabel = this.#pluralize(
      students.length,
      'студент',
      'студента',
      'студентов',
    );

    const header: MdText[] = [
      md`👥 *Студенты потока* — _${stream.title}_`,
      md``,
      md`Всего: ${students.length} ${countLabel}, из них ${activeTotal} ${this.#pluralize(activeTotal, 'активный', 'активных', 'активных')}, ${departedTotal} выбывших`,
    ];

    // Метрики группы (с заголовком)
    const metrics: string[] = [];
    if (activeCount > 0) metrics.push(`🏃 В процессе: ${activeCount}`);
    if (advancedCount > 0) metrics.push(`✅ Прошли: ${advancedCount}`);
    if (notAdvancedCount > 0) metrics.push(`↩️ Не прошли: ${notAdvancedCount}`);
    if (abandonedCount > 0) metrics.push(`🚫 Выбыли: ${abandonedCount}`);

    header.push(md``, md`———`);

    if (metrics.length > 0) {
      header.push(md``, md`*Метрики группы:*`);
      for (const m of metrics) {
        header.push(mdRaw(m));
      }
    }

    header.push(
      md``,
      md`*Легенда:*`,
      md`🏃 учится   ✅ прошёл   ↩️ не прошёл   🚫 выбыл`,
      md``,
      md`———`,
      md``,
      md`*Метрики по студентам:*`,
      ...studentLines,
      md``,
      md`*Легенда:*`,
      md`🛑 критическое отставание, кандидат на снятие с учёбы`,
      md`⚠️ учится, но отстаёт от группы`,
      md`🏃 в норме, учится`,
      md`🚫 выбыл из учёбы`,
      md`↩️ завершил модуль, но пройдет заново`,
      md`✅ завершил модуль, проходит дальше`,
    );

    return this.screen(mdJoin(header), this.kb(keyboardRows));
  }

  /**
   * Форматирует прогресс-бар для Telegram MarkdownV2.
   * Скобки экранированы: \[ ████░░░░ \]
   * Возвращает уже размеченный текст (mdRaw — экранирование внутри).
   */
  #formatProgressBar(completed: number, total: number): MdText {
    const width = 10;
    const filled = total === 0 ? 0 : Math.round((completed / total) * width);
    const empty = width - filled;
    return mdRaw(
      `\\[${'█'.repeat(filled)}${'░'.repeat(empty)}\\] ${completed}/${total}`,
    );
  }

  /** Склоняет существительное: 1 студент, 2 студента, 5 студентов */
  #pluralize(n: number, one: string, few: string, many: string): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }

  /** Команды модуля `stream` от имени актора — для хелперов списков. */
  #dispatchFor(actor: User): StreamDispatch {
    return (command) => this.dispatchUc(StreamModuleDef, command, actor);
  }

  /** Имя пользователя по uuid (fallback — первые 8 символов id). */
  async #userName(userId: string): Promise<string> {
    try {
      const user = await this.appApi.execute('get-user', { uuid: userId });
      return user.name;
    } catch {
      return userId.slice(0, 8);
    }
  }

  /** Запись студента, расчёты и имя; отказ UC — готовый ответ с ошибкой. */
  async #loadStudent(
    studentId: string,
    actor: User,
  ): Promise<
    | {
        ok: true;
        student: StudentProgress['student'];
        progress: StudentProgress['progress'];
        userName: string;
      }
    | { ok: false; response: DialogResponse }
  > {
    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStudentProgressUcDef.command({ studentId }),
      actor,
    );
    if (!loaded.ok) {
      return { ok: false, response: this.ucErrorNotify(loaded.error) };
    }
    const { student, progress } = loaded.value;
    return {
      ok: true,
      student,
      progress,
      userName: await this.#userName(student.userId),
    };
  }

  async #handleDetail(studentId: string, actor: User): Promise<DialogResponse> {
    const loadedStudent = await this.#loadStudent(studentId, actor);
    if (!loadedStudent.ok) return loadedStudent.response;
    const { student, progress, userName } = loadedStudent;
    if (!progress) return this.warn(md`Поток не найден`);
    const { card } = progress;

    const bar = (c: number, t: number) => this.#formatProgressBar(c, t);
    const lines: MdText[] = [
      mdConcat(
        md`👤 *${userName}* \\| `,
        md`${outcomeIcon(student)} ${outcomeLabel(student)}`,
      ),
      md``,
      md`———`,
      md``,
      md`*Прогресс студента:*`,
      mdConcat(
        mdRaw(
          `📊 Прогресс по модулю: ${bar(card.moduleProgress.completed, card.moduleProgress.total)} \\| `,
        ),
        md`${card.moduleProgress.percent}%`,
      ),
    ];

    // Проект и урок
    if (card.currentProject) {
      lines.push(md``, md`📁 Проект: «${card.currentProject.title}»`);
      if (card.currentLesson) {
        lines.push(md`📝 Урок: «${card.currentLesson.title}»`);
      }
      lines.push(
        mdConcat(
          mdRaw(
            `📊 Прогресс по проекту: ${bar(card.currentProject.progress.completed, card.currentProject.progress.total)} \\| `,
          ),
          md`${card.currentProject.progress.percent}%`,
        ),
      );
    }

    // Усидчивость студента
    lines.push(md``, md`———`, md``, md`*Усидчивость студента:*`);

    // Среднее время
    if (card.medianTimeMinutes !== null) {
      lines.push(
        md``,
        md`⏱ Типичное время на шаг: ${card.medianTimeMinutes} мин\\.`,
      );
    }

    // Категории времени с описаниями (каждая с новой строки)
    const catDescs: Record<string, string> = {
      Бегун: '< 1 мин\\.',
      Спринтер: '< 5 мин\\.',
      Вдумчивый: '< 15 мин\\.',
      Исследователь: '\\> 15 мин\\.',
    };
    for (const c of card.timeCategories) {
      const desc = catDescs[c.name] ?? '';
      lines.push(
        mdConcat(
          md`${c.emoji} ${c.name} `,
          mdRaw(`\\(${desc}\\)`),
          md`: ${c.count} шаг\\(ов\\)`,
        ),
      );
    }
    // Активность студента
    lines.push(md``, md`———`, md``, md`*Активность студента:*`);

    // Последняя активность
    const hours = Math.round(card.hoursSinceLastActivity);
    if (hours > 0) {
      const days = Math.round(hours / 24);
      if (days >= 1) {
        lines.push(md``, md`📅 Последняя активность: ${days} дн\\. назад`);
      } else {
        lines.push(md``, md`📅 Последняя активность: ${hours} ч\\. назад`);
      }
    }

    // Отставание / статус: учится сейчас (живая запись, не зачисление) —
    // признаки агрегата StudentAr (ФР‑10)
    if (student.inProgress && !student.enrolled) {
      if (card.lagLevel === 'critical') {
        const days = Math.round(card.hoursSinceLastActivity / 24);
        lines.push(md``, md`🛑 Критическое отставание: ${days} дн\\.`);
      } else if (card.lagLevel === 'lagging') {
        if (card.hoursSinceLastActivity > 4 * 24) {
          const days = Math.round(card.hoursSinceLastActivity / 24);
          lines.push(md``, md`⚠️ Отстаёт: ${days} дн\\.`);
        } else {
          lines.push(md``, md`⚠️ Отстаёт от группы`);
        }
      } else {
        lines.push(md``, md`✅ Идёт по расписанию`);
      }
    }

    // Клавиатура: только навигация
    const keyboardRows: KbButton[][] = [
      [
        this.btn(
          '⬅️ Назад к списку',
          this.cbFor('monitor', 'students', student.streamId),
        ),
      ],
    ];

    return this.screen(mdJoin(lines), this.kb(keyboardRows));
  }

  // ── mark-abandoned ──

  async #handleMarkAbandonedConfirm(
    studentId: string,
    actor: User,
  ): Promise<DialogResponse> {
    const loadedStudent = await this.#loadStudent(studentId, actor);
    if (!loadedStudent.ok) return loadedStudent.response;
    const { userName } = loadedStudent;

    return this.confirm(
      'mark-abandoned',
      studentId,
      md`⚠️ Снять студента *${userName}* с учёбы за бездействие?`,
      {
        confirmButton: '⚠️ Да, неактивен',
      },
    );
  }

  async #handleMarkAbandonedExecute(
    studentId: string,
    actor: User,
  ): Promise<DialogResponse> {
    const loadedStudent = await this.#loadStudent(studentId, actor);
    if (!loadedStudent.ok) return loadedStudent.response;
    const { student, userName } = loadedStudent;

    const abandoned = await this.dispatchUc(
      StreamModuleDef,
      MarkAbandonedUcDef.command({
        streamId: student.streamId,
        studentId,
        cause: 'inactivity',
      }),
      actor,
    );
    if (!abandoned.ok) return this.ucErrorNotify(abandoned.error);

    return {
      // Реплика результата — notify (поверх целевого экрана delegate,
      // #resolveDelegate сохраняет initiator.notify над target.screen)
      ...this.notify(md`✅ Студент *${userName}* снят с учёбы\\.`),
      ...this.go(this.cbFor('monitor', 'students', student.streamId)),
    };
  }

  // ── complete-student (выбор исхода) ──

  async #handleCompleteChoice(studentId: string): Promise<DialogResponse> {
    // Термины унифицированы по спеке трека (см. spec.md ФР-2):
    // «окончил», «окончил, не прошёл», «забросил».
    const keyboardRows: KbButton[][] = [
      [
        this.btn(
          '✅ окончил',
          `${this.cbFor('monitor', 'complete-confirm', studentId)}:advanced`,
        ),
      ],
      [
        this.btn(
          '↩️ окончил, не прошёл',
          `${this.cbFor('monitor', 'complete-confirm', studentId)}:not_advanced`,
        ),
      ],
      [
        this.btn(
          '🔴 забросил',
          `${this.cbFor('monitor', 'complete-confirm', studentId)}:abandoned`,
        ),
      ],
      [this.btn('❌ Отмена', this.cbFor('monitor', 'detail', studentId))],
    ];

    return this.screen(md`Выберите исход для студента:`, this.kb(keyboardRows));
  }

  async #handleCompleteConfirm(
    studentId: string,
    action: string,
    actor: User,
  ): Promise<DialogResponse> {
    // action = 'complete-confirm:studentId:outcome'
    const parts = action.split(':');
    const outcome = parts[2]; // advanced | not_advanced | abandoned

    const loadedStudent = await this.#loadStudent(studentId, actor);
    if (!loadedStudent.ok) return loadedStudent.response;
    const { userName } = loadedStudent;

    // Связка «команда UC → подпись исхода»; термины — унифицированные литералы
    const outcomeLabels: Record<string, string> = {
      advanced: 'окончил',
      not_advanced: 'окончил, не прошёл',
      abandoned: 'забросил',
    };

    // confirm-диалог использует действие 'complete-confirm' → кнопка подтверждения
    // получает код 'complete-confirm-confirm:studentId:outcome' (см. #handleCompleteExecute).
    // Это развязывает confirm-диалог и выполнение, избегая зацикливания.
    return this.confirm(
      'complete-confirm',
      studentId,
      md`Завершить студента *${userName}* с исходом «${outcomeLabels[outcome ?? ''] ?? outcome}»?`,
      {
        confirmButton: '✅ Завершить',
        extraData: outcome,
      },
    );
  }

  async #handleCompleteExecute(
    studentId: string,
    actor: User,
    action: string,
  ): Promise<DialogResponse> {
    // action = 'complete-confirm-confirm:studentId:outcome'
    const parts = action.split(':');
    const rawOutcome = parts[2]; // advanced | not_advanced | abandoned
    if (
      rawOutcome !== 'advanced' &&
      rawOutcome !== 'not_advanced' &&
      rawOutcome !== 'abandoned'
    ) {
      return this.screen(md`⚠️ Неизвестный исход`);
    }
    const outcome = rawOutcome;

    const loadedStudent = await this.#loadStudent(studentId, actor);
    if (!loadedStudent.ok) return loadedStudent.response;
    const { student, userName } = loadedStudent;

    // «забросил» — снятие ментором (by_mentor); исход прохождения — завершение
    const result =
      outcome === 'abandoned'
        ? await this.dispatchUc(
            StreamModuleDef,
            MarkAbandonedUcDef.command({
              streamId: student.streamId,
              studentId,
              cause: 'by_mentor',
            }),
            actor,
          )
        : await this.dispatchUc(
            StreamModuleDef,
            CompleteStudentUcDef.command({
              streamId: student.streamId,
              studentId,
              outcome,
            }),
            actor,
          );
    if (!result.ok) return this.ucErrorNotify(result.error);

    return {
      // Реплика результата — notify (см. #handleMarkAbandonedExecute)
      ...this.notify(md`✅ Студент *${userName}* завершён\\.`),
      ...this.go(this.cbFor('monitor', 'students', student.streamId)),
    };
  }
}
