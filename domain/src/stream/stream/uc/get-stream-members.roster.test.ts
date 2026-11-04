import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { GetStreamMembersUcDef } from './get-stream-members.uc';

// Расширение `getStreamMembers` (п. 3 spec, решение 11): к составу добавлен
// `roster` — отставание и сводка по студентам для monitor. Старые поля
// (`mentorId`, `students`) не меняются — на них опирается peer-review.
// `list-stream-students` удалён.

const STREAM_MEMBER = {
  studentId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  status: 'active',
  neverStarted: false,
  inProgress: true,
};
const MENTOR = '66666666-6666-4666-8666-666666666666';

describe('GetStreamMembersUcDef — roster', () => {
  it('состав с roster валиден и roster сохраняется в разборе', () => {
    const out = {
      mentorId: MENTOR,
      students: [STREAM_MEMBER],
      roster: [
        {
          studentId: STREAM_MEMBER.studentId,
          lagLevel: 'lagging',
          hoursSinceLastActivity: 120,
        },
      ],
    };
    const parsed = v.parse(GetStreamMembersUcDef.output, out);
    expect(parsed?.roster).toHaveLength(1);
    expect(parsed?.roster?.[0]).toMatchObject({
      studentId: STREAM_MEMBER.studentId,
      lagLevel: 'lagging',
      hoursSinceLastActivity: 120,
    });
  });

  it.each(['critical', 'lagging', 'on_track'])(
    'уровень отставания %s допустим',
    (lagLevel) => {
      const out = {
        mentorId: MENTOR,
        students: [STREAM_MEMBER],
        roster: [
          {
            studentId: STREAM_MEMBER.studentId,
            lagLevel,
            hoursSinceLastActivity: 0,
          },
        ],
      };
      expect(v.safeParse(GetStreamMembersUcDef.output, out).success).toBe(true);
    },
  );

  it('чужой уровень отставания отклоняется', () => {
    const out = {
      mentorId: MENTOR,
      students: [STREAM_MEMBER],
      roster: [
        {
          studentId: STREAM_MEMBER.studentId,
          lagLevel: 'hopeless',
          hoursSinceLastActivity: 0,
        },
      ],
    };
    expect(v.safeParse(GetStreamMembersUcDef.output, out).success).toBe(false);
  });

  it('старые поля состава остались: students со статусом, neverStarted, inProgress', () => {
    const out = v.parse(GetStreamMembersUcDef.output, {
      mentorId: MENTOR,
      students: [STREAM_MEMBER],
      roster: [],
    });
    expect(out?.students).toEqual([STREAM_MEMBER]);
  });
});
