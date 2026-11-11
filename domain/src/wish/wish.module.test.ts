import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { WishModuleDef } from './wish.module';

describe('WishModuleDef', () => {
  it('паспорт: зависимости и состав', () => {
    expect(normalize(WishModuleDef)).toMatchObject({
      dependsOn: ['user', 'course', 'questionnaire', 'stream'],
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
});
