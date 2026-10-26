import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { WishArDef } from '../wish.ar';
import { ListUserWishesUcDef } from './list-user-wishes.uc';

describe('ListUserWishesUcDef', () => {
  it('нормализуется как query без событий и ошибок', () => {
    expect(normalize(ListUserWishesUcDef)).toMatchObject({
      name: 'listUserWishes',
      type: 'query',
      errors: [],
    });
  });

  it('вход — пустой объект, выход — массив state желания', () => {
    expect(v.safeParse(ListUserWishesUcDef.input, {}).success).toBe(true);
    expect(v.safeParse(ListUserWishesUcDef.output, []).success).toBe(true);
    expect(v.safeParse(ListUserWishesUcDef.output, [{ nope: 1 }]).success).toBe(
      false,
    );
    expect(ListUserWishesUcDef.output.item).toBe(WishArDef.state);
  });
});
