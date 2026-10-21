import { describe, expect, it } from 'bun:test';
import { GetCourseEnrollmentUcDef } from '@u7-scl/domain/course/contract';
import { StartQuestionnaireUcDef } from '@u7-scl/domain/questionnaire/contract';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { WishRules } from '../wish.rules';
import { CreateCourseWishUcDef } from './create-course-wish.uc';

const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

describe('CreateCourseWishUcDef', () => {
  it('нормализуется: command пользователя, без событий, ошибки курса и дубля', () => {
    expect(normalize(CreateCourseWishUcDef)).toMatchObject({
      name: 'createCourseWish',
      type: 'command',
      aggregate: 'wish',
      callers: ['user'],
      errors: ['WISH_COURSE_NOT_FOUND', 'WISH_ALREADY_EXISTS'],
      emits: [],
    });
  });

  it('правила: сначала курс открыт для записи, затем уникальность', () => {
    expect(CreateCourseWishUcDef.rules).toEqual([
      WishRules.rules.courseEnrollable,
      WishRules.rules.unique,
    ]);
  });

  it('calls — запись на курс и запуск анкеты (D-42)', () => {
    expect(CreateCourseWishUcDef.calls).toEqual([
      GetCourseEnrollmentUcDef,
      StartQuestionnaireUcDef,
    ]);
  });

  it('вход — { courseId } uuid', () => {
    expect(
      v.safeParse(CreateCourseWishUcDef.input, { courseId: COURSE }).success,
    ).toBe(true);
    expect(
      v.safeParse(CreateCourseWishUcDef.input, { courseId: 'x' }).success,
    ).toBe(false);
  });

  it.each(['instant', 'questionnaire'] as const)(
    'выход — outcome %s',
    (outcome) => {
      expect(v.parse(CreateCourseWishUcDef.output, { outcome })).toEqual({
        outcome,
      });
    },
  );

  it('выход — иной outcome отклоняется', () => {
    expect(
      v.safeParse(CreateCourseWishUcDef.output, { outcome: 'other' }).success,
    ).toBe(false);
  });
});
