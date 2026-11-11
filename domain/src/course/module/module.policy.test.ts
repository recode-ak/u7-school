import { describe, expect, it } from 'bun:test';
import { Role } from '@u7-scl/domain/user/contract';
import { allowed } from 'dmg-core';
import { ModuleAr } from './module.ar';
import { AUTHOR, OTHER, stored } from './module.fixture';
import { ModulePolicy } from './module.policy';

// Перенос `policy.test.ts`: canRead (4), isAuthor (2), isAdminOrAuthor (3),
// canReadProject (через viewFor, см. module.ar.test.ts) на `canSeeUnpublished`.
// canCreate / canEdit / canAddProject не переносятся (authoring удалён).

const who = (uuid: string, ...roles: Role[]) => ({ uuid, roles });
const ctx = { module: ModuleAr.restore(stored('draft')) };

const { canSeeUnpublished } = ModulePolicy.rules;

describe('ModulePolicy.canSeeUnpublished', () => {
  it('админ, не автор — allowed', () => {
    expect(canSeeUnpublished.evaluate(who(OTHER, Role.ADMIN), ctx)).toEqual(
      allowed,
    );
  });

  it('автор без роли AUTHOR (MENTOR) — allowed', () => {
    expect(canSeeUnpublished.evaluate(who(AUTHOR, Role.MENTOR), ctx)).toEqual(
      allowed,
    );
  });

  it('ментор, не автор — denied', () => {
    expect(
      canSeeUnpublished.evaluate(who(OTHER, Role.MENTOR), ctx).allowed,
    ).toBe(false);
  });

  it('ментор с ролью AUTHOR, но чужой модуль — denied', () => {
    expect(
      canSeeUnpublished.evaluate(who(OTHER, Role.AUTHOR), ctx).allowed,
    ).toBe(false);
  });

  it('пользователь с ролью GUEST — denied', () => {
    const decision = canSeeUnpublished.evaluate(who(OTHER, Role.GUEST), ctx);
    expect(decision.allowed).toBe(false);
  });

  it('без субъекта (гость) — denied', () => {
    expect(canSeeUnpublished.evaluate(undefined, ctx).allowed).toBe(false);
  });
});
