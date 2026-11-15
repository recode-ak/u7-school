import { describe, expect, it } from 'bun:test';
import { WishQuestionnaireOwner } from './wish-questionnaire-owner';

const COURSE = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';

describe('WishQuestionnaireOwner', () => {
  it('ownerInfo запуска разбирается обратно в цель желания', () => {
    const info = WishQuestionnaireOwner.forCourse(COURSE).info();
    expect(WishQuestionnaireOwner.parse(info)?.target()).toEqual({
      kind: 'course',
      courseId: COURSE,
    });
  });

  it.each([
    ['пустой объект', {}],
    ['не строка', { courseId: 42 }],
    ['пустая строка', { courseId: '' }],
    ['чужой формат', { lessonId: 'x' }],
    ['null', null],
    ['строка', 'x'],
    ['undefined', undefined],
  ])('чужой или битый owner (%s) — не наша анкета', (_, owner) => {
    expect(WishQuestionnaireOwner.parse(owner)).toBeUndefined();
  });
});
