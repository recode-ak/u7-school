import * as v from 'valibot';
import type { WishState } from '../wish.state';

/** Схема запроса списка желаний пользователя (батч для каталога курсов). */
export const ListUserWishesCmdSchema = v.object({});

/** Запрос списка желаний пользователя. */
export type ListUserWishesCmd = v.InferOutput<typeof ListUserWishesCmdSchema>;

/** Мета запроса списка желаний пользователя */
export interface ListUserWishesCmdMeta {
  ucName: 'list-user-wishes';
  arMeta: { name: 'Wish'; label: 'Желание' };
  input: ListUserWishesCmd;
  output: WishState[];
  errors: never;
  requiresAuth: true;
  type: 'query';
}
