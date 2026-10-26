import { describe, expect, it } from 'bun:test';
import {
  allowAll,
  BaseEntityFields,
  defineAggregate,
  defineErrors,
  defineModule,
  defineUseCase,
  F,
} from 'dmg-core';
import { checkDefs, formatViolation } from 'dmg-core/arch';
import { indexDefs, normalize } from 'dmg-core/graph';
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
      ],
      reactions: [],
      jobs: [],
    });
  });

  it('агрегат курса — минимальный контракт: без событий и ошибок', () => {
    expect(normalize(CourseArDef)).toMatchObject({
      name: 'course',
      events: [],
      errors: [],
    });
  });

  it('checkDefs — без нарушений', () => {
    expect(
      checkDefs(indexDefs([CourseModuleDef])).map(formatViolation),
    ).toEqual([]);
  });

  it('UC вызывается другим модулем по calls (D-42) — без нарушений', () => {
    const ProbeArDef = defineAggregate({
      name: 'probe',
      label: 'Проба',
      description: 'Агрегат модуля-потребителя.',
      state: v.object({ ...BaseEntityFields }),
      events: {},
      errors: defineErrors('PROBE', {}),
    });
    const consumer = defineModule({
      name: 'probe',
      label: 'Проба',
      description: 'Модуль-потребитель для проверки контракта.',
      dependsOn: [CourseModuleDef],
      aggregates: [ProbeArDef],
      useCases: [
        defineUseCase({
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
    expect(checkDefs(indexDefs([consumer])).map(formatViolation)).toEqual([]);
  });
});
