import { describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { normalize } from 'dmg-core/graph';
import { courseModuleMap } from './course.module';

// Порт «Def → класс» проверяется там, где он собирается: фасад и полнота карты —
// тесты платформы (`dmg-core/app`), состав модуля — `domain/course/course.module.test.ts`.
// Здесь остаётся только карта UC модуля на свои Def (TST-08).

describe('createCourseModule — сборка модуля курсов (Р10, Т13)', () => {
  it('карта использует ровно те же 17 UC, что объявлены в Def', () => {
    const declared = normalize(CourseModuleDef).useCases;
    expect(declared).toHaveLength(17);
    expect(Object.keys(courseModuleMap.useCases).sort()).toEqual(
      [...declared].sort(),
    );
  });
});
