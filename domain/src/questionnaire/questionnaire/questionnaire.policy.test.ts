import { describe, expect, it } from 'bun:test';
import type { UserView } from '@u7-scl/domain/user/contract';
import { userSubject } from '@u7-scl/domain/user/testing';
import { denied } from 'dmg-core';
import { QuestionnaireAr } from './questionnaire.ar';
import {
  ADMIN_USER,
  OTHER_USER,
  RESPONDENT,
  stored,
} from './questionnaire.fixture';
import { QuestionnairePolicy } from './questionnaire.policy';

// Перенос `questionnaire-respondent.policy.test.ts` (hasRespondent) и новые
// правила Р4 (TST-02): респондент, admin, чужой, без субъекта.

const who = (uuid: string, ...roles: UserView['roles']) =>
  userSubject({ uuid, roles });
const questionnaire = QuestionnaireAr.restore(stored('in_progress'));
const ctx = { questionnaire };
const { hasRespondent, isRespondent, isAdmin, canAccess, canListFor } =
  QuestionnairePolicy.rules;

describe('QuestionnairePolicy.hasRespondent', () => {
  it('системный вызов без человека — denied', () => {
    expect(hasRespondent.evaluate(undefined, {})).toEqual(
      denied(
        'hasRespondent',
        'Анкету можно запустить только за человека-респондента.',
      ),
    );
  });
});

describe('QuestionnairePolicy.isRespondent', () => {
  it('респондент анкеты — allowed, роли не важны', () => {
    expect(isRespondent.evaluate(who(RESPONDENT, 'GUEST'), ctx).allowed).toBe(
      true,
    );
  });

  it.each([
    ['другой пользователь', who(OTHER_USER, 'GUEST')],
    ['admin, не респондент', who(ADMIN_USER, 'ADMIN')],
  ])('%s — denied', (_, subject) => {
    expect(isRespondent.evaluate(subject, ctx).allowed).toBe(false);
  });

  it('без субъекта — denied', () => {
    expect(isRespondent.evaluate(undefined, ctx).allowed).toBe(false);
  });
});

describe('QuestionnairePolicy.isAdmin', () => {
  it('роль admin — allowed', () => {
    expect(isAdmin.evaluate(who(ADMIN_USER, 'ADMIN'), {}).allowed).toBe(true);
  });

  it('не админ (ментор) — denied', () => {
    expect(isAdmin.evaluate(who(OTHER_USER, 'MENTOR'), {}).allowed).toBe(false);
  });

  it('без субъекта — denied', () => {
    expect(isAdmin.evaluate(undefined, {}).allowed).toBe(false);
  });
});

describe('QuestionnairePolicy.canAccess', () => {
  it('респондент — allowed', () => {
    expect(canAccess.evaluate(who(RESPONDENT, 'GUEST'), ctx).allowed).toBe(
      true,
    );
  });

  it('admin читает и правит чужую анкету — allowed', () => {
    expect(canAccess.evaluate(who(ADMIN_USER, 'ADMIN'), ctx).allowed).toBe(
      true,
    );
  });

  it.each([
    ['чужой гость', who(OTHER_USER, 'GUEST')],
    ['чужой ментор', who(OTHER_USER, 'MENTOR')],
    ['без субъекта', undefined],
  ])('%s — denied', (_, subject) => {
    const decision = canAccess.evaluate(subject, ctx);
    expect(decision.allowed).toBe(false);
  });
});

describe('QuestionnairePolicy.canListFor', () => {
  it('свой список — allowed', () => {
    expect(
      canListFor.evaluate(who(RESPONDENT, 'GUEST'), { userId: RESPONDENT })
        .allowed,
    ).toBe(true);
  });

  it('admin — чужой список allowed', () => {
    expect(
      canListFor.evaluate(who(ADMIN_USER, 'ADMIN'), { userId: RESPONDENT })
        .allowed,
    ).toBe(true);
  });

  it.each([
    ['чужой список', who(OTHER_USER, 'GUEST')],
    ['без субъекта', undefined],
  ])('%s — denied', (_, subject) => {
    const decision = canListFor.evaluate(subject, { userId: RESPONDENT });
    expect(decision.allowed).toBe(false);
  });
});
