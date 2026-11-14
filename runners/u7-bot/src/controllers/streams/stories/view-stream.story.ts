import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import { type MdText, md, mdConcat, mdJoin, mdRaw } from '@u7-scl/core/shared';
import {
  type BotSession,
  type DialogResponse,
  type KbButton,
  type KeyboardDescription,
  type MessageUpdate,
  presentNavLevel,
  type StepContentData,
} from '@u7-scl/core/ui';
import { CourseModuleDef, GetStepUcDef } from '@u7-scl/domain/course/contract';
import {
  ListScopeFactsUcDef,
  PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review/contract';
import {
  EnrollStudentUcDef,
  GetActiveStudentUcDef,
  GetStreamMembersUcDef,
  GetStreamUcDef,
  GetStudentProgressUcDef,
  StreamModuleDef,
  type StreamWithRights,
  StudentErrors,
} from '@u7-scl/domain/stream/contract';
import {
  loadStepDescriptions,
  type StreamDispatch,
} from '../../learning/shared';
import { Routes } from '../../shared/routes';
import {
  lagMarker,
  loadStudentRows,
  outcomeIcon,
  outcomeLabel,
} from '../../shared/student-rows';
import { resolveStreamNavLevel } from '../stream-nav-resolver';

/** Контекст awaitInput при вводе кодового слова */
interface EnrollKeyContext {
  streamId: string;
  attempts: number;
}

const MAX_ENROLL_ATTEMPTS = 3;

/**
 * S02-S04: Детальная карточка потока (curious-режим).
 * Показывает описание, статус, дату старта, имя ментора и публичные кнопки.
 */
export class ViewStreamStory extends U7BotUiStory {
  readonly name: string = 'view-stream';

  /** Имя сторис для cbFor. */
  protected storyName = 'view-stream';

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    const [cmd, streamId] = action.split(':');

    if ((cmd === 'program' || cmd === 'prog') && streamId) {
      return this.handleProgramView(action, actor, session);
    }

    if (cmd === 'details' && streamId) {
      return this.handleDetailsView(streamId, actor);
    }

    if (cmd === 'students' && streamId) {
      return this.handleStudentsList(streamId, actor);
    }

    if (cmd === 'student-detail' && streamId) {
      return this.#handleStudentDetail(streamId, actor);
    }

    if (cmd === 'enroll' && streamId) {
      return this.handleEnrollStart(streamId, actor);
    }

    if (cmd === 'cancel' && streamId) {
      return this.handleEnrollCancel(streamId);
    }

    if (cmd !== 'view' || !streamId) {
      return this.unknownCommand(action, actor, session);
    }

    return this.handleView(streamId, actor);
  }

  override async handleMessage(
    update: MessageUpdate,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    if (update.type !== 'text') {
      return this.warn(md`Ожидалось текстовое сообщение\\.`);
    }

    const ctx = session.dialog?.input?.context as EnrollKeyContext | undefined;
    if (!ctx) {
      // Ввод без ожидания — страховочный отказ (диалог не ждёт кодовое слово)
      return {
        ...this.notify(
          md`Извините, на данном этапе сообщения не принимаются\\.`,
        ),
        release: true,
      };
    }

    // Кодовое слово проверяет зачисление; UI его не знает (оно не выходит из потока)
    return this.#doEnroll(ctx.streamId, actor, update.text, ctx.attempts);
  }

  // ── Защищённые методы (доступны для наследования) ──

  protected async handleView(
    streamId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const stream = loaded.value;
    let studentCount = 0;
    try {
      const members = await this.dispatchUc(
        StreamModuleDef,
        GetStreamMembersUcDef.command({ streamId }),
        actor,
      );
      // не ok — счётчик не критичен для карточки
      if (members.ok) studentCount = members.value?.students.length ?? 0;
    } catch {
      // исключение диспетчера — как и отказ: карточку не ломаем
    }

    const hasReviews = await this.#streamHasReviews(streamId, actor);

    let mentorName = '';
    try {
      const mentor = await this.findUser(stream.mentorId, actor);
      mentorName = mentor?.name ?? '';
    } catch {
      // имя ментора не критично для карточки
    }

    const statusLabels: Record<string, string> = {
      enrollment: '🟡 Набор открыт',
      active: '🔵 Идёт обучение',
      completed: '🟢 Завершён',
      archived: '⚫ Архивирован',
    };

    const startIso = new Date(stream.startDate).toISOString();
    const dateStr = this.formatDate(startIso);
    const timeStr = this.#formatTime(startIso);

    const text = mdJoin([
      md`📋 *${stream.title}*`,
      md``,
      md`_${stream.description}_`,
      md``,
      md`👤 Ментор: ${mentorName}`,
      md`📅 Старт: ${dateStr}`,
      md`🕐 Время: ${timeStr}`,
      md`👥 Студентов: ${studentCount}`,
      md`📌 Статус: ${statusLabels[stream.status] ?? stream.status}`,
      md`📚 Курс: Fullstack JS`,
    ]);

    // Запись доступна, пока нет живой записи студента: спрашиваем, только
    // если кнопка «Записаться» вообще возможна
    const canEnroll =
      !stream.canManage && stream.isEnrolling
        ? await this.#canEnroll(actor)
        : false;
    const keyboard = this.buildKeyboard(stream, actor, {
      hasReviews,
      canEnroll,
    });

    return this.screen(text, keyboard.rows.length > 0 ? keyboard : undefined);
  }

  /**
   * Можно ли записаться: нет живой записи студента (учится или зачислен).
   * Ошибки домена карточку не ломают — запись разрешена, отказ даст зачисление.
   */
  async #canEnroll(actor: U7BotActor): Promise<boolean> {
    try {
      const active = await this.dispatchUc(
        StreamModuleDef,
        GetActiveStudentUcDef.command({ userId: actor.user.uuid }),
        actor,
      );
      return !(active.ok && active.value.student);
    } catch {
      return true;
    }
  }

  /** Команды модуля `stream` от имени актора — для хелперов списков. */
  #dispatchFor(actor: U7BotActor): StreamDispatch {
    return (command) => this.dispatchUc(StreamModuleDef, command, actor);
  }

  /** Имя пользователя по uuid (fallback — первые 8 символов id). */
  async #userName(userId: string, actor: U7BotActor): Promise<string> {
    try {
      const user = await this.findUser(userId, actor);
      return user?.name ?? userId.slice(0, 8);
    } catch {
      return userId.slice(0, 8);
    }
  }

  /** Есть ли отзывы по потоку (S07): ошибки домена — карточку не ломают. */
  async #streamHasReviews(
    streamId: string,
    actor: U7BotActor,
  ): Promise<boolean> {
    try {
      const facts = await this.dispatchUc(
        PeerReviewModuleDef,
        ListScopeFactsUcDef.command({ scopeId: streamId }),
        actor,
      );
      // не ok — факты недоступны, кнопки отзывов не будет
      return facts.ok && facts.value.hasReviews;
    } catch {
      // исключение диспетчера — как и отказ: карточку потока не ломаем
      return false;
    }
  }

  /**
   * Карточная drill-down программа модуля потока (S03).
   * Поддерживает режимы ментора (чтение всех шагов) и зрителя (только заголовки шагов).
   */
  protected async handleProgramView(
    actionOrStreamId: string,
    actor: U7BotActor,
    _session: BotSession,
    _pageIndex = 0,
  ): Promise<DialogResponse> {
    let streamId: string;
    let level: 'root' | 'project' | 'lesson' | 'step' = 'root';
    let targetId: string | undefined;

    if (
      actionOrStreamId.startsWith('program:') ||
      actionOrStreamId.startsWith('prog:')
    ) {
      const parts = actionOrStreamId.split(':');
      streamId = parts[1] ?? '';
      if (parts.length >= 4) {
        level = (parts[2] as 'root' | 'project' | 'lesson' | 'step') || 'root';
        targetId = parts[3];
      } else if (
        parts.length === 3 &&
        parts[2] !== 'root' &&
        Number.isNaN(Number(parts[2]))
      ) {
        level = (parts[2] as 'root' | 'project' | 'lesson' | 'step') || 'root';
      }
    } else {
      streamId = actionOrStreamId;
    }

    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const stream = loaded.value;

    if (!stream.contentSnapshot || stream.contentSnapshot.length === 0) {
      return this.screen(
        md`📖 *Программа модуля*\n\nПрограмма пока не загружена\\.`,
        this.kb([
          [
            this.btn(
              '⬅️ Назад к потоку',
              this.cbFor(this.storyName, 'view', streamId),
            ),
          ],
        ]),
      );
    }

    const canEdit = stream.canManage;
    if (this.storyName === 'view-stream-mentor' && !canEdit) {
      return this.screen(md`⛔ У вас нет прав для управления этим потоком\\.`);
    }

    const mode = canEdit ? 'mentor' : 'viewer';

    if (level === 'step' && mode !== 'mentor') {
      return this.screen(md`⛔ Тела шагов недоступны для просмотра\\.`);
    }

    const stepDescriptions: Record<string, string> = {};
    let stepContent: StepContentData | undefined;

    if (level === 'project' && targetId) {
      const snapProject = stream.contentSnapshot?.find(
        (p) => p.projectId === targetId,
      );
      if (snapProject) {
        const lessonIds = snapProject.lessons.map((l) => l.lessonId);
        const byLesson =
          (await loadStepDescriptions(
            (command) => this.dispatchUc(CourseModuleDef, command, actor),
            lessonIds,
          )) ?? {};
        for (const steps of Object.values(byLesson)) {
          if (Array.isArray(steps)) {
            for (const s of steps) {
              stepDescriptions[s.uuid] = s.description;
            }
          }
        }
      }
    } else if (level === 'lesson' && targetId) {
      const byLesson =
        (await loadStepDescriptions(
          (command) => this.dispatchUc(CourseModuleDef, command, actor),
          [targetId],
        )) ?? {};
      for (const steps of Object.values(byLesson)) {
        if (Array.isArray(steps)) {
          for (const s of steps) {
            stepDescriptions[s.uuid] = s.description;
          }
        }
      }
    } else if (level === 'step' && targetId) {
      const loaded = await this.dispatchUc(
        CourseModuleDef,
        GetStepUcDef.command({ stepId: targetId }),
        actor,
      );
      if (loaded.ok) {
        stepDescriptions[targetId] = loaded.value.description;
        stepContent = {
          kind: loaded.value.kind,
          content: loaded.value.content,
          code: loaded.value.kind === 'code' ? loaded.value.code : undefined,
        };
      }
    }

    const navLevel = resolveStreamNavLevel({
      stream,
      address: {
        level,
        targetId,
      },
      story: `${this.storyName}:prog:${streamId}`,
      mode,
      stepDescriptions,
      stepContent,
      rootBackAddress: this.cbFor(this.storyName, 'view', streamId),
    });

    if (!navLevel) {
      return this.screen(md`❌ Уровень программы не найден\\.`);
    }

    const { text, keyboard } = presentNavLevel(navLevel);
    return this.screen(text, keyboard);
  }

  protected async handleDetailsView(
    streamId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const stream = loaded.value;

    const fields: Array<{ label: string; value: string | undefined }> = [
      { label: '🎯 Цель', value: stream.goal },
      { label: '🏆 Результат', value: stream.result },
      { label: '📜 Правила', value: stream.rules },
      { label: '👤 Целевая аудитория', value: stream.targetAudience },
      { label: '📝 Дополнительно', value: stream.additional },
    ];

    const filled = fields.filter((f) => f.value);

    const lines: MdText[] = [md`📋 *Детали: ${stream.title}*`, md``];

    if (filled.length > 0) {
      for (const f of filled) {
        lines.push(md`${f.label}: ${f.value ?? ''}`);
      }
    } else {
      lines.push(md`_Расширенная информация пока не добавлена\\._`);
    }

    return this.screen(
      mdJoin(lines),
      this.kb([
        [
          this.btn(
            '⬅️ Назад к потоку',
            this.cbFor(this.storyName, 'view', streamId),
          ),
        ],
      ]),
    );
  }

  protected buildKeyboard(
    stream: StreamWithRights,
    _actor: U7BotActor,
    opts?: { hasReviews?: boolean; canEnroll?: boolean },
  ): KeyboardDescription {
    const canEnroll = opts?.canEnroll ?? false;
    const isOwnerMentor = stream.canManage;
    const rows: KbButton[][] = [];

    // ── Публичные кнопки (всем) ──

    // Информационные кнопки о курсе — рядом, первой строкой
    rows.push([
      this.btn(
        '📖 Программа модуля',
        this.cbFor(this.storyName, 'program', stream.uuid),
      ),
      this.btn('📋 Детали', this.cbFor(this.storyName, 'details', stream.uuid)),
    ]);

    // Кнопка «👥 Студенты» + «💬 Отзывы» (при наличии отзывов — мост
    // в S07 peer-review, трек peer-review-ui ФР-5)
    const peopleRow: KbButton[] = [
      this.btn(
        '👥 Студенты',
        this.cbFor(this.storyName, 'students', stream.uuid),
      ),
    ];
    if (opts?.hasReviews) {
      peopleRow.push(
        this.btn('💬 Отзывы', Routes.peerReview.scopeReviews(stream.uuid)),
      );
    }
    rows.push(peopleRow);

    // ── Гостевые кнопки ──
    if (!isOwnerMentor) {
      if (stream.isEnrolling && canEnroll) {
        rows.push([
          this.btn(
            '📝 Записаться',
            this.cbFor(this.storyName, 'enroll', stream.uuid),
          ),
        ]);
      }
    }

    // Кнопка «⬅️ Назад к списку» — возврат в каталог
    rows.push([this.btn('⬅️ Назад к списку', this.cbFor('catalog', 'list'))]);

    return this.kb(rows);
  }

  // ── Обработчик «👥 Студенты» ──

  protected async handleStudentsList(
    streamId: string,
    actor: U7BotActor,
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
    const members = membersRes.value?.students ?? [];
    const lagMap = new Map(
      (membersRes.value?.roster ?? []).map((r) => [r.studentId, r.lagLevel]),
    );

    const built = await loadStudentRows(
      this.#dispatchFor(actor),
      (userId) => this.#userName(userId, actor),
      members,
      lagMap,
    );
    if (!built.ok) return this.ucErrorNotify(built.error);
    const rows = built.rows;
    const studentCount = rows.length;

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

      const aDone = a.student.outcome.category !== 'in_progress';
      const bDone = b.student.outcome.category !== 'in_progress';
      if (aDone !== bDone) return aDone ? 1 : -1;

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

    const keyboardRows: KbButton[][] = [];

    // Строки студентов для текста
    const studentLines: MdText[] = [];

    for (const r of rows) {
      const marker = lagMarker(r.lagLevel, r.student);

      const bar = this.#formatProgressBar(
        r.progress.completed,
        r.progress.total,
      );
      const lineParts: MdText[] = [
        md`${marker} ${r.name}`,
        mdConcat(bar, md` ${r.progress.percent}%`),
      ];
      if (r.dominantCategory && r.medianTimeMinutes !== null) {
        lineParts.push(
          mdConcat(
            md`${r.dominantCategory.emoji} ${r.dominantCategory.name}: `,
            md`${r.medianTimeMinutes}`,
            md` мин`,
          ),
        );
      }
      studentLines.push(mdJoin(lineParts, ' \\| '));

      const nameBtn = `${marker} ${r.name} — ${r.progress.percent}%`;

      // Публичный режим: только кнопка-имя, ведёт в student-detail
      keyboardRows.push([
        this.btn(
          nameBtn,
          this.cbFor(this.storyName, 'student-detail', r.student.uuid),
        ),
      ]);
    }

    keyboardRows.push([
      this.btn(
        '⬅️ Назад к потоку',
        this.cbFor(this.storyName, 'view', streamId),
      ),
    ]);

    const countLabel = this.#pluralize(
      studentCount,
      'студент',
      'студента',
      'студентов',
    );

    const header: MdText[] = [
      md`👥 *Студенты потока* — _${stream.title}_`,
      md``,
      md`Всего: ${studentCount} ${countLabel}`,
    ];

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
   * Публичная карточка студента — полные метрики без менторских действий.
   * Вызывается из handleStudentsList при нажатии на имя студента.
   * Показывает: Прогресс студента, Усидчивость студента, Активность студента.
   */
  async #handleStudentDetail(
    studentId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const loadedProgress = await this.dispatchUc(
      StreamModuleDef,
      GetStudentProgressUcDef.command({ studentId }),
      actor,
    );
    if (!loadedProgress.ok) return this.ucErrorNotify(loadedProgress.error);
    const { student, progress } = loadedProgress.value;

    const userName = await this.#userName(student.userId, actor);

    if (!progress) return this.warn(md`Поток не найден`);

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
          `📊 Прогресс по модулю: ${bar(progress.card.moduleProgress.completed, progress.card.moduleProgress.total)} \\| `,
        ),
        md`${progress.card.moduleProgress.percent}%`,
      ),
    ];

    // Проект и урок
    if (progress.card.currentProject) {
      lines.push(md``, md`📁 Проект: «${progress.card.currentProject.title}»`);
      if (progress.card.currentLesson) {
        lines.push(md`📝 Урок: «${progress.card.currentLesson.title}»`);
      }
      lines.push(
        mdConcat(
          mdRaw(
            `📊 Прогресс по проекту: ${bar(progress.card.currentProject.progress.completed, progress.card.currentProject.progress.total)} \\| `,
          ),
          md`${progress.card.currentProject.progress.percent}%`,
        ),
      );
    }

    // Усидчивость студента
    lines.push(md``, md`———`, md``, md`*Усидчивость студента:*`);

    // Среднее время
    if (progress.card.medianTimeMinutes !== null) {
      lines.push(
        md``,
        md`⏱ Типичное время на шаг: ${progress.card.medianTimeMinutes} мин\\.`,
      );
    }

    // Категории времени с описаниями
    const catDescs: Record<string, string> = {
      Бегун: '< 1 мин\\.',
      Спринтер: '< 5 мин\\.',
      Вдумчивый: '< 15 мин\\.',
      Исследователь: '\\> 15 мин\\.',
    };
    for (const c of progress.card.timeCategories) {
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
    const hours = Math.round(progress.card.hoursSinceLastActivity);
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
      if (progress.card.lagLevel === 'critical') {
        const days = Math.round(progress.card.hoursSinceLastActivity / 24);
        lines.push(md``, md`🛑 Критическое отставание: ${days} дн\\.`);
      } else if (progress.card.lagLevel === 'lagging') {
        if (progress.card.hoursSinceLastActivity > 4 * 24) {
          const days = Math.round(progress.card.hoursSinceLastActivity / 24);
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
          this.cbFor(this.storyName, 'students', student.streamId),
        ),
      ],
    ];

    return this.screen(mdJoin(lines), this.kb(keyboardRows));
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

  // ── Обработчики «📝 Записаться» ──

  protected async handleEnrollStart(
    streamId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);

    // Если нужно кодовое слово — запрашиваем его
    if (loaded.value.requiresEnrollmentKey) {
      return this.ask(
        md`🔑 Введите кодовое слово для записи на поток:`,
        { streamId, attempts: 0 } satisfies EnrollKeyContext,
        this.kb([
          [
            this.btn(
              '❌ Отмена',
              this.cbFor(this.storyName, 'cancel', streamId),
            ),
          ],
        ]),
      );
    }

    // Без кодового слова — сразу зачисляем
    return this.#doEnroll(streamId, actor);
  }

  protected async handleEnrollCancel(
    streamId: string,
  ): Promise<DialogResponse> {
    return {
      release: true,
      ...this.go(this.cbFor(this.storyName, 'view', streamId)),
    };
  }

  /** Неверное слово: переспрос с учётом попытки или возврат к потоку, когда попытки кончились */
  #wrongKey(streamId: string, attempts: number): DialogResponse {
    const attemptsLeft = MAX_ENROLL_ATTEMPTS - attempts - 1;
    if (attemptsLeft <= 0) {
      return {
        release: true,
        ...this.screen(
          md`❌ Попытки исчерпаны\\.\nВозврат к потоку — нажмите кнопку ниже\\.`,
          this.kb([
            [
              this.btn(
                '⬅️ Назад к потоку',
                this.cbFor(this.storyName, 'view', streamId),
              ),
            ],
          ]),
        ),
      };
    }
    return {
      ...this.warn(md`❌ Неверное слово\\. Осталось попыток: ${attemptsLeft}`),
      awaitInput: {
        context: {
          streamId,
          attempts: attempts + 1,
        } satisfies EnrollKeyContext,
      },
    };
  }

  async #doEnroll(
    streamId: string,
    actor: U7BotActor,
    enrollmentKey?: string,
    attempts = 0,
  ): Promise<DialogResponse> {
    const loaded = await this.dispatchUc(
      StreamModuleDef,
      GetStreamUcDef.command({ streamId }),
      actor,
    );
    if (!loaded.ok) return this.ucErrorNotify(loaded.error);
    const stream = loaded.value;

    const enrolled = await this.dispatchUc(
      StreamModuleDef,
      EnrollStudentUcDef.command({ streamId, enrollmentKey }),
      actor,
    );
    if (!enrolled.ok) {
      if (
        enrollmentKey !== undefined &&
        enrolled.error.code === StudentErrors.WRONG_ENROLLMENT_KEY.code
      ) {
        return this.#wrongKey(streamId, attempts);
      }
      if (enrolled.error.code === StudentErrors.PREREQUISITE_NOT_PASSED.code) {
        // Payload восстанавливается по схеме ошибки: без утверждения типа.
        const payload = StudentErrors.PREREQUISITE_NOT_PASSED.restore(
          enrolled.error.payload,
        )?.payload;
        // Payload не по схеме — текст ошибки без пустого названия модуля
        if (!payload) return this.warn(md`${enrolled.error.label}`);
        // Прежний текст отказа допуска к модулю
        return this.warn(md`Сначала пройдите модуль «${payload.moduleTitle}»`);
      }
      // Ошибки валидации/конфликты — реплика-переспрос без захвата экрана
      return this.ucErrorNotify(enrolled.error);
    }

    const dateStr = this.formatDate(new Date(stream.startDate).toISOString());
    const lines: MdText[] = [
      md`🎉 *Вы успешно записаны на поток\\!*`,
      md``,
      md`📋 _${stream.title}_`,
      md`📅 Обучение начнётся: ${dateStr}`,
      md``,
      md`Теперь вы можете получить функционал по учёбе, набрав /start и перейдя по кнопке «Моя учёба»`,
    ];

    if (stream.telegramGroupInvite) {
      lines.push(md``, md`🔗 ${stream.telegramGroupInvite}`);
    }

    return {
      ...this.notify(mdJoin(lines)),
      delegate: { path: Routes.app.mainMenu },
    };
  }

  #formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      const hh = String(d.getUTCHours()).padStart(2, '0');
      const min = String(d.getUTCMinutes()).padStart(2, '0');
      return `${hh}:${min}`;
    } catch {
      return iso;
    }
  }
}
