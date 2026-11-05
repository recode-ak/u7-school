import { beforeEach, describe, expect, it } from 'bun:test';
import { AppException } from '@u7-scl/core/domain';
import { GetModuleSnapshotUcDef } from '@u7-scl/domain/course/contract';
import { SystemCaller } from 'dmg-core';
import {
  type AppContext,
  ModuleFacade,
  ModuleFacades,
  Trace,
} from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import { type CourseLegacy, createCourseModule } from '../../course.module';
import { ModuleRepoFake } from '../../module/module.repo.fake';

// `getModuleSnapshot` — адаптер над legacy `getModuleSnapshot`
// (`CourseInProcFacade`). Нет модуля (`MODULE_NOT_FOUND` legacy) →
// `COURSE_MODULE_NOT_FOUND`; любой другой сбой → `SERVER_INTERNAL`.

const MODULE = '0b6c2f4e-3d1a-4c5b-9e8f-7a6b5c4d3e2f';
const REQ = Trace.fromRequest({ requestId: 'r-1' });
const asSystem = new SystemCaller({
  kind: 'useCase',
  module: 'probe',
  name: 'probe',
});

const snapshot = [
  {
    projectId: '11111111-1111-4111-8111-111111111111',
    projectTitle: 'Введение',
    lessons: [
      {
        lessonId: '22222222-2222-4222-8222-222222222222',
        lessonTitle: 'Урок 1',
        stepIds: ['33333333-3333-4333-8333-333333333333'],
      },
    ],
  },
];

let app: AppContext;
beforeEach(() => {
  app = testAppContext().app;
});

function facadeOver(getModuleSnapshot: CourseLegacy['getModuleSnapshot']) {
  const legacy: CourseLegacy = {
    isCourseEnrollable: async () => true,
    getCourseStartModuleId: async () => undefined,
    getModulePlace: async () => undefined,
    whichCoursesIncludeModule: async () => [],
    whichModulesAreSame: async () => [],
    getModuleSnapshot,
    getCourseByModuleId: async () => undefined,
    getModule: async () => {
      throw new Error('не вызывается');
    },
  };
  return new ModuleFacade(
    createCourseModule({
      app,
      facades: new ModuleFacades(),
      legacy,
      modules: new ModuleRepoFake(),
    }),
  );
}

const ask = (facade: ReturnType<typeof facadeOver>) =>
  facade.handle(GetModuleSnapshotUcDef, { moduleId: MODULE }, asSystem, REQ);

describe('getModuleSnapshot: адаптер над legacy', () => {
  it('снимок передаётся как есть; спрошен нужный модуль', async () => {
    const asked: string[] = [];
    const facade = facadeOver(async (id) => {
      asked.push(id);
      return snapshot;
    });

    expect(expectOk(await ask(facade))).toEqual(snapshot);
    expect(asked).toEqual([MODULE]);
  });

  it('пустой модуль — пустой снимок', async () => {
    expect(expectOk(await ask(facadeOver(async () => [])))).toEqual([]);
  });

  it('модуль не найден (MODULE_NOT_FOUND legacy) — COURSE_MODULE_NOT_FOUND', async () => {
    const facade = facadeOver(async () => {
      throw new AppException({
        name: 'MODULE_NOT_FOUND',
        level: 'domain',
        kind: 'not-found',
        message: 'Модуль не найден',
        payload: { uuid: MODULE },
      });
    });

    const error = expectErr(await ask(facade), 'COURSE_MODULE_NOT_FOUND');

    expect(error.kind).toBe('not_found');
  });

  it('иной сбой legacy — SERVER_INTERNAL, а не COURSE_MODULE_NOT_FOUND', async () => {
    const facade = facadeOver(async () => {
      throw new Error('диск недоступен');
    });

    expectErr(await ask(facade), 'SERVER_INTERNAL');
  });

  it('модуль курсов обслуживает getModuleSnapshot', () => {
    expect(facadeOver(async () => []).serves(GetModuleSnapshotUcDef)).toBe(
      true,
    );
  });
});
