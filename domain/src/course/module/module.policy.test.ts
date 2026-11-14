import { describe, expect, it } from 'bun:test';
import type { UserView } from '@u7-scl/domain/user/contract';
import { userSubject } from '@u7-scl/domain/user/testing';
import { allowed } from 'dmg-core';
import { ModuleAr } from './module.ar';
import { AUTHOR, OTHER, stored } from './module.fixture';
import { ModulePolicy } from './module.policy';

// Перенос `policy.test.ts`: canRead (4), isAuthor (2), isAdminOrAuthor (3),
// canReadProject (через viewFor, см. module.ar.test.ts) на `canSeeUnpublished`.
// canCreate / canEdit / canAddProject не переносятся (authoring удалён).
// Пересмотр Ф4а: неопубликованное видят только админ и автор модуля; тело
// опубликованного шага — ещё и роли MENTOR и AUTHOR (canReadStepBody).

const who = (uuid: string, ...roles: UserView['roles']) =>
  userSubject({ uuid, roles });
const ctx = { module: ModuleAr.restore(stored('draft')) };

const { canSeeUnpublished } = ModulePolicy.rules;

describe('ModulePolicy.canSeeUnpublished', () => {
  it('админ, не автор — allowed', () => {
    expect(canSeeUnpublished.evaluate(who(OTHER, 'ADMIN'), ctx)).toEqual(
      allowed,
    );
  });

  it('автор без роли AUTHOR (MENTOR) — allowed', () => {
    expect(canSeeUnpublished.evaluate(who(AUTHOR, 'MENTOR'), ctx)).toEqual(
      allowed,
    );
  });

  it('ментор (роль), не автор — denied (пересмотр Ф4а)', () => {
    expect(canSeeUnpublished.evaluate(who(OTHER, 'MENTOR'), ctx).allowed).toBe(
      false,
    );
  });

  it('подписчик, не автор — denied', () => {
    expect(
      canSeeUnpublished.evaluate(who(OTHER, 'SUBSCRIBER'), ctx).allowed,
    ).toBe(false);
  });

  it('ментор с ролью AUTHOR, но чужой модуль — denied', () => {
    expect(canSeeUnpublished.evaluate(who(OTHER, 'AUTHOR'), ctx).allowed).toBe(
      false,
    );
  });

  it('студент (пользователь с ролью GUEST) — denied', () => {
    const decision = canSeeUnpublished.evaluate(who(OTHER, 'GUEST'), ctx);
    expect(decision.allowed).toBe(false);
  });

  it('без субъекта (гость) — denied', () => {
    expect(canSeeUnpublished.evaluate(undefined, ctx).allowed).toBe(false);
  });
});

describe('ModulePolicy.canReadStepBody', () => {
  const { canReadStepBody } = ModulePolicy.rules;

  it('админ, не автор — allowed', () => {
    expect(canReadStepBody.evaluate(who(OTHER, 'ADMIN'), ctx)).toEqual(allowed);
  });

  it('автор модуля без ролей MENTOR/AUTHOR — allowed', () => {
    expect(canReadStepBody.evaluate(who(AUTHOR, 'GUEST'), ctx)).toEqual(
      allowed,
    );
  });

  it('ментор (роль), не автор — allowed', () => {
    expect(canReadStepBody.evaluate(who(OTHER, 'MENTOR'), ctx)).toEqual(
      allowed,
    );
  });

  it('роль AUTHOR, чужой модуль — allowed', () => {
    expect(canReadStepBody.evaluate(who(OTHER, 'AUTHOR'), ctx)).toEqual(
      allowed,
    );
  });

  it('студент (GUEST) — denied', () => {
    expect(canReadStepBody.evaluate(who(OTHER, 'GUEST'), ctx).allowed).toBe(
      false,
    );
  });

  it('подписчик — denied', () => {
    expect(
      canReadStepBody.evaluate(who(OTHER, 'SUBSCRIBER'), ctx).allowed,
    ).toBe(false);
  });

  it('без субъекта (гость) — denied', () => {
    expect(canReadStepBody.evaluate(undefined, ctx).allowed).toBe(false);
  });
});
