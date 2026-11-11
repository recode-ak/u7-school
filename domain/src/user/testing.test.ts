import { describe, expect, test } from 'bun:test';
import { UserAr } from './contract';
import { userSubject } from './testing';

describe('userSubject', () => {
  test('субъект с ролями отвечает isMentor() / isAdmin()', () => {
    const mentor = userSubject({
      uuid: '11111111-1111-4111-8111-111111111111',
      roles: ['MENTOR'],
    });
    const admin = userSubject({
      uuid: '22222222-2222-4222-8222-222222222222',
      roles: ['ADMIN'],
    });
    const guest = userSubject({
      uuid: '33333333-3333-4333-8333-333333333333',
      roles: ['GUEST'],
    });

    expect(mentor).toBeInstanceOf(UserAr);
    expect([mentor.isMentor(), mentor.isAdmin()]).toEqual([true, false]);
    expect([admin.isMentor(), admin.isAdmin()]).toEqual([false, true]);
    expect([guest.isMentor(), guest.isAdmin()]).toEqual([false, false]);
    expect(admin.uuid).toBe('22222222-2222-4222-8222-222222222222');
  });
});
