import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { InviteWishersErDef } from './invite-wishers.er';

describe('InviteWishersErDef', () => {
  it('на создание потока: касается желаний, зовёт курсы, потоки и пользователей, публикует invited', () => {
    expect(normalize(InviteWishersErDef)).toMatchObject({
      name: 'inviteWishers',
      on: ['stream.stream.created'],
      touches: ['wish'],
      calls: [
        'getCoursesStartingWithModule',
        'getSameModules',
        'getStreamPresence',
        'getTelegramAddresses',
      ],
      emits: ['wish.wish.invited'],
    });
  });
});
