import { md } from '@u7-scl/core/shared';
import {
  type BotSession,
  type BotUpdate,
  type CommandReaction,
  type CommandUpdate,
  type DialogResponse,
  eventSubscription,
  type KbButton,
  type UiEventSubscription,
} from '@u7-scl/core/ui';
import {
  AbandonUcDef,
  GetCurrentUcDef,
  GetQuestionnairesByUserUcDef,
  HandleActionUcDef,
  type QuestionnaireActionResponse,
  QuestionnaireEvents,
  QuestionnaireModuleDef,
} from '@u7-scl/domain/questionnaire/contract';
import type { DomainError } from 'dmg-core';
import type { U7BotActor } from '../../../core/u7-bot-app-meta';
import { buttons } from '../../shared/buttons';
import { Routes } from '../../shared/routes';
import type {
  QuestionnaireAbandonedEvent,
  QuestionnaireAbandonWarningEvent,
  QuestionnaireContinueInviteEvent,
  QuestionnaireStartedEvent,
} from './questionnaire-events';
import { QuestionnaireStory } from './questionnaire-story';
import { renderActionResponse, ucErrorScreen } from './render';

/**
 * FillStory — сценарий заполнения анкеты (S02–S05, S07–S09).
 *
 * Вопросы, ответы, отмена и жизненный цикл брошенной анкеты
 * (предупреждение, приглашение продолжить, закрытие по таймауту).
 * Вызовы UC — через dispatchUc (модуль DMG), адрес проактивов — по профилю респондента.
 *
 * Контракт «Диалог и Экран»: анкета держит ввод (awaitInput с контекстом
 * { questionnaireId }) с момента входа в диалог (resume/current/start) до
 * завершения (release при completed/abandoned). Прерывание — только после
 * подтверждения: /cancel и кнопка «Прервать»
 * из S07/S09 показывают confirm-экран S05a.
 */
export class FillStory extends QuestionnaireStory {
  readonly name = 'fill';

  // ── Подписки на доменные события (вариант A: invite-канал, ФР-6) ──

  override getEventSubscriptions(): UiEventSubscription[] {
    return [
      eventSubscription(QuestionnaireEvents.started, (event) =>
        this.#handleStartEvent(event),
      ),
      eventSubscription(QuestionnaireEvents.abandonWarning, (event) =>
        this.#handleWarningEvent(event),
      ),
      eventSubscription(QuestionnaireEvents.continueInvite, (event) =>
        this.#handleContinueInviteEvent(event),
      ),
      eventSubscription(QuestionnaireEvents.abandoned, (event) =>
        this.#handleAbandonEvent(event),
      ),
    ];
  }

  /**
   * started (старт из каталога) — вариант A: сервер только
   * зовёт, диалог открывается действием пользователя. Кнопка-мост
   * fill:resume:{courseId}; без courseId — подсказка входа через меню.
   */
  async #handleStartEvent(event: QuestionnaireStartedEvent): Promise<void> {
    const { questionnaireId, respondentId, ownerInfo } = event.payload;
    const target = await this.resolveRespondent(respondentId, questionnaireId);
    if (!target) return;
    const { telegramId } = target;
    const courseId = ownerInfo.courseId;

    if (typeof courseId !== 'string') {
      await this.proactiveSender.notify(telegramId, {
        text: md`📋 *Анкета*\n\nДля вас подготовлена анкета — откройте её через /start\\.`,
      });
      return;
    }

    await this.proactiveSender.invite(telegramId, {
      text: md`📋 *Анкета*\n\nДля вас подготовлена анкета — заполните, пожалуйста\\.`,
      keyboard: this.kb([
        [this.btn('▶️ Заполнить анкету', Routes.questionnaire.resume(courseId))],
      ]),
    });
  }

  /**
   * abandonWarning (S07, ступень 6ч) — кнопочный проактив
   * через invite-канал: «Продолжить» (кнопка-мост по курсу) / «Прервать»
   * (confirm-экран S05a — прерывание только после подтверждения).
   */
  async #handleWarningEvent(
    event: QuestionnaireAbandonWarningEvent,
  ): Promise<void> {
    const { questionnaireId, respondentId, ownerInfo } = event.payload;
    const target = await this.resolveRespondent(respondentId, questionnaireId);
    if (!target) return;
    const { telegramId } = target;
    const rows = this.#lifecycleRows(
      ownerInfo.courseId,
      questionnaireId,
      '▶️ Продолжить',
    );

    await this.proactiveSender.invite(telegramId, {
      text: md`⏳ *Анкета приостановлена*\n\nМы заметили, что ты давно не заполнял анкету\\. Скоро она будет закрыта\\.\n\nПродолжить?`,
      keyboard: this.kb(rows),
    });
  }

  /**
   * continueInvite (S09, ступень 3ч) — приглашение
   * продолжить брошенную анкету, канал invite (ФР-6).
   */
  async #handleContinueInviteEvent(
    event: QuestionnaireContinueInviteEvent,
  ): Promise<void> {
    const { questionnaireId, respondentId, ownerInfo } = event.payload;
    const target = await this.resolveRespondent(respondentId, questionnaireId);
    if (!target) return;
    const { telegramId } = target;
    const rows = this.#lifecycleRows(
      ownerInfo.courseId,
      questionnaireId,
      '▶️ Продолжить анкету',
    );

    await this.proactiveSender.invite(telegramId, {
      text: md`📋 *Анкета*\n\nВы начали заполнять анкету — продолжим?`,
      keyboard: this.kb(rows),
    });
  }

  /**
   * abandoned — уведомление о принудительном закрытии (S08).
   * Только reason='timeout': при ручном прерывании пользователь уже
   * получил экран «Анкета прервана» — дублировать не нужно.
   */
  async #handleAbandonEvent(event: QuestionnaireAbandonedEvent): Promise<void> {
    const { reason, respondentId, questionnaireId } = event.payload;
    if (reason !== 'timeout') {
      return;
    }
    const target = await this.resolveRespondent(respondentId, questionnaireId);
    if (!target) return;
    const { telegramId } = target;

    await this.proactiveSender.notify(telegramId, {
      text: md`⏱ Анкета была закрыта из\\-за длительной неактивности\\.`,
    });
  }

  /** Кнопки S07/S09: продолжить (если анкета привязана к курсу) / прервать. */
  #lifecycleRows(
    courseId: unknown,
    questionnaireId: string,
    continueText: string,
  ): KbButton[][] {
    const rows: KbButton[][] = [];
    if (typeof courseId === 'string') {
      rows.push([
        this.btn(continueText, Routes.questionnaire.resume(courseId)),
      ]);
    }
    rows.push([
      this.btn('⏭️ Прервать', Routes.questionnaire.fillCancel(questionnaireId)),
    ]);
    return rows;
  }

  // ── Callback ──

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    // fill:resume:{courseId}
    if (action.startsWith('resume:')) {
      const courseId = action.slice(7);
      return this.#handleResume(courseId, actor);
    }

    // fill:cancel-confirm:{qId} — подтверждённое прерывание (S05b)
    if (action.startsWith('cancel-confirm:')) {
      const qId = action.slice(15);
      return this.#handleCancelConfirmed(qId, actor);
    }

    // fill:cancel:{qId} — confirm-экран прерывания (S05a)
    if (action.startsWith('cancel:')) {
      const qId = action.slice(7);
      return this.#cancelConfirmScreen(qId, actor, ucErrorScreen);
    }

    // fill:current:{qId} — восстановление флоу (кнопка «Нет, продолжить»)
    if (action.startsWith('current:')) {
      const qId = action.slice(8);
      return this.#showCurrent(qId, actor);
    }

    // fill:answer:{qId}:{aCode}
    if (action.startsWith('answer:')) {
      const rest = action.slice(7);
      const colonIdx = rest.indexOf(':');
      if (colonIdx === -1) return this.unknownCommand(action, actor, session);
      const qId = rest.slice(0, colonIdx);
      const aCode = rest.slice(colonIdx + 1);
      // Протокол UC: выбор — callback (value = код ответа)
      return this.#handleInput(qId, 'callback', aCode, actor);
    }

    // fill:next:{qId}:{qCode}
    if (action.startsWith('next:')) {
      const rest = action.slice(5);
      const colonIdx = rest.indexOf(':');
      if (colonIdx === -1) return this.unknownCommand(action, actor, session);
      const qId = rest.slice(0, colonIdx);
      const qCode = rest.slice(colonIdx + 1);
      return this.#handleInput(qId, 'callback', `next:${qCode}`, actor);
    }

    return this.unknownCommand(action, actor, session);
  }

  // ── Сообщения (текстовые ответы анкеты) ──

  override async handleMessage(
    update: BotUpdate,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    if (update.type !== 'message') {
      // Анкета ждёт текст: документ/фото/войс — переспрос, ввод живёт
      return this.warn(md`Пожалуйста, введите ваш ответ текстом\.`);
    }

    const qId = this.#qIdOf(session);
    if (!qId) {
      this.logger?.warn('fill-story', 'Текстовый ввод без контекста анкеты', {
        dialogPath: session.dialog?.path,
      });
      return {
        ...this.warn(md`Анкета не найдена — начните с /start\\.`),
        release: true,
      };
    }

    return this.#handleInput(qId, 'text', update.text, actor);
  }

  /** Ввод пользователя: ответ UC в экран, отказ — warn поверх вопроса. */
  async #handleInput(
    qId: string,
    type: 'callback' | 'text',
    value: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      QuestionnaireModuleDef,
      HandleActionUcDef.command({ questionnaireId: qId, type, value }),
      actor,
    );
    if (!res.ok) return this.ucErrorNotify(res.error);
    return this.#renderUc(res.value, qId, value);
  }

  // ── Команды: /cancel — подтверждение перед прерыванием ──

  override async handleCommand(
    update: CommandUpdate,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<CommandReaction> {
    if (update.command === 'cancel' && this.isActive(session)) {
      // qId берём из контекста ввода ДО того, как ядро переоткроет меню
      const qId = this.#qIdOf(session);
      if (!qId) {
        return {
          reaction: 'stop',
          response: this.notify(md`Отменено\\. Наберите /start`),
        };
      }
      return {
        reaction: 'stop',
        response: await this.#cancelConfirmScreen(qId, actor, () =>
          this.notify(md`Отменено\\. Наберите /start`),
        ),
      };
    }

    return super.handleCommand(update, actor, session);
  }

  // ── Приватные обработчики ──

  /**
   * Продолжение анкеты по курсу (кнопки-мосты «Продолжить»): ищет активную
   * standard-анкету пользователя с ownerInfo.courseId = courseId и
   * рендерит её текущий вопрос с захватом ввода.
   */
  async #handleResume(
    courseId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      QuestionnaireModuleDef,
      GetQuestionnairesByUserUcDef.command({
        userId: actor.user.uuid,
        status: 'in_progress',
        kind: 'standard',
        courseId,
      }),
      actor,
    );
    if (!res.ok) return ucErrorScreen(res.error);

    const active = res.value[0];

    if (!active) {
      return this.screen(
        md`Анкета не найдена или уже завершена\\.`,
        this.kb([[buttons.mainMenu()]]),
      );
    }

    return this.#showCurrent(active.uuid, actor);
  }

  /** Показ текущего вопроса с захватом ввода (resume/current/возврат). */
  async #showCurrent(qId: string, actor: U7BotActor): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      QuestionnaireModuleDef,
      GetCurrentUcDef.command({ questionnaireId: qId }),
      actor,
    );
    if (!res.ok) return ucErrorScreen(res.error);

    const response = res.value;
    const screen = renderActionResponse(response);
    // Ввод ждём только пока есть вопрос; completed сам несёт release
    if (response.type === 'new_question' || response.type === 'wait_next') {
      screen.awaitInput = { context: { questionnaireId: qId } };
    }
    return screen;
  }

  /**
   * Confirm-экран прерывания S05a: вопрос + cancelWarning анкеты.
   * Отказ `getCurrent` отображает `onRefusal`: кнопка — экран ошибки,
   * `/cancel` — реплика «Отменено».
   */
  async #cancelConfirmScreen(
    qId: string,
    actor: U7BotActor,
    onRefusal: (error: DomainError) => DialogResponse,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      QuestionnaireModuleDef,
      GetCurrentUcDef.command({ questionnaireId: qId }),
      actor,
    );
    if (!res.ok) return onRefusal(res.error);
    const current = res.value;
    // cancelWarning есть у всех вариантов ответа, кроме completed
    const warningRaw =
      current.type === 'completed' ? undefined : current.cancelWarning;

    return this.confirm(
      'cancel',
      qId,
      md`Вы уверены, что хотите прервать анкету?${warningRaw ? `\n\n${warningRaw}` : ''}`,
      {
        confirmButton: '✅ Да, прервать',
        cancelButton: '❌ Нет, продолжить',
        cancelCode: this.cbFor('fill', 'current', qId),
      },
    );
  }

  /** Подтверждённое прерывание (S05b): abandon UC + release. */
  async #handleCancelConfirmed(
    qId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      QuestionnaireModuleDef,
      AbandonUcDef.command({ questionnaireId: qId }),
      actor,
    );
    if (!res.ok) return ucErrorScreen(res.error);

    return {
      ...this.screen(md`Анкета прервана\\.`, this.kb([[buttons.mainMenu()]])),
      release: true,
    };
  }

  /** Рендеринг ответа UC: наблюдаемость stale + декларативный рендер. */
  #renderUc(
    response: QuestionnaireActionResponse,
    questionnaireId: string,
    pressed: string,
  ): DialogResponse {
    // Неактуальный ответ — сигнал для наблюдаемости (warn, не error:
    // не должен попадать в критические ошибки Logger Bot, spec FR-1)
    if (response.type === 'stale_answer') {
      this.logger?.warn('fill-story', 'Неактуальный ответ в анкете', {
        questionnaireId,
        pressed,
        questionCode: response.question.questionCode,
        reason: response.reason,
      });
    }

    return renderActionResponse(response);
  }

  /** questionnaireId активного ввода (контекст awaitInput). */
  #qIdOf(session: BotSession): string | undefined {
    const ctx = session.dialog?.input?.context as
      | { questionnaireId?: string }
      | undefined;
    return ctx?.questionnaireId;
  }
}
