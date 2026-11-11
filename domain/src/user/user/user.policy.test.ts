import { describe, expect, it } from 'bun:test';
import { allowed, denied } from 'dmg-core';
import { UserAr } from './user.ar';
import { stored } from './user.fixture';
import { UserPolicy } from './user.policy';
import type { UserRole } from './user.state';

// Перенос `policy.test.ts` (TST-08): canAddRole/canRemoveRole → canManageRoles,
// canCreate → canRegisterGuest по тому же правилу «только ADMIN». Ветки
// canCreate (С2) и isAuthor (Т4) не переносятся.

const who = (...roles: UserRole[]) => UserAr.restore(stored({ roles }));

const { canManageRoles, canRegisterGuest } = UserPolicy.rules;

describe('UserPolicy.canManageRoles', () => {
  it('админ — allowed', () => {
    expect(canManageRoles.evaluate(who('ADMIN'), {})).toEqual(allowed);
  });

  it('админ среди других ролей — allowed', () => {
    expect(canManageRoles.evaluate(who('MENTOR', 'ADMIN'), {})).toEqual(
      allowed,
    );
  });

  it.each(['MENTOR', 'GUEST', 'SUBSCRIBER', 'AUTHOR'] as const)(
    'роль %s — denied с прежним текстом',
    (role) => {
      expect(canManageRoles.evaluate(who(role), {})).toEqual(
        denied('canManageRoles', 'Недостаточно прав для выполнения действия'),
      );
    },
  );
});

describe('UserPolicy.canRegisterGuest', () => {
  it('админ — allowed', () => {
    expect(canRegisterGuest.evaluate(who('ADMIN'), {})).toEqual(allowed);
  });

  it('админ среди других ролей — allowed', () => {
    expect(canRegisterGuest.evaluate(who('MENTOR', 'ADMIN'), {})).toEqual(
      allowed,
    );
  });

  it.each(['MENTOR', 'GUEST', 'SUBSCRIBER', 'AUTHOR'] as const)(
    'роль %s — denied с прежним текстом',
    (role) => {
      expect(canRegisterGuest.evaluate(who(role), {})).toEqual(
        denied(
          'canRegisterGuest',
          'Только администратор может регистрировать гостей',
        ),
      );
    },
  );
});
