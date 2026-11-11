import { describe, expect, it } from 'bun:test';
import { expectOk } from 'dmg-core/testing';
import { UserAr } from './user.ar';
import { stored, T0, T1, USER } from './user.fixture';
import type { UserRole } from './user.state';

// Перенос `a-root.test.ts` (create/register/addRole) на Ar по Def (TST-08).
// «Нарушение инвариантов бросает» не переносится: Ar не бросает (TST-09).

const restore = (...roles: UserRole[]) => UserAr.restore(stored({ roles }));

const input = { uuid: USER, telegramId: 789, name: 'Анна' };

describe('UserAr.create', () => {
  it('новый гость: GUEST, createdAt = updatedAt = at, version 0', () => {
    const ar = expectOk(UserAr.create(input, T0));
    expect(ar.snapshot()).toEqual({
      ...input,
      roles: ['GUEST'],
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  it('непустой nick сохраняется', () => {
    const ar = expectOk(UserAr.create({ ...input, nick: 'anna_tg' }, T0));
    expect(ar.snapshot().nick).toBe('anna_tg');
  });

  it.each(['', '   ', undefined])('nick %j — не записывается', (nick) => {
    const ar = expectOk(UserAr.create({ ...input, nick }, T0));
    expect('nick' in ar.snapshot()).toBe(false);
  });
});

describe('UserAr.addRole', () => {
  it('добавляет роль, version и updatedAt обновлены', () => {
    const ar = restore('ADMIN');
    expectOk(ar.addRole('SUBSCRIBER', T1));
    expect(ar.snapshot()).toEqual({
      ...stored({ roles: ['ADMIN', 'SUBSCRIBER'] }),
      updatedAt: T1,
      version: 1,
    });
  });

  it('роль уже есть — ok без изменений (version и updatedAt те же)', () => {
    const ar = restore('ADMIN');
    expectOk(ar.addRole('ADMIN', T1));
    expect(ar.snapshot()).toEqual(stored({ roles: ['ADMIN'] }));
  });
});

describe('UserAr.removeRole', () => {
  it('снимает роль, остальные остаются', () => {
    const ar = restore('MENTOR', 'ADMIN');
    expectOk(ar.removeRole('MENTOR', T1));
    expect(ar.snapshot()).toEqual({
      ...stored({ roles: ['ADMIN'] }),
      updatedAt: T1,
      version: 1,
    });
  });

  it('последняя роль снята — остаётся GUEST', () => {
    const ar = restore('ADMIN');
    expectOk(ar.removeRole('ADMIN', T1));
    expect(ar.snapshot().roles).toEqual(['GUEST']);
    expect(ar.snapshot().version).toBe(1);
  });

  it('роли нет — ok без изменений', () => {
    const ar = restore('ADMIN');
    expectOk(ar.removeRole('MENTOR', T1));
    expect(ar.snapshot()).toEqual(stored({ roles: ['ADMIN'] }));
  });
});

describe('UserAr — вопросы о ролях', () => {
  it.each([
    'GUEST',
    'SUBSCRIBER',
    'STUDENT',
    'MENTOR',
    'AUTHOR',
    'ADMIN',
  ] as const)('hasRole: есть %s', (role) => {
    expect(restore(role).hasRole(role)).toBe(true);
  });

  it('hasRole: нет роли — false', () => {
    expect(restore('MENTOR').hasRole('ADMIN')).toBe(false);
  });

  it('isAdmin: ADMIN среди нескольких ролей — true; без ADMIN — false', () => {
    expect(restore('MENTOR', 'ADMIN').isAdmin()).toBe(true);
    expect(restore('MENTOR', 'AUTHOR').isAdmin()).toBe(false);
  });

  it('isMentor: MENTOR среди нескольких ролей — true; без MENTOR — false', () => {
    expect(restore('ADMIN', 'MENTOR').isMentor()).toBe(true);
    expect(restore('ADMIN').isMentor()).toBe(false);
  });
});
