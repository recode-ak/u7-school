import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import { type MdText, md } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import {
  ListScopeReviewsUcDef,
  PeerReviewModuleDef,
  type RecipientReviewsGroup,
} from '@u7-scl/domain/peer-review/contract';
import {
  GetStreamUcDef,
  StreamErrors,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { Routes } from '../../shared/routes';
import { authorLabel, rolesOf } from './review-render';

/**
 * US: Просмотр отзывов потока (S07) — только чтение.
 *
 * Вход: `view:<scopeId>[:<page>]` — кнопка «💬 Отзывы» в карточке потока
 * (streams S02, кросс-контроллерный мост Routes.peerReview.scopeReviews).
 * Контент: `list-scope-reviews` — группы по адресатам; блок пагинации —
 * один отзыв (строка адресата + текст + автор); имена — batch-UC
 * `get-users-by-ids` до нарезки страниц. Роли — из `direction`, лейбл
 * исхода — только у автора-студента (`authorOutcome`; автор-ментор без
 * лейбла). Кнопок перехода в живую кампанию нет (S07 — чтение).
 */
export class ScopeReviewsStory extends U7BotUiStory {
  readonly name = 'scope-reviews';

  override async handleCallback(
    action: string,
    actor: U7BotActor,
    session: BotSession,
  ): Promise<DialogResponse> {
    const [cmd, scopeId, pageSeg] = action.split(':');
    if (cmd !== 'view' || !scopeId) {
      return this.unknownCommand(action, actor, session);
    }
    const page = Number(pageSeg);
    return this.#showReviews(
      scopeId,
      actor,
      session,
      Number.isNaN(page) ? 0 : page,
    );
  }

  /** S07: постраничный просмотр отзывов скоупа (кеш страниц — диалог). */
  async #showReviews(
    scopeId: string,
    actor: U7BotActor,
    session: BotSession,
    pageIndex: number,
  ): Promise<DialogResponse> {
    // Блок = отзыв (строка адресата + «текст» — автор); страницы кешируются
    // в DialogCache — build (чтение домена) только при промахе кеша.
    return this.pagedScreen({
      build: () => this.#buildBlocks(scopeId, actor),
      emptyScreen: ({ streamMissing }) =>
        streamMissing
          ? this.warn(md`Поток не найден`)
          : this.screen(
              md`💬 Отзывов по потоку пока нет\\.`,
              this.kb([[this.#backToStream(scopeId)]]),
            ),
      rows: () => [[this.#backToStream(scopeId)]],
      cacheKey: `scope-reviews:${scopeId}`,
      pageIndex,
      cbPage: (n) => this.cb('view', scopeId, String(n)),
      session,
      tgId: actor.user.view().telegramId,
    });
  }

  /**
   * Читает отзывы скоупа, резолвит имена и собирает блоки «адресат: отзыв».
   * Потока нет (устаревший `scopeId` в кнопке) — пустой набор с признаком
   * `streamMissing`: штатный отказ рисует `emptyScreen`.
   */
  async #buildBlocks(
    scopeId: string,
    actor: U7BotActor,
  ): Promise<{
    header: MdText;
    blocks: string[];
    payload: { streamMissing: boolean };
  }> {
    const [res, stream] = await Promise.all([
      this.dispatchUc(
        PeerReviewModuleDef,
        ListScopeReviewsUcDef.command({ scopeIds: [scopeId] }),
        actor,
      ),
      this.dispatchUc(
        StreamModuleDef,
        GetStreamUcDef.command({ streamId: scopeId }),
        actor,
      ),
    ]);
    if (!stream.ok && stream.error.code === StreamErrors.NOT_FOUND.code) {
      return { header: md``, blocks: [], payload: { streamMissing: true } };
    }
    if (!res.ok) throw new Error(res.error.code);
    if (!stream.ok) throw new Error(stream.error.code);
    const projection = res.value;

    const names = await this.#namesOf(uniqueIds(projection.recipients), actor);

    const blocks = projection.recipients.flatMap((group) =>
      group.reviews.map((review) =>
        reviewBlock({
          group,
          review,
          names,
        }),
      ),
    );

    return {
      header: md`💬 *Отзывы* — поток «${stream.value.title}»`,
      blocks,
      payload: { streamMissing: false },
    };
  }

  /** Все id скоупа (адресаты + авторы) одним batch-запросом. */
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

  /** Кнопка возврата в карточку потока (кросс-контроллерный мост). */
  #backToStream(scopeId: string) {
    return this.btn('⬅️ Назад к потоку', Routes.stream.view(scopeId));
  }
}

/** Уникальные id: адресаты групп + авторы отзывов (порядок сохраняем). */
function uniqueIds(groups: RecipientReviewsGroup[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const group of groups) {
    for (const id of [
      group.recipientId,
      ...group.reviews.map((r) => r.authorId),
    ]) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** Снимок отзыва для рендера блока (контракт scope-reviews-ds). */
interface ReviewSnapshotLike {
  authorId: string;
  direction: Parameters<typeof authorLabel>[0]['direction'];
  authorOutcome?: Parameters<typeof authorLabel>[0]['authorOutcome'];
  text: string;
}

/**
 * Блок = отзыв: строка адресата с ролью, «текст» — автор с ролью и
 * (у автора-студента) лейблом исхода. Роли — из direction; имя не
 * найдено — «неизвестно».
 */
function reviewBlock(args: {
  group: RecipientReviewsGroup;
  review: ReviewSnapshotLike;
  names: Map<string, string>;
}): string {
  const { group, review, names } = args;
  const roles = rolesOf(review.direction);
  const recipient = names.get(group.recipientId) ?? 'неизвестно';
  const author = names.get(review.authorId) ?? 'неизвестно';
  return md`👤 ${recipient} \\(${roles.recipient}\\):
«${review.text}» — ${author} \\(${authorLabel(review)}\\)`;
}
