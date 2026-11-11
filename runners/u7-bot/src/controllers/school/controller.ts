import { dispatchModuleUc } from '@u7-scl/bot/dispatch-uc';
import { U7BotController } from '@u7-scl/bot/u7-bot-controller';
import { getGlobalLogger } from '@u7-scl/core/shared';
import type { MessengerEvent, MessengerEventReaction } from '@u7-scl/core/ui';
import {
  AddRoleToUserUcDef,
  GetUserByTelegramIdUcDef,
  RemoveRoleFromUserUcDef,
  UserErrors,
  UserModuleDef,
} from '@u7-scl/domain/user/contract';
import type { Command } from 'dmg-core';
import { CommunityStory } from './stories/community.story';
import { SchoolHubStory } from './stories/school-hub.story';
import { SchoolInfoStory } from './stories/school-info.story';
import { SchoolReviewsStory } from './stories/school-reviews.story';

/**
 * Контроллер school — хаб «🏫 Школа».
 *
 * Тонкий реестр — делегирует действия в свои стори:
 * - SchoolHubStory (визитная карточка SH01)
 * - SchoolInfoStory (экран «Инфо» SH02)
 * - SchoolReviewsStory (экран «Отзывы» SH03)
 * - CommunityStory (сообщество школы)
 */
export class SchoolController extends U7BotController {
  readonly name = 'school';

  protected override readonly stories = [
    new SchoolHubStory(),
    new SchoolInfoStory(),
    new SchoolReviewsStory(),
    new CommunityStory(),
  ];

  /**
   * Реакция на события школьной группы (FR-7).
   * Выдаёт роль SUBSCRIBER при входе в группу сообщества школы,
   * снимает её при выходе.
   */
  override async handleMessengerEvent(
    event: MessengerEvent,
  ): Promise<MessengerEventReaction | undefined> {
    const isSchoolGroup =
      String(event.chatId) === String(this.resolve.school.communityGroup.id);
    if (!isSchoolGroup) {
      return 'pass';
    }

    try {
      if (event.kind === 'bot_membership') {
        if (event.status === 'added' && event.byUser) {
          await this.#changeSubscriber('add', event.byUser.id);
        }
        return 'stop';
      }

      if (event.kind === 'member_joined') {
        await this.#changeSubscriber('add', event.user.id);
        return 'stop';
      }

      if (event.kind === 'member_left') {
        await this.#changeSubscriber('remove', event.user.id);
        return 'stop';
      }
    } catch (err) {
      getGlobalLogger()?.warn(
        'school-controller',
        `Ошибка при обработке события школьной группы: ${String(err)}`,
        { event },
      );
      return 'stop';
    }

    return 'stop';
  }

  /**
   * Выдаёт или снимает `SUBSCRIBER`: пользователь ищется по telegramId от
   * гостя, роль меняет бот от `botAdminUuid`. Нет пользователя — пропуск;
   * любой отказ UC — исключение (ловит `handleMessengerEvent`).
   */
  async #changeSubscriber(
    action: 'add' | 'remove',
    telegramId: number,
  ): Promise<void> {
    const found = await this.#dispatch(
      GetUserByTelegramIdUcDef.command({ telegramId }),
      undefined,
    );
    if (!found.ok) {
      if (found.error.code === UserErrors.NOT_FOUND.code) return;
      throw new Error(found.error.code);
    }
    const uuid = found.value.uuid;
    const changed =
      action === 'add'
        ? await this.#dispatch(
            AddRoleToUserUcDef.command({ userId: uuid, role: 'SUBSCRIBER' }),
            this.resolve.botAdminUuid,
          )
        : await this.#dispatch(
            RemoveRoleFromUserUcDef.command({
              userId: uuid,
              role: 'SUBSCRIBER',
            }),
            this.resolve.botAdminUuid,
          );
    if (!changed.ok) throw new Error(changed.error.code);
  }

  #dispatch<D extends (typeof UserModuleDef)['useCases'][number]>(
    command: Command<D>,
    uuid: string | undefined,
  ) {
    return dispatchModuleUc(UserModuleDef, command, {
      resolve: this.resolve,
      uuid,
      warn: (message, meta) =>
        getGlobalLogger()?.warn('school-controller', message, meta),
    });
  }
}
