import { md } from '@u7-scl/core/shared';
import {
  type BotSession,
  type DialogResponse,
  eventSubscription,
  type KbButton,
  type UiEventSubscription,
} from '@u7-scl/core/ui';
import {
  DeclineInviteUcDef,
  GetCurrentUcDef,
  QuestionnaireEvents,
  QuestionnaireModuleDef,
  StartByInviteUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import type { EnvelopeOf } from 'dmg-core/app';
import { dispatchModuleUc } from '../../../core/dispatch-uc';
import type { U7BotActor } from '../../../core/u7-bot-app-meta';
import { buttons } from '../../shared/buttons';
import { Routes } from '../../shared/routes';
import { QuestionnaireStory } from './questionnaire-story';
import { renderActionResponse, ucErrorScreen } from './render';

/** Приглашение в анкету — конверт DMG (адрес — по профилю респондента). */
type QuestionnaireInvitedEvent = EnvelopeOf<typeof QuestionnaireEvents.invited>;

/**
 * InviteStory — сценарий приглашения в анкету (S01, S06).
 *
 * Приглашение, пояснение «зачем», отказ от анкеты. Старт заполнения
 * (`invite:start`) делегирует fill-стори: диалог с вопросами (и ввод
 * текстовых ответов) принадлежит fill, а не invite.
 *
 * Подписка invited — вариант A (ФР-6): кнопочный проактив
 * через ProactiveSender.invite с ПОЛНЫМИ кодами (транспорт проактивы
 * не префиксует контроллером); в тексте — подсказка /start на случай
 * устаревшего экрана.
 */
export class InviteStory extends QuestionnaireStory {
  readonly name = 'invite';

  // ── Подписки на доменные события ──

  override getEventSubscriptions(): UiEventSubscription[] {
    return [
      eventSubscription(QuestionnaireEvents.invited, (event) =>
        this.#handleInviteEvent(event),
      ),
    ];
  }

  /**
   * invited — рендерит S01 (приглашение) в канале invite. Тексты берутся
   * из `getCurrent` от имени респондента; отказ или иное состояние —
   * приглашение с текстом по умолчанию и без «Зачем».
   */
  async #handleInviteEvent(event: QuestionnaireInvitedEvent): Promise<void> {
    const { questionnaireId: qId, respondentId } = event.payload;
    const target = await this.resolveRespondent(respondentId, qId);
    if (!target) return;

    // В подписке актора нет: `Caller` собирается по `uuid` респондента
    // (резолвер, D-50) — право `getCurrent` у него самого, как прежде.
    const current = await dispatchModuleUc(
      QuestionnaireModuleDef,
      GetCurrentUcDef.command({ questionnaireId: qId }),
      {
        resolve: this.resolve,
        uuid: respondentId,
        telegramId: target.telegramId,
        warn: (message, meta) =>
          this.logger?.warn(this.dialogPath, message, meta),
      },
    );
    const invited =
      current.ok && current.value.type === 'invited'
        ? current.value
        : undefined;
    if (!invited) {
      this.logger?.warn(
        this.name,
        'Тексты приглашения недоступны, отправлен текст по умолчанию',
        {
          questionnaireId: qId,
          refusal: current.ok ? undefined : current.error.code,
        },
      );
    }

    const rows: KbButton[][] = [
      [this.btn('▶️ Начать заполнение', Routes.questionnaire.inviteStart(qId))],
    ];
    if (invited?.whyText) {
      rows.push([
        this.btn('❔ Зачем это нужно?', Routes.questionnaire.inviteWhy(qId)),
      ]);
    }
    rows.push([
      this.btn('⏭️ Пропустить', Routes.questionnaire.inviteDecline(qId)),
    ]);

    await this.proactiveSender.invite(target.telegramId, {
      text: md`📋 *Анкета*\n\n${invited?.inviteText ?? 'Заполните, пожалуйста, анкету.'}\n\nДля отмены в любой момент нажмите /cancel\\.`,
      keyboard: this.kb(rows),
    });
  }

  // ── Callback ──

  async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    // invite:start:{qId} — старт заполнения: делегат в fill (ввод анкеты
    // адресуется fill-диалогу, не invite)
    if (action.startsWith('start:')) {
      const qId = action.slice(6);
      const res = await this.dispatchUc(
        QuestionnaireModuleDef,
        StartByInviteUcDef.command({ questionnaireId: qId }),
        actor,
      );
      if (!res.ok) return ucErrorScreen(res.error);
      return this.go(this.cbFor('fill', 'current', qId));
    }

    // invite:why:{qId}
    if (action.startsWith('why:')) {
      const qId = action.slice(4);
      return this.#handleWhy(qId, actor);
    }

    // invite:invite:{qId} — повторный показ S01
    if (action.startsWith('invite:')) {
      const qId = action.slice(7);
      return this.#handleInvite(qId, actor);
    }

    // invite:decline:{qId} — confirm-экран отказа (S06a)
    if (action.startsWith('decline:')) {
      const qId = action.slice(8);
      return this.#handleDeclineConfirm(qId, actor);
    }

    // invite:decline-confirm:{qId} — подтверждённый отказ (S06b)
    if (action.startsWith('decline-confirm:')) {
      const qId = action.slice(16);
      return this.#handleDeclineConfirmed(qId, actor);
    }

    return this.unknownCommand(action, actor, session);
  }

  // ── Приватные обработчики ──

  async #handleWhy(qId: string, actor: U7BotActor): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      QuestionnaireModuleDef,
      GetCurrentUcDef.command({ questionnaireId: qId }),
      actor,
    );
    if (!res.ok) return ucErrorScreen(res.error);
    // whyText/inviteText определены только в состоянии invited
    const invited = res.value.type === 'invited' ? res.value : undefined;

    return this.screen(
      md`${invited?.whyText ?? 'Нет дополнительной информации.'}`,
      this.kb([[this.btn('✅ Хорошо', this.cb('invite', qId))]]),
    );
  }

  async #handleInvite(qId: string, actor: U7BotActor): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      QuestionnaireModuleDef,
      GetCurrentUcDef.command({ questionnaireId: qId }),
      actor,
    );
    if (!res.ok) return ucErrorScreen(res.error);
    // inviteText/whyText определены только в состоянии invited
    const invited = res.value.type === 'invited' ? res.value : undefined;

    return renderActionResponse({
      type: 'invited',
      questionnaireId: qId,
      inviteText: invited?.inviteText,
      whyText: invited?.whyText,
    });
  }

  async #handleDeclineConfirm(
    qId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      QuestionnaireModuleDef,
      GetCurrentUcDef.command({ questionnaireId: qId }),
      actor,
    );
    if (!res.ok) return ucErrorScreen(res.error);
    const current = res.value;
    // cancelWarning есть у всех вариантов ответа, кроме completed
    const warningRaw =
      current.type === 'completed' ? undefined : current.cancelWarning;

    return this.confirm(
      'decline',
      qId,
      md`Вы уверены, что хотите пропустить анкету?${warningRaw ? `\n\n${warningRaw}` : ''}`,
      {
        confirmButton: '✅ Да, пропустить',
        cancelButton: '❌ Нет, вернуться',
        cancelCode: this.cb('invite', qId),
      },
    );
  }

  async #handleDeclineConfirmed(
    qId: string,
    actor: U7BotActor,
  ): Promise<DialogResponse> {
    const res = await this.dispatchUc(
      QuestionnaireModuleDef,
      DeclineInviteUcDef.command({ questionnaireId: qId }),
      actor,
    );
    if (!res.ok) return ucErrorScreen(res.error);

    return {
      ...this.screen(md`Анкета пропущена\\.`, this.kb([[buttons.mainMenu()]])),
      release: true,
    };
  }
}
