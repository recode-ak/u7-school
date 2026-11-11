import { describe, expect, it } from 'bun:test';
import {
  AggregateDef,
  allowAll,
  BaseEntityFields,
  ErrorDef,
  F,
  ModuleDef,
  UseCaseDef,
} from 'dmg-core';
import { ArchChecker } from 'dmg-core/arch';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { CourseModuleDef, GetCourseEnrollmentUcDef } from './contract';
import { CourseArDef } from './course/course.ar';
import { CourseErrors } from './course/course.errors';
import { LessonArDef } from './lesson/lesson.ar';
import { LessonErrors } from './lesson/lesson.errors';
import { ModuleArDef } from './module/module.ar';
import { ModuleErrors } from './module/module.errors';
import { StepArDef } from './step/step.ar';
import { StepErrors } from './step/step.errors';

// Паспорт модуля после среза: `external` снят, 4 агрегата, 16 UC, ER и Job нет; заменяет
// ожидания внешнего модуля (external, 16 UC без реализации).

describe('CourseModuleDef', () => {
  it('модуль не внешний', () => {
    expect(CourseModuleDef.external).toBeFalsy();
  });

  it('паспорт: зависит от user, 4 агрегата, 16 Def UC', () => {
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
        'getModuleSnapshot',
        'getCourse',
        'listCourses',
        'getCourseByModule',
        'getModulePlace',
      ].sort(),
    );
    expect(passport.useCases).toHaveLength(16);
  });

  it('агрегат курса: без событий, одна ошибка — COURSE_NOT_FOUND (модуль не найден — ModuleErrors.NOT_FOUND, Т8)', () => {
    expect(normalize(CourseArDef)).toMatchObject({
      name: 'course',
      events: [],
      errors: ['COURSE_NOT_FOUND'],
    });
    expect(Object.values(CourseErrors).map((e) => e.code)).toEqual([
      'COURSE_NOT_FOUND',
    ]);
  });

  it('агрегат модуля: без событий, одна ошибка — MODULE_NOT_FOUND', () => {
    expect(normalize(ModuleArDef)).toMatchObject({
      name: 'module',
      events: [],
      errors: ['MODULE_NOT_FOUND'],
    });
    expect(Object.values(ModuleErrors).map((e) => e.code)).toEqual([
      'MODULE_NOT_FOUND',
    ]);
  });

  it('агрегат урока: без событий, одна ошибка — LESSON_NOT_FOUND', () => {
    expect(normalize(LessonArDef)).toMatchObject({
      name: 'lesson',
      events: [],
      errors: ['LESSON_NOT_FOUND'],
    });
    expect(Object.values(LessonErrors).map((e) => e.code)).toEqual([
      'LESSON_NOT_FOUND',
    ]);
  });

  it('агрегат шага: без событий, одна ошибка — STEP_NOT_FOUND', () => {
    expect(normalize(StepArDef)).toMatchObject({
      name: 'step',
      events: [],
      errors: ['STEP_NOT_FOUND'],
    });
    expect(Object.values(StepErrors).map((e) => e.code)).toEqual([
      'STEP_NOT_FOUND',
    ]);
  });

  it('ArchChecker — без нарушений', () => {
    expect(ArchChecker.defsOf([CourseModuleDef]).report()).toEqual([]);
  });

  it('UC вызывается другим модулем по calls (D-42) — без нарушений', () => {
    const ProbeArDef = AggregateDef.define({
      name: 'probe',
      label: 'Проба',
      description: 'Агрегат модуля-потребителя.',
      state: v.object({ ...BaseEntityFields }),
      events: {},
      errors: ErrorDef.define('PROBE', {}),
    });
    const consumer = ModuleDef.define({
      name: 'probe',
      label: 'Проба',
      description: 'Модуль-потребитель для проверки контракта.',
      dependsOn: [CourseModuleDef],
      aggregates: [ProbeArDef],
      useCases: [
        UseCaseDef.define({
          name: 'probeEnroll',
          label: 'Проба записи',
          description: 'Спрашивает у курса стартовый модуль.',
          type: 'query',
          aggregate: ProbeArDef,
          callers: ['user'],
          policy: allowAll,
          calls: [GetCourseEnrollmentUcDef],
          input: v.object({ courseId: F.uuid('курса') }),
          output: v.object({}),
          errors: [],
        }),
      ],
      reactions: [],
      jobs: [],
    });
    expect(ArchChecker.defsOf([consumer]).report()).toEqual([]);
  });
});
