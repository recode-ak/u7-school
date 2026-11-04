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

describe('CourseModuleDef — внешний модуль (D-37)', () => {
  it('паспорт: внешний, зависит от user, Def UC без реализации', () => {
    expect(CourseModuleDef.external).toBe(true);
    expect(normalize(CourseModuleDef)).toMatchObject({
      dependsOn: ['user'],
      aggregates: ['course'],
      useCases: [
        'getCourseEnrollment',
        'getModuleEnrollment',
        'getCoursesIncludingModule',
        'getSameModules',
        'getCoursesStartingWithModule',
        'getModuleSnapshot',
        'getModulePrerequisite',
      ],
      reactions: [],
      jobs: [],
    });
  });

  it('агрегат курса — минимальный контракт: без событий, ошибка — модуль не найден', () => {
    expect(normalize(CourseArDef)).toMatchObject({
      name: 'course',
      events: [],
      errors: ['COURSE_MODULE_NOT_FOUND'],
    });
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
