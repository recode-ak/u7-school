import { describe, expect, it } from 'bun:test';
import { checkDefs, formatViolation } from 'dmg-core/arch';
import { DefIndex, normalize } from 'dmg-core/graph';
import { WishModuleDef } from './wish.module';

describe('WishModuleDef', () => {
  it('паспорт: зависимости, агрегат, UC', () => {
    expect(normalize(WishModuleDef)).toMatchObject({
      name: 'wish',
      dependsOn: ['user', 'course', 'questionnaire', 'stream'],
      aggregates: ['wish'],
      useCases: [
        'createCourseWish',
        'createModuleWish',
        'cancelWish',
        'listUserWishes',
      ],
      reactions: ['fulfillWish', 'confirmWish', 'abandonWish', 'inviteWishers'],
      jobs: [],
    });
  });

  it('checkDefs — без нарушений', () => {
    expect(
      checkDefs(DefIndex.from([WishModuleDef])).map(formatViolation),
    ).toEqual([]);
  });
});
