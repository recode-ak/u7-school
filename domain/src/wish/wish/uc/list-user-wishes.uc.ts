import { allowAll, defineUseCase } from 'dmg-core';
import * as v from 'valibot';
import { WishArDef } from '../wish.ar';

/**
 * Желания субъекта: все статусы и виды целей. Только свои — `userId`
 * берётся из субъекта (входа нет), поэтому Policy — `allowAll`.
 * Выход — state желания как есть (из `WishArDef.state`, без копии).
 */
export const ListUserWishesUcDef = defineUseCase({
  name: 'listUserWishes',
  label: 'Мои желания',
  description:
    'Все желания вызывающего пользователя: любые статусы, курсы и модули.',
  type: 'query',
  aggregate: WishArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({}),
  output: v.array(WishArDef.state),
  errors: [],
});
