import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { GetStreamMembersUcDef } from './get-stream-members.uc';

const STREAM = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const USER = '22222222-2222-4222-8222-222222222222';
const members = {
  mentorId: '66666666-6666-4666-8666-666666666666',
  students: [
    {
      studentId: '11111111-1111-4111-8111-111111111111',
      userId: USER,
      status: 'abandoned',
      neverStarted: true,
      inProgress: false,
    },
  ],
};

describe('GetStreamMembersUcDef', () => {
  it('query для других модулей (system) и бота (user, guest) над агрегатом потока, allowAll, без ошибок', () => {
    expect(normalize(GetStreamMembersUcDef)).toMatchObject({
      name: 'getStreamMembers',
      type: 'query',
      aggregate: 'stream',
      callers: ['system', 'user', 'guest'],
      errors: [],
    });
    expect(GetStreamMembersUcDef.policy.op).toBe('allowAll');
  });

  it('вход — uuid потока', () => {
    const { input } = GetStreamMembersUcDef;
    expect(v.parse(input, { streamId: STREAM })).toEqual({ streamId: STREAM });
    expect(v.safeParse(input, { streamId: 'x' }).success).toBe(false);
  });

  it.each(['enrolled', 'active', 'abandoned', 'advanced', 'not_advanced'])(
    'выход: состав со статусом студента %s',
    (status) => {
      const out = {
        ...members,
        students: [{ ...members.students[0], status }],
      };
      expect(v.parse(GetStreamMembersUcDef.output, out)).toEqual(out as never);
    },
  );

  it('выход: пустой состав валиден; чужой статус и неполные поля отклоняются', () => {
    const { output } = GetStreamMembersUcDef;
    expect(v.safeParse(output, { ...members, students: [] }).success).toBe(
      true,
    );
    expect(
      v.safeParse(output, {
        ...members,
        students: [{ ...members.students[0], status: 'x' }],
      }).success,
    ).toBe(false);
    expect(v.safeParse(output, { mentorId: members.mentorId }).success).toBe(
      false,
    );
  });

  it('«нет потока» — штатный исход undefined, не ошибка', () => {
    expect(v.safeParse(GetStreamMembersUcDef.output, undefined).success).toBe(
      true,
    );
  });
});
