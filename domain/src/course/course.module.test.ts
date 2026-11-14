import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { CourseModuleDef } from './contract';

// Паспорт модуля: не внешний, 4 агрегата, 17 Def UC, ER и Job нет.

describe('CourseModuleDef', () => {
  it('паспорт: не внешний, зависит от user, 4 агрегата, 17 Def UC', () => {
    expect(CourseModuleDef.external).toBeFalsy();
    const passport = normalize(CourseModuleDef);
    expect(passport).toMatchObject({
      dependsOn: ['user'],
      reactions: [],
      jobs: [],
    });
    // Порядок в паспорте не часть контракта: сверяем состав.
    expect([...passport.aggregates].sort()).toEqual(
      ['course', 'lesson', 'module', 'step'].sort(),
    );
    expect([...passport.useCases].sort()).toEqual(
      [
        'getCourseEnrollment',
        'getModuleEnrollment',
        'getCoursesIncludingModule',
        'getSameModules',
        'getCoursesStartingWithModule',
        'getModulePrerequisite',
        'getModule',
        'listModules',
        'getLesson',
        'getStep',
        'getStepsByLessons',
        'getSnapshotSteps',
        'getModuleSnapshot',
        'getCourse',
        'listCourses',
        'getCourseByModule',
        'getModulePlace',
      ].sort(),
    );
    expect(passport.useCases).toHaveLength(17);
  });
});
