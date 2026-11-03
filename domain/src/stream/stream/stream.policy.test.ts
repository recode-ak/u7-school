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
  it('ментор — allowed', () => {
    expect(canCreate.evaluate(who(MENTOR, Role.MENTOR), {})).toEqual(allowed);
  });

  it('ментор и админ одновременно — allowed', () => {
    expect(
      canCreate.evaluate(who(MENTOR, Role.MENTOR, Role.ADMIN), {}).allowed,
    ).toBe(true);
  });

  it('админ без роли MENTOR — denied (как в legacy)', () => {
    expect(canCreate.evaluate(who(MENTOR, Role.ADMIN), {}).allowed).toBe(false);
  });

  it.each([Role.GUEST, Role.SUBSCRIBER, Role.STUDENT, Role.AUTHOR])(
    'роль %s — denied с текстом «Недостаточно прав для создания потока»',
    (role) => {
      const decision = canCreate.evaluate(who(MENTOR, role), {});
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.denyMessage).toBe(
          'Недостаточно прав для создания потока',
        );
      }
    },
  );

  it('без субъекта — denied', () => {
    expect(canCreate.evaluate(undefined, {}).allowed).toBe(false);
  });
});

describe('StreamPolicy.canManage', () => {
  it('ментор потока — allowed', () => {
    expect(canManage.evaluate(who(MENTOR, Role.MENTOR), ctx)).toEqual(allowed);
  });

  it('ментор потока без роли MENTOR (по uuid) — allowed', () => {
    expect(canManage.evaluate(who(MENTOR), ctx).allowed).toBe(true);
  });

  it('админ, не ментор потока — allowed', () => {
    expect(canManage.evaluate(who(OTHER_MENTOR, Role.ADMIN), ctx)).toEqual(
      allowed,
    );
  });

  it('чужой ментор — denied', () => {
    const decision = canManage.evaluate(who(OTHER_MENTOR, Role.MENTOR), ctx);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.denyMessage).toContain('Недостаточно прав');
    }
  });

  it('студент — denied', () => {
    expect(
      canManage.evaluate(who(OTHER_MENTOR, Role.STUDENT), ctx).allowed,
    ).toBe(false);
  });

  it('гость (роль GUEST) — denied', () => {
    expect(canManage.evaluate(who(OTHER_MENTOR, Role.GUEST), ctx).allowed).toBe(
      false,
    );
  });

  it('без субъекта (гость-вызывающий) — denied', () => {
    expect(canManage.evaluate(undefined, ctx).allowed).toBe(false);
  });

  it('статус потока на право не влияет', () => {
    for (const status of ['enrollment', 'completed', 'archived'] as const) {
      const c = { stream: StreamAr.restore(stored(status)) };
      expect(canManage.evaluate(who(MENTOR, Role.MENTOR), c).allowed).toBe(
        true,
      );
    }
  });
});
