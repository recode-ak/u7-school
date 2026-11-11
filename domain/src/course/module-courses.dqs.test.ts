import { describe, expect, it } from 'bun:test';
import { CourseAr } from './course/course.ar';
import { M1, M2, M3, OUTSIDE, phase, stored } from './course/course.fixture';
import type { CourseState } from './course/course.state';
import { ModuleCoursesDqs } from './module-courses.dqs';

// Единственное место правила «какой курс у модуля» (С2, расхождение 10 брифа):
// сохраняет поведение v0.2.6 — `firstIncluding` (любой статус, первый в порядке
// файла: `getCourseByModule`, `getModulePrerequisite`) и `firstPublishedIncluding`
// (`getModulePlace`, `getModuleEnrollment`). Фикстурные случаи — общий модуль
// у двух курсов: `a1a1…` второй в `fafa…` и первый в `cccc…`.

const FAFA = 'fafafafa-baba-4aba-8aba-babababababa';
const CCCC = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const DDDD = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const A0 = 'a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0';
const A1 = 'a1a1a1a1-b1b1-4b1b-8b1b-b1b1b1b1b1b1';

const course = (
  uuid: string,
  status: CourseState['status'],
  moduleIds: string[],
  phases: CourseState['phases'] = [],
) => CourseAr.restore(stored(status, { uuid, moduleIds, phases }));

/** Фикстурные курсы: `fafa…` (A0, затем A1, два этапа) и `cccc…` (A1 первым). */
const fixtureCourses = () => [
  course(
    FAFA,
    'published',
    [A0, A1],
    [phase('Синтаксис', A0), phase('Алгоритмика', A1)],
  ),
  course(CCCC, 'published', [A1]),
];

const ids = (...courses: (CourseAr | undefined)[]) =>
  courses.map((c) => c?.uuid);

describe('ModuleCoursesDqs.firstIncluding — любой статус, порядок файла', () => {
  it('единственный курс с модулем', () => {
    const dqs = new ModuleCoursesDqs([
      course(FAFA, 'published', [M1]),
      course(CCCC, 'published', [M2]),
    ]);
    expect(dqs.firstIncluding(M2)?.uuid).toBe(CCCC);
  });

  it('архивный курс находится (перенос get-course-by-module-uc.test)', () => {
    const dqs = new ModuleCoursesDqs([course(FAFA, 'archived', [M1])]);
    expect(dqs.firstIncluding(M1)?.uuid).toBe(FAFA);
  });

  it('модуль вне курсов — undefined (перенос get-course-by-module-uc.test)', () => {
    const dqs = new ModuleCoursesDqs([course(FAFA, 'published', [M1])]);
    expect(dqs.firstIncluding(OUTSIDE)).toBeUndefined();
  });

  it('несколько курсов с модулем: первый в порядке файла, статус не важен', () => {
    const dqs = new ModuleCoursesDqs([
      course(FAFA, 'archived', [M1]),
      course(CCCC, 'published', [M1]),
    ]);
    expect(dqs.firstIncluding(M1)?.uuid).toBe(FAFA);
  });

  it('фикстурный случай С2: общий модуль a1a1… — первым берётся fafa… (второй в нём)', () => {
    const dqs = new ModuleCoursesDqs(fixtureCourses());
    expect(dqs.firstIncluding(A1)?.uuid).toBe(FAFA);
  });

  it('порядок массива — часть правила: переставленные курсы дают cccc…', () => {
    const dqs = new ModuleCoursesDqs([...fixtureCourses()].reverse());
    expect(dqs.firstIncluding(A1)?.uuid).toBe(CCCC);
  });
});

describe('ModuleCoursesDqs.firstPublishedIncluding — только опубликованные', () => {
  it('draft и archived пропускаются', () => {
    const dqs = new ModuleCoursesDqs([
      course(FAFA, 'draft', [M1]),
      course(CCCC, 'archived', [M1]),
      course(DDDD, 'published', [M1]),
    ]);
    expect(dqs.firstPublishedIncluding(M1)?.uuid).toBe(DDDD);
  });

  it('только неопубликованные — undefined (архивный не участвует)', () => {
    const dqs = new ModuleCoursesDqs([
      course(FAFA, 'archived', [M1]),
      course(CCCC, 'draft', [M1]),
    ]);
    expect(dqs.firstPublishedIncluding(M1)).toBeUndefined();
  });

  it('модуль вне курсов — undefined', () => {
    const dqs = new ModuleCoursesDqs([course(FAFA, 'published', [M1])]);
    expect(dqs.firstPublishedIncluding(M3)).toBeUndefined();
  });

  it('несколько опубликованных: первый в порядке файла', () => {
    const dqs = new ModuleCoursesDqs([
      course(FAFA, 'published', [M1]),
      course(CCCC, 'published', [M1]),
    ]);
    expect(dqs.firstPublishedIncluding(M1)?.uuid).toBe(FAFA);
  });

  it('фикстурный случай С2: a1a1… — опубликованный fafa… идёт раньше cccc… (место не первое)', () => {
    const dqs = new ModuleCoursesDqs(fixtureCourses());
    const found = dqs.firstPublishedIncluding(A1);
    expect(found?.uuid).toBe(FAFA);
    // Следствие для getCoursesStartingWithModule (расхождение 9): по первому
    // найденному курсу a1a1… не первый, хотя в cccc… он стартовый.
    expect(found?.placeOf(A1)?.isFirst).toBe(false);
    expect(
      ids(...fixtureCourses().filter((c) => c.startModuleId() === A1)),
    ).toEqual([CCCC]);
  });

  it('фикстурный случай С2: fafa… в архиве — правила расходятся (любой статус → fafa…, опубликованный → cccc…)', () => {
    const dqs = new ModuleCoursesDqs([
      course(
        FAFA,
        'archived',
        [A0, A1],
        [phase('Синтаксис', A0), phase('Алгоритмика', A1)],
      ),
      course(CCCC, 'published', [A1]),
    ]);
    expect(dqs.firstIncluding(A1)?.uuid).toBe(FAFA);
    expect(dqs.firstPublishedIncluding(A1)?.uuid).toBe(CCCC);
  });
});

describe('ModuleCoursesDqs.startsPublishedCourse — стартовый модуль опубликованного курса', () => {
  it('единственный опубликованный курс, модуль первый — true', () => {
    const dqs = new ModuleCoursesDqs([course(FAFA, 'published', [M1, M2])]);
    expect(dqs.startsPublishedCourse(M1)).toBe(true);
  });

  it('модуль не первый — false', () => {
    const dqs = new ModuleCoursesDqs([course(FAFA, 'published', [M1, M2])]);
    expect(dqs.startsPublishedCourse(M2)).toBe(false);
  });

  it('модуль вне опубликованных курсов — false', () => {
    const dqs = new ModuleCoursesDqs([course(FAFA, 'published', [M1])]);
    expect(dqs.startsPublishedCourse(OUTSIDE)).toBe(false);
  });

  it('неопубликованный курс не участвует: архивный стартовый не делает модуль стартовым', () => {
    const dqs = new ModuleCoursesDqs([
      course(FAFA, 'archived', [M1, M2]),
      course(CCCC, 'published', [M2]),
    ]);
    expect(dqs.startsPublishedCourse(M1)).toBe(false);
  });

  it('фикстурный порядок fafa…/cccc…: a1a1… не стартовый в fafa…, хотя в cccc… он первый', () => {
    const dqs = new ModuleCoursesDqs(fixtureCourses());

    expect(dqs.startsPublishedCourse(A1)).toBe(false);
    expect(dqs.startsPublishedCourse(A0)).toBe(true);
  });

  it('обратный порядок cccc…/fafa…: стартовый курс — cccc… (a0a0… всё равно первый в fafa…)', () => {
    const dqs = new ModuleCoursesDqs([...fixtureCourses()].reverse());

    expect(dqs.startsPublishedCourse(A1)).toBe(true);
    expect(dqs.startsPublishedCourse(A0)).toBe(true);
  });
});
