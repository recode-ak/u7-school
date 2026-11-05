import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { CourseModuleDef, CourseView } from '../../contract';
import { CourseAr } from '../course.ar';
import { AUTHOR, stored } from '../course.fixture';
import { ListCoursesUcDef } from './list-courses.uc';

// Def `listCourses`: поля `ListCoursesCmdSchema` (status, authorId, title,
// sort, limit) необязательны; выход — массив `CourseView` (нужны `stages`).

describe('ListCoursesUcDef', () => {
  it('query над агрегатом курса для user и guest, allowAll, без ошибок', () => {
    expect(normalize(ListCoursesUcDef)).toMatchObject({
      name: 'listCourses',
      type: 'query',
      aggregate: 'course',
      callers: ['user', 'guest'],
      errors: [],
    });
    expect(ListCoursesUcDef.policy.op).toBe('allowAll');
  });

  it('вход: все поля необязательны, пустой вход валиден', () => {
    const { input } = ListCoursesUcDef;
    expect(v.parse(input, {})).toEqual({});
    const full = {
      status: 'published' as const,
      authorId: AUTHOR,
      title: 'js',
      sort: 'createdAt:desc',
      limit: 5,
    };
    expect(v.parse(input, full)).toEqual(full);
  });

  it.each([
    ['статус вне перечня', { status: 'open' }],
    ['authorId не uuid', { authorId: 'x' }],
    ['limit 0', { limit: 0 }],
    ['limit дробный', { limit: 1.5 }],
    ['limit строкой', { limit: '3' }],
  ])('вход: %s — отказ', (_, patch) => {
    expect(v.safeParse(ListCoursesUcDef.input, patch).success).toBe(false);
  });

  it('у каждого поля входа есть описание (MAN-02)', () => {
    for (const field of Object.values(ListCoursesUcDef.input.entries)) {
      expect(v.getDescription(field as v.GenericSchema)).toBeString();
    }
  });

  it('выход — массив CourseView (пустой допустим)', () => {
    const { output } = ListCoursesUcDef;
    expect(v.parse(output, [])).toEqual([]);
    const views = [CourseAr.restore(stored('published')).view()];
    expect(v.parse(output, views)).toEqual(views);
    expect(v.safeParse(output, [{ uuid: 'x' }]).success).toBe(false);
    expect(v.safeParse(CourseView, views[0]).success).toBe(true);
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain('listCourses');
  });
});
