import { dispatchModuleUc } from '@u7-scl/bot/dispatch-uc';
import { U7BotController } from '@u7-scl/bot/u7-bot-controller';
import { getGlobalLogger, md } from '@u7-scl/core/shared';
import type { MessengerEvent, MessengerEventReaction } from '@u7-scl/core/ui';
import {
  FindStreamByTelegramGroupUcDef,
  GetStreamMembersUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import type { Command } from 'dmg-core';
import { InactivityStory } from './stories/inactivity.story';
import { CatalogStory } from './stories/stream-catalog.story';
import { ViewStreamStory } from './stories/view-stream.story';

/**
 * Контроллер streams — «Потоки курсов» (S01-S04).
 *
 * Тонкий реестр — делегирует все действия в U7BotUiStory.
 * Содержит стори: catalog (S01), view-stream (S02-S04)
 * и inactivity (уведомления о бездействии и уходе из учёбы).
 * S11 (приглашение желающих) — ER invite-wishers (userFacade.notify).
 */
export class StreamsController extends U7BotController {
  readonly name = 'stream';

  protected override readonly stories = [
    new CatalogStory(),
    new ViewStreamStory(),
    new InactivityStory(),
  ];

  /**
   * Реакция на события студенческих групп потоков (FR-7).
   */
  override async handleMessengerEvent(
    event: MessengerEvent,
  ): Promise<MessengerEventReaction | undefined> {
    try {
      const found = await this.#dispatchAsGuest(
        FindStreamByTelegramGroupUcDef.command({
          telegramGroupId: String(event.chatId),
        }),
      );
      if (!found.ok) throw new Error(found.error.code);
      const stream = found.value;
      if (!stream) {
        return 'pass';
      }

      if (event.kind === 'member_joined') {
        const students = await this.#studentsOf(stream.uuid);
        const user = await this.resolve.userFacade.getUserByTelegramId(
          event.user.id,
        );

        const isStudentActive =
          Boolean(user) &&
          students.some((s) => s.userId === user?.uuid && s.inProgress);

        if (!isStudentActive) {
          const mentor = await this.resolve.appApi.execute('get-user', {
            uuid: stream.mentorId,
          });
          if (mentor?.telegramId && this.proactiveSender) {
            const userName = user?.name ?? event.user.firstName;
            const usernamePart = event.user.username
              ? ` (@${event.user.username})`
              : '';
            await this.proactiveSender.notify(mentor.telegramId, {
              text: md`⚠️ В группу «${stream.title}» вступил неизвестный участник: ${userName}${usernamePart}\\. Он не числится студентом этого потока\\.`,
            });
          }
        }
        return 'stop';
      }

      if (event.kind === 'member_left') {
        const user = await this.resolve.userFacade.getUserByTelegramId(
          event.user.id,
        );
        if (user) {
          const students = await this.#studentsOf(stream.uuid);
          const isActive = students.some(
            (s) => s.userId === user.uuid && s.inProgress,
          );
          if (isActive) {
            const mentor = await this.resolve.appApi.execute('get-user', {
              uuid: stream.mentorId,
            });
            if (mentor?.telegramId && this.proactiveSender) {
              await this.proactiveSender.notify(mentor.telegramId, {
                text: md`🚪 Студент ${user.name} покинул группу «${stream.title}»\\.`,
              });
            }
          }
        }
        return 'stop';
      }

      return 'stop';
    } catch (err) {
      getGlobalLogger()?.warn(
        'stream-controller',
        `Ошибка при обработке события студенческой группы потока: ${String(err)}`,
        { event },
      );
      return 'stop';
    }
  }

  /** Студенты потока; потока нет — пусто. */
  async #studentsOf(streamId: string) {
    const members = await this.#dispatchAsGuest(
      GetStreamMembersUcDef.command({ streamId }),
    );
    if (!members.ok) throw new Error(members.error.code);
    return members.value?.students ?? [];
  }

  /**
   * Команда модулю потоков от гостя: событие группы приходит без актора
   * бота, а читают поток открытые запросы.
   */
  #dispatchAsGuest<D extends (typeof StreamModuleDef)['useCases'][number]>(
    command: Command<D>,
  ) {
    return dispatchModuleUc(StreamModuleDef, command, {
      resolve: this.resolve,
      warn: (message, meta) =>
        getGlobalLogger()?.warn('stream-controller', message, meta),
    });
  }
}
