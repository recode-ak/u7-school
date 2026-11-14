import { describe, expect, it } from 'bun:test';
import type { UserView } from '@u7-scl/domain/user/contract';
import { userSubject } from '@u7-scl/domain/user/testing';
import { allowed } from 'dmg-core';
import { StreamAr } from '../stream/stream.ar';
import {
  MENTOR,
  OTHER_MENTOR,
  stored as streamStored,
} from '../stream/stream.fixture';
import { StudentAr } from './student.ar';
import { OTHER_USER, stored, USER } from './student.fixture';
import { StudentPolicy } from './student.policy';

// Перенос `policy.test.ts` (canViewProgress, canCompleteStep, canManageStudent)
// на Policy по Def (TST-02). Субъект — `UserAr` через `userSubject`.
// `canCompleteStep` теперь действует: `isSelf` — для завершения шага и выхода.

const who = (uuid: string, ...roles: UserView['roles']) =>
  userSubject({ uuid, roles });
const student = StudentAr.restore(stored('active'));
const stream = StreamAr.restore(streamStored('active'));
const ctx = { student, stream };

const { isSelf, canComplete, canMarkAbandoned } = StudentPolicy.rules;

describe('StudentPolicy.isSelf', () => {
  it.each(['SUBSCRIBER', 'GUEST'] as const)(
    'владелец записи с ролью %s — allowed (роли не важны)',
    (role) => {
      expect(isSelf.evaluate(who(USER, role), { student })).toEqual(allowed);
    },
  );

  it.each([
    ['другой студент', who(OTHER_USER, 'GUEST')],
    ['ментор потока', who(MENTOR, 'MENTOR')],
    ['админ', who(OTHER_USER, 'ADMIN')],
  ])('%s — denied', (_, subject) => {
    expect(isSelf.evaluate(subject, { student }).allowed).toBe(false);
  });

  it('без субъекта (гость) — denied', () => {
    expect(isSelf.evaluate(undefined, { student }).allowed).toBe(false);
  });
});

describe.each([
  ['canComplete', canComplete],
  ['canMarkAbandoned', canMarkAbandoned],
] as const)('StudentPolicy.%s', (_, rule) => {
  it.each(['enrolled', 'active', 'abandoned', 'advanced'] as const)(
    'ментор потока, студент в статусе %s — allowed',
    (status) => {
      const c = { student: StudentAr.restore(stored(status)), stream };
      expect(rule.evaluate(who(MENTOR, 'MENTOR'), c)).toEqual(allowed);
    },
  );

  it('админ, не ментор потока — allowed', () => {
    expect(rule.evaluate(who(OTHER_MENTOR, 'ADMIN'), ctx)).toEqual(allowed);
  });

  it.each([
    ['ментор чужого потока', who(OTHER_MENTOR, 'MENTOR')],
    ['сам студент', who(USER, 'GUEST')],
    ['пользователь с ролью GUEST', who(OTHER_USER, 'GUEST')],
  ])('%s — denied', (_, subject) => {
    expect(rule.evaluate(subject, ctx).allowed).toBe(false);
  });

  it('без субъекта (гость-вызывающий) — denied', () => {
    expect(rule.evaluate(undefined, ctx).allowed).toBe(false);
  });
});
