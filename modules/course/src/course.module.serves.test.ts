import { describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { ModuleFacade } from 'dmg-core/app';
import { normalize } from 'dmg-core/graph';
import { makeCourseEnv } from './course/uc/course-uc.fixture';
import { courseModuleMap, createCourseModule } from './course.module';

// Состав модуля после Ф3: сборка без `legacy` (адаптеров нет), карта «Def →
// класс» на все 16 UC, фасад обслуживает каждый Def. Тесты адаптеров над
// legacy-фасадом из `course.module.test.ts` переезжают в тесты UC рядом
// (`course/uc/*.uc.test.ts`, TST-08).

describe('createCourseModule — сборка модуля курсов (Р10, Т13)', () => {
  const facade = () =>
    new ModuleFacade(createCourseModule(makeCourseEnv().deps));

  it('карта использует ровно те же 16 UC, что объявлены в Def', () => {
    const declared = normalize(CourseModuleDef).useCases;
    expect(declared).toHaveLength(16);
    expect(Object.keys(courseModuleMap.useCases).sort()).toEqual(
      [...declared].sort(),
    );
  });

  it('фасад обслуживает все Def UC модуля', () => {
    const served = facade();
    for (const def of CourseModuleDef.useCases) {
      expect(served.serves(def)).toBe(true);
    }
  });

  it('фасад принадлежит CourseModuleDef', () => {
    expect(facade().def).toBe(CourseModuleDef);
  });
});
