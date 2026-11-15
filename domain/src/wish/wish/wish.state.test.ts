import { describe, expect, test } from 'bun:test';
import * as v from 'valibot';
import { WishArDef } from './wish.ar';
import { WishTargetVo } from './wish.state';

const STREAM = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const validCourseTarget: WishTargetVo = {
  kind: 'course',
  courseId: crypto.randomUUID(),
};

const validModuleTarget: WishTargetVo = {
  kind: 'module',
  moduleId: crypto.randomUUID(),
};

describe('WishTargetVo', () => {
  test.each([
    ['цель course', validCourseTarget],
    ['цель module', validModuleTarget],
  ])('принимает валидную %s', (_, input) => {
    const result = v.safeParse(WishTargetVo, input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toEqual(input);
    }
  });

  test.each([
    ['неизвестный kind', { kind: 'mentorship', mentorId: 'x' }],
    ['course без courseId', { kind: 'course' }],
    ['не-uuid courseId', { kind: 'course', courseId: 'not-a-uuid' }],
    ['не-uuid moduleId', { kind: 'module', moduleId: 'not-a-uuid' }],
  ])('отклоняет цель: %s', (_, input) => {
    expect(v.safeParse(WishTargetVo, input).success).toBe(false);
  });
});

/** `WishArDef.state` — схема, которой читается файл желаний. */
describe('WishArDef.state', () => {
  const base = {
    uuid: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    status: 'pending',
    target: validCourseTarget,
  };

  const created = Date.UTC(2026, 7, 26, 10);
  const updated = Date.UTC(2026, 7, 27, 8, 30);

  test.each([
    [
      'полная запись',
      { ...base, createdAt: created, updatedAt: updated },
      { createdAt: created, updatedAt: updated },
    ],
    [
      'запись без updatedAt и version',
      { ...base, createdAt: created },
      { createdAt: created, updatedAt: created },
    ],
    [
      'список uuid потоков',
      {
        ...base,
        createdAt: created,
        updatedAt: updated,
        invitedStreamIds: [STREAM],
      },
      { createdAt: created, updatedAt: updated },
    ],
  ])('принимает %s: даты как есть, version 0', (_, input, dates) => {
    const result = v.safeParse(WishArDef.state, input);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.createdAt).toBe(dates.createdAt);
      expect(result.output.updatedAt).toBe(dates.updatedAt);
      expect(result.output.version).toBe(0);
    }
  });

  test('ISO-строка в дате отвергается', () => {
    const iso = '2026-08-26T10:00';
    expect(
      v.safeParse(WishArDef.state, { ...base, createdAt: iso }).success,
    ).toBe(false);
    expect(
      v.safeParse(WishArDef.state, {
        ...base,
        createdAt: created,
        updatedAt: iso,
      }).success,
    ).toBe(false);
  });

  test.each([
    [
      'legacy-поле courseId вместо target',
      { ...base, target: undefined, courseId: crypto.randomUUID() },
    ],
    [
      'не-uuid в invitedStreamIds',
      { ...base, invitedStreamIds: ['not-a-uuid'] },
    ],
  ])('отклоняет желание: %s', (_, input) => {
    expect(v.safeParse(WishArDef.state, input).success).toBe(false);
  });
});
