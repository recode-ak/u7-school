import { describe, expect, it } from 'bun:test';
import { Role } from '@u7-scl/domain/user/contract';
import { allowed } from 'dmg-core';
import { StreamAr } from './stream.ar';
import { MENTOR, OTHER_MENTOR, stored } from './stream.fixture';
import { StreamPolicy } from './stream.policy';

// Перенос `policy.test.ts` (canCreate, canEdit) на Policy по Def (TST-02):
// canCreate — роль MENTOR; canManage — ментор потока или админ.

const who = (uuid: string, ...roles: Role[]) => ({ uuid, roles });
const ctx = { stream: StreamAr.restore(stored('active')) };

const { canCreate, canManage } = StreamPolicy.rules;

describe('StreamPolicy.canCreate', () => {
  it.each([
    { title: 'ментор', roles: [Role.MENTOR] },
    { title: 'ментор и админ одновременно', roles: [Role.MENTOR, Role.ADMIN] },
  ])('$title — allowed', ({ roles }) => {
    expect(canCreate.evaluate(who(MENTOR, ...roles), {})).toEqual(allowed);
  });

  it('админ без роли MENTOR — denied (как в legacy)', () => {
    expect(canCreate.evaluate(who(MENTOR, Role.ADMIN), {}).allowed).toBe(false);
  });

  it.each([Role.GUEST, Role.SUBSCRIBER, Role.STUDENT, Role.AUTHOR])(
    'роль %s — denied',
    (role) => {
      expect(canCreate.evaluate(who(MENTOR, role), {}).allowed).toBe(false);
    },
  );

  it('без субъекта — denied', () => {
    expect(canCreate.evaluate(undefined, {}).allowed).toBe(false);
  });
});

describe('StreamPolicy.canManage', () => {
  it.each(['enrollment', 'active', 'completed', 'archived'] as const)(
    'ментор потока в статусе %s — allowed',
    (status) => {
      const c = { stream: StreamAr.restore(stored(status)) };
      expect(canManage.evaluate(who(MENTOR, Role.MENTOR), c)).toEqual(allowed);
    },
  );

  it('ментор потока без роли MENTOR (по uuid) — allowed', () => {
    expect(canManage.evaluate(who(MENTOR), ctx).allowed).toBe(true);
  });

  it('админ, не ментор потока — allowed', () => {
    expect(canManage.evaluate(who(OTHER_MENTOR, Role.ADMIN), ctx)).toEqual(
      allowed,
    );
  });

  it.each([
    { title: 'чужой ментор', roles: [Role.MENTOR] },
    { title: 'студент', roles: [Role.STUDENT] },
    { title: 'гость (роль GUEST)', roles: [Role.GUEST] },
  ])('$title — denied', ({ roles }) => {
    expect(canManage.evaluate(who(OTHER_MENTOR, ...roles), ctx).allowed).toBe(
      false,
    );
  });

  it('без субъекта (гость-вызывающий) — denied', () => {
    expect(canManage.evaluate(undefined, ctx).allowed).toBe(false);
  });
});
