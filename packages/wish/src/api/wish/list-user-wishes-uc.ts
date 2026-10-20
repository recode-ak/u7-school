import type { User } from '@u7-scl/app/domain';
import type {
  ListUserWishesCmd,
  ListUserWishesCmdMeta,
} from '@u7-scl/domain/wish';
import { ListUserWishesCmdSchema, WishState } from '@u7-scl/domain/wish';
import * as v from 'valibot';
import { WishUseCase } from '../wish-uc';

const WishesOutputSchema = v.array(WishState);

/**
 * Use-case списка желаний пользователя (query).
 *
 * Батч-запрос для UI: карточки каталога курсов одним запросом узнают,
 * есть ли у пользователя активное желание на каждый курс, — без
 * N запросов «по курсу». Возвращает все желания пользователя
 * (все статусы, все виды целей) — фильтрация активных на стороне UI.
 */
export class ListUserWishesUc extends WishUseCase<ListUserWishesCmdMeta> {
  protected readonly ucName = 'list-user-wishes' as const;
  protected readonly ucLabel = 'Список желаний пользователя' as const;
  protected readonly arMeta = {
    arName: 'Wish' as const,
    arLabel: 'Желание' as const,
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = ListUserWishesCmdSchema;
  protected readonly outputSchema = WishesOutputSchema;

  async execute(
    _command: ListUserWishesCmd,
    actor: User,
  ): Promise<WishState[]> {
    return this.repo.getByUser(actor.uuid);
  }
}
