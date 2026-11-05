import { beforeEach, describe, expect, it } from 'bun:test';
import type { Course } from '@u7-scl/domain/course';
import { GetModulePrerequisiteUcDef } from '@u7-scl/domain/course/contract';
import { SystemCaller } from 'dmg-core';
import {
  type AppContext,
  ModuleFacade,
  ModuleFacades,
  Trace,
} from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { type CourseLegacy, createCourseModule } from '../../course.module';
import { LessonRepoFake } from '../../lesson/lesson.repo.fake';
import { ModuleRepoFake } from '../../module/module.repo.fake';
import { StepRepoFake } from '../../step/step.repo.fake';

// `getModulePrerequisite` — адаптер над legacy `getCourseByModuleId` +
// `LegacyCourseAr.getPrevModuleId` + `getModule` (enroll-student-uc.ts:52-70):
// курса нет или модуль входной → none; модуля нет в курсе → closed;
// иначе module { moduleId, title }; `getModule` упал → title = moduleId.

const M1 = '11111111-1111-4111-8111-111111111111';
const M2 = '22222222-2222-4222-8222-222222222222';
const M3 = '33333333-3333-4333-8333-333333333333';
const OUTSIDE = '99999999-9999-4999-8999-999999999999';
const REQ = Trace.fromRequest({ requestId: 'r-1' });
const asSystem = new SystemCaller({
  kind: 'useCase',
  module: 'probe',
  name: 'probe',
});

const course = (...phases: string[][]): Course =>
  ({
    uuid: '44444444-4444-4444-8444-444444444444',
    title: 'Курс',
    description: 'Описание',
    authorId: '55555555-5555-4555-8555-555555555555',
    phases: phases.map((moduleIds, i) => ({
      title: `Фаза ${i + 1}`,
      moduleIds,
    })),
    status: 'published',
    createdAt: '2026-06-01T10:00',
  }) as unknown as Course;

let app: AppContext;
beforeEach(() => {
  app = testAppContext().app;
});

function facadeOver(
  found: Course | undefined,
  getModule: (id: string) => Promise<{ title: string }> = async (id) => ({
    title: `Модуль ${id.slice(0, 2)}`,
  }),
) {
  const legacy = {
    isCourseEnrollable: async () => true,
    getCourseStartModuleId: async () => undefined,
    getModulePlace: async () => undefined,
    whichCoursesIncludeModule: async () => [],
    whichModulesAreSame: async () => [],
    getCourseByModuleId: async () => found,
    getModule,
  } as unknown as CourseLegacy;
  return new ModuleFacade(
    createCourseModule({
      app,
      facades: new ModuleFacades(),
      legacy,
      modules: new ModuleRepoFake(),
      lessons: new LessonRepoFake(),
      steps: new StepRepoFake(),
    }),
  );
}

const ask = (facade: ReturnType<typeof facadeOver>, moduleId: string) =>
  facade.handle(GetModulePrerequisiteUcDef, { moduleId }, asSystem, REQ);

describe('getModulePrerequisite: адаптер над legacy', () => {
  it('курса с этим модулем нет — none', async () => {
    expect(expectOk(await ask(facadeOver(undefined), M2))).toEqual({
      gate: 'none',
    });
  });

  it('первый модуль курса — none', async () => {
    expect(expectOk(await ask(facadeOver(course([M1, M2])), M1))).toEqual({
      gate: 'none',
    });
  });

  it('второй модуль — module с id и названием предыдущего', async () => {
    expect(expectOk(await ask(facadeOver(course([M1, M2])), M2))).toEqual({
      gate: 'module',
      moduleId: M1,
      title: 'Модуль 11',
    });
  });

  it('предыдущий ищется через границу фаз', async () => {
    expect(
      expectOk(await ask(facadeOver(course([M1], [M2, M3])), M2)),
    ).toMatchObject({ gate: 'module', moduleId: M1 });
  });

  it('модуля нет в порядке курса — closed', async () => {
    expect(expectOk(await ask(facadeOver(course([M1, M2])), OUTSIDE))).toEqual({
      gate: 'closed',
    });
  });

  it('getModule упал — title равен id предыдущего модуля', async () => {
    const facade = facadeOver(course([M1, M2]), async () => {
      throw new Error('модуль недоступен');
    });
    expect(expectOk(await ask(facade, M2))).toEqual({
      gate: 'module',
      moduleId: M1,
      title: M1,
    });
  });

  it('модуль курсов обслуживает getModulePrerequisite', () => {
    expect(facadeOver(undefined).serves(GetModulePrerequisiteUcDef)).toBe(true);
  });
});
