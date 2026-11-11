import { describe, expect, it } from 'bun:test';
import { Role } from '@u7-scl/domain/user/contract';
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
// на Policy по Def (TST-02). Субъект — `Pick<User, 'uuid' | 'roles'>`.
// `canCompleteStep` теперь действует: `isSelf` — для завершения шага и выхода.

const who = (uuid: string, ...roles: Role[]) => ({ uuid, roles });
const student = StudentAr.restore(stored('active'));
const stream = StreamAr.restore(streamStored('active'));
const ctx = { student, stream };

const { isSelf, canComplete, canMarkAbandoned } = StudentPolicy.rules;

describe('StudentPolicy.isSelf', () => {
  it('сам студент — allowed', () => {
    expect(isSelf.evaluate(who(USER, Role.STUDENT), { student })).toEqual(
      allowed,
    );
  });

  it('роли не важны: владелец записи проходит и с ролью GUEST', () => {
    expect(isSelf.evaluate(who(USER, Role.GUEST), { student }).allowed).toBe(
      true,
    );
  });

  it.each([
    ['другой студент', who(OTHER_USER, Role.STUDENT)],
    ['ментор потока', who(MENTOR, Role.MENTOR)],
    ['админ', who(OTHER_USER, Role.ADMIN)],
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
      expect(rule.evaluate(who(MENTOR, Role.MENTOR), c)).toEqual(allowed);
    },
  );

  it('админ, не ментор потока — allowed', () => {
    expect(rule.evaluate(who(OTHER_MENTOR, Role.ADMIN), ctx)).toEqual(allowed);
  });

  it.each([
    ['ментор чужого потока', who(OTHER_MENTOR, Role.MENTOR)],
    ['сам студент', who(USER, Role.STUDENT)],
    ['пользователь с ролью GUEST', who(OTHER_USER, Role.GUEST)],
  ])('%s — denied', (_, subject) => {
    expect(rule.evaluate(subject, ctx).allowed).toBe(false);
  });

  it('без субъекта (гость-вызывающий) — denied', () => {
    expect(rule.evaluate(undefined, ctx).allowed).toBe(false);
  });
});
