import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { FulfillWishErDef } from './fulfill-wish.er';

describe('FulfillWishErDef', () => {
  it('на зачисление студента меняет желания и спрашивает курс, событий не публикует', () => {
    expect(normalize(FulfillWishErDef)).toMatchObject({
      name: 'fulfillWish',
      on: ['stream.student.enrolled'],
      touches: ['wish'],
      calls: ['getCoursesIncludingModule', 'getSameModules'],
      emits: [],
    });
  });
});
