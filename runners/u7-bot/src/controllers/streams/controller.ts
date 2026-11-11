import { dispatchModuleUc } from '@u7-scl/bot/dispatch-uc';
import { U7BotController } from '@u7-scl/bot/u7-bot-controller';
import { getGlobalLogger, md } from '@u7-scl/core/shared';
import type { MessengerEvent, MessengerEventReaction } from '@u7-scl/core/ui';
import {
  FindStreamByTelegramGroupUcDef,
  GetStreamMembersUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import {
  GetUserByTelegramIdUcDef,
  GetUserUcDef,
  UserErrors,
  UserModuleDef,
  type UserView,
} from '@u7-scl/domain/user/contract';
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
 * S11 (приглашение желающих) — подписка WishInviteStory на
 * `wish.wish.invited` (адресная доставка через канал invite).
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
        const user = await this.#userByTelegramId(event.user.id);

        const isStudentActive =
          Boolean(user) &&
          students.some((s) => s.userId === user?.uuid && s.inProgress);

        if (!isStudentActive) {
          const mentor = await this.#userById(stream.mentorId);
          if (mentor.telegramId && this.proactiveSender) {
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
        const user = await this.#userByTelegramId(event.user.id);
        if (user) {
          const students = await this.#studentsOf(stream.uuid);
          const isActive = students.some(
            (s) => s.userId === user.uuid && s.inProgress,
          );
          if (isActive) {
            const mentor = await this.#userById(stream.mentorId);
            if (mentor.telegramId && this.proactiveSender) {
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

  /** Пользователь по telegramId: не найден — `undefined`, прочий отказ — исключение. */
  async #userByTelegramId(telegramId: number): Promise<UserView | undefined> {
    const found = await this.#dispatchUser(
      GetUserByTelegramIdUcDef.command({ telegramId }),
    );
    if (found.ok) return found.value;
    if (found.error.code === UserErrors.NOT_FOUND.code) return undefined;
    throw new Error(found.error.code);
  }

  /** Профиль пользователя по uuid; отказ — исключение (ловит обработчик события). */
  async #userById(uuid: string): Promise<UserView> {
    const found = await this.#dispatchUser(GetUserUcDef.command({ uuid }));
    if (!found.ok) throw new Error(found.error.code);
    return found.value;
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

  /** Команда модулю `user` от гостя (событие группы приходит без актора). */
  #dispatchUser<D extends (typeof UserModuleDef)['useCases'][number]>(
    command: Command<D>,
  ) {
    return dispatchModuleUc(UserModuleDef, command, {
      resolve: this.resolve,
      warn: (message, meta) =>
        getGlobalLogger()?.warn('stream-controller', message, meta),
    });
  }
}
