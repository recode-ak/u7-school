import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import { type MdText, md } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse, KbButton } from '@u7-scl/core/ui';
import {
  ListMyReviewsUcDef,
  PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review/contract';
import {
  GetStreamUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { buttons } from '../../shared/buttons';
import { renderReviewCard } from './review-render';

/**
 * US: «Отзывы мне» (S08) — все отзывы, адресованные пользователю.
 *
 * Вход: `view:<page>` — кнопка «📥 Отзывы мне» в хабе S02 (видна при
 * наличии хотя бы одного отзыва) и в его заглушке. Контент: UC
 * `list-my-reviews` — новые наверху (createdAt desc); имена авторов —
 * batch-UC `get-users-by-ids`, потоки — `get-stream` по scopeId.
 * Карточный просмотр: ровно один отзыв на экран с пагинацией ◀️ / ▶️.
 * Только чтение.
 */
export class ReviewsForMeStory extends U7BotUiStory {
  readonly name = 'reviews-for-me';

  /** Ключ кеша страниц (DialogCache — эпоха диалога). */
  #cacheKey = 'reviews-for-me:me';

  // ── Callback ──

  override async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    const [cmd, pageSeg] = action.split(':');
    if (cmd !== 'view') {
      return this.unknownCommand(action, actor, session);
    }
    const page = Number(pageSeg);
    return this.#showReviews(actor, session, Number.isNaN(page) ? 0 : page);
  }

  /** S08: карточный просмотр отзывов адресату (кеш страниц — диалог). */
  async #showReviews(
    actor: U7BotActor,
    session: BotSession,
    pageIndex: number,
  ): Promise<DialogResponse> {
    return this.cardPagedScreen({
      build: () => this.#buildCards(actor),
      emptyScreen: () => this.#emptyScreen(),
      rows: () => this.#navRows(),
      cacheKey: this.#cacheKey,
      pageIndex,
      cbPage: (n) => this.cb('view', String(n)),
      session,
      tgId: actor.user.view().telegramId,
    });
  }

  /** Читает отзывы адресату, резолвит авторов и потоки, собирает карточки. */
  async #buildCards(
    actor: U7BotActor,
  ): Promise<{ title: MdText; cards: MdText[]; payload: undefined }> {
    const res = await this.dispatchUc(
      PeerReviewModuleDef,
      ListMyReviewsUcDef.command({}),
      actor,
    );
    if (!res.ok) throw new Error(res.error.code);
    const { reviews } = res.value;

    const [names, titles] = await Promise.all([
      this.#namesOf([...new Set(reviews.map((r) => r.authorId))], actor),
      this.#titlesOf([...new Set(reviews.map((r) => r.scopeId))], actor),
    ]);

    const cards = reviews.map((review) =>
      renderReviewCard({
        authorName: names.get(review.authorId) ?? 'неизвестно',
        direction: review.direction,
        authorOutcome: review.authorOutcome,
        streamTitle: titles.get(review.scopeId) ?? 'неизвестно',
        createdAt: review.createdAt,
        text: review.text,
        zone: this.zone,
      }),
    );

    return {
      title: md`📥 *Отзывы мне*`,
      cards,
      payload: undefined,
    };
  }

  /** Экран-заглушка: отзывов нет (кнопка в хабе скрыта — сюда не попасть). */
  #emptyScreen(): DialogResponse {
    return this.screen(
      md`📭 Тебе пока не написали ни одного отзыва\\.`,
      this.kb([
        [this.btn('↩️ Мои отзывы', this.cbFor('my-reviews', 'hub'))],
        [buttons.mainMenu()],
      ]),
    );
  }

  /** Навигация под карточкой: назад в хаб S02, главное меню последним. */
  #navRows(): KbRows {
    return [
      [this.btn('↩️ Мои отзывы', this.cbFor('my-reviews', 'hub'))],
      [buttons.mainMenu()],
    ];
  }

  /** Названия потоков по scopeId карточек. */
  async #titlesOf(
    scopeIds: string[],
    actor: U7BotActor,
  ): Promise<Map<string, string>> {
    const titles = new Map<string, string>();
    if (scopeIds.length === 0) return titles;
    await Promise.all(
      scopeIds.map(async (scopeId) => {
        try {
          const stream = await this.dispatchUc(
            StreamModuleDef,
            GetStreamUcDef.command({ streamId: scopeId }),
            actor,
          );
          titles.set(scopeId, stream.ok ? stream.value.title : 'неизвестно');
        } catch {
          titles.set(scopeId, 'неизвестно');
        }
      }),
    );
    return titles;
  }

  /** Имена авторов — один batch-запрос. */
  async #namesOf(
    userIds: string[],
    actor: U7BotActor,
  ): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    if (userIds.length === 0) return names;
    const users = await this.findUsers(userIds, actor);
    for (const user of users) {
      names.set(user.uuid, user.name);
    }
    return names;
  }
}

/** Псевдоним типа строк кнопок (rows клавиатуры). */
type KbRows = KbButton[][];
