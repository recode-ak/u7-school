import { beforeEach, describe, expect, it } from 'bun:test';
import type { ModulePlace } from '@u7-scl/domain/course';
import {
  CourseModuleDef,
  GetCourseEnrollmentUcDef,
  GetCoursesIncludingModuleUcDef,
  GetCoursesStartingWithModuleUcDef,
  GetModuleEnrollmentUcDef,
  GetModuleUcDef,
  GetSameModulesUcDef,
  ListModulesUcDef,
} from '@u7-scl/domain/course/contract';
import {
  AggregateDef,
  allowAll,
  BaseEntityFields,
  type Caller,
  F,
  ModuleDef,
  ok,
  SystemCaller,
  UseCaseDef,
  UserCaller,
} from 'dmg-core';
import {
  type AppContext,
  type ModuleDeps,
  ModuleFacade,
  ModuleFacades,
  Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import * as v from 'valibot';
import { type CourseLegacy, createCourseModule } from './course.module';
import { ModuleRepoFake } from './module/module.repo.fake';

// Потребитель модуля курсов — UC другого модуля: объявляет
// `getCourseEnrollment` в `calls` и вызывает его через `this.call` (D-43);
// фасад — `ModuleFacade` над модулем курсов.
const ProbeArDef = AggregateDef.define({
  name: 'probe',
  label: 'Проба',
  description: 'Агрегат модуля-потребителя фасада курсов.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: {},
});

const probeSpec = {
  name: 'probeEnrollment',
  label: 'Проба записи',
  description: 'Спрашивает у модуля курсов, с чего начинается запись.',
  type: 'query',
  aggregate: ProbeArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({ courseId: F.uuid('курса') }),
  output: GetCourseEnrollmentUcDef.output,
  errors: [],
} as const;

const ProbeUcDef = UseCaseDef.define({
  ...probeSpec,
  calls: [GetCourseEnrollmentUcDef],
});
/** Тот же UC, но `getCourseEnrollment` в `calls` не объявлен — вызов не компилируется. */
const SneakyUcDef = UseCaseDef.define({ ...probeSpec, name: 'sneaky' });

const ProbeModuleDef = ModuleDef.define({
  name: 'probe',
  label: 'Проба',
  description: 'Модуль-потребитель фасада курсов.',
  dependsOn: [CourseModuleDef],
  aggregates: [ProbeArDef],
  useCases: [ProbeUcDef, SneakyUcDef],
  reactions: [],
  jobs: [],
});

class ProbeUc extends UseCaseFromDef<typeof ProbeUcDef, ModuleDeps, undefined> {
  constructor(deps: ModuleDeps, module: typeof ProbeModuleDef) {
    super(ProbeUcDef, deps, module);
  }
  protected async load() {
    return ok(undefined);
  }
  protected async execute(
    input: { courseId: string },
    _: undefined,
    __: UnitOfWork,
    caller: Caller,
    trace: Trace,
  ) {
    return this.call(GetCourseEnrollmentUcDef, input, caller, trace);
  }
}

class SneakyUc extends UseCaseFromDef<
  typeof SneakyUcDef,
  ModuleDeps,
  undefined
> {
  constructor(deps: ModuleDeps, module: typeof ProbeModuleDef) {
    super(SneakyUcDef, deps, module);
  }
  protected async load() {
    return ok(undefined);
  }
  protected async execute(
    input: { courseId: string },
    _: undefined,
    __: UnitOfWork,
    caller: Caller,
    trace: Trace,
  ) {
    // @ts-expect-error getCourseEnrollment нет в calls UC sneaky
    return this.call(GetCourseEnrollmentUcDef, input, caller, trace);
  }
}

const COURSE = '0b6c2f4e-3d1a-4c5b-9e8f-7a6b5c4d3e2f';
const START = '1c7d3a5f-4e2b-4d6c-8f9a-8b7c6d5e4f3a';
const REQ = Trace.fromRequest({ requestId: 'r-1' });
const USER = new UserCaller({ uuid: 'u-1' });

/** Legacy-фасад курсов с заданными ответами; запоминает спрошенные курсы. */
function legacy(
  enrollable: boolean,
  startModuleId?: string,
  place?: ModulePlace,
) {
  const asked: string[] = [];
  const facade: CourseLegacy = {
    isCourseEnrollable: async (courseId) => {
      asked.push(courseId);
      return enrollable;
    },
    getCourseStartModuleId: async (courseId) => {
      asked.push(courseId);
      return startModuleId;
    },
    getModulePlace: async (moduleId) => {
      asked.push(moduleId);
      return place;
    },
    whichCoursesIncludeModule: async () => [],
    whichModulesAreSame: async () => [],
    getModuleSnapshot: async () => [],
    getCourseByModuleId: async () => undefined,
    getModule: async () => {
      throw new Error('не вызывается');
    },
  };
  return { facade, asked };
}

let app: AppContext;
beforeEach(() => {
  app = testAppContext().app;
});

/** Резолвер потребителя: фасад — модуль курсов над заданным legacy. */
function depsWith(courseLegacy: CourseLegacy): ModuleDeps {
  const course = createCourseModule({
    app,
    facades: new ModuleFacades(),
    modules: new ModuleRepoFake(),
    legacy: courseLegacy,
  });
  return { app, facades: new ModuleFacades([new ModuleFacade(course)]) };
}

function probe(courseLegacy: CourseLegacy) {
  return new ProbeUc(depsWith(courseLegacy), ProbeModuleDef);
}

describe('модуль курсов через фасад (D-43, адаптер над legacy-фасадом)', () => {
  it('курс доступен и есть стартовый модуль — enrollable с модулем', async () => {
    const { facade, asked } = legacy(true, START);
    const res = await probe(facade).handle({ courseId: COURSE }, USER, REQ);
    expect(expectOk(res)).toEqual({ enrollable: true, startModuleId: START });
    expect(asked).toEqual([COURSE, COURSE]);
  });

  it('курс недоступен для записи — enrollable: false', async () => {
    const { facade } = legacy(false, START);
    const res = await probe(facade).handle({ courseId: COURSE }, USER, REQ);
    expect(expectOk(res)).toEqual({ enrollable: false });
  });

  it('курс доступен, но программа пуста — enrollable: false', async () => {
    const { facade } = legacy(true, undefined);
    const res = await probe(facade).handle({ courseId: COURSE }, USER, REQ);
    expect(expectOk(res)).toEqual({ enrollable: false });
  });

  it('UC нет в calls потребителя — ошибка типа (рантайм-проверки нет)', () => {
    const { facade } = legacy(true, START);
    expect(new SneakyUc(depsWith(facade), ProbeModuleDef).ref.name).toBe(
      'sneaky',
    );
  });

  it('модуль курсов обслуживает свой UC и только его', () => {
    const facade = new ModuleFacade(
      createCourseModule({
        app,
        facades: new ModuleFacades(),
        modules: new ModuleRepoFake(),
        legacy: legacy(true).facade,
      }),
    );
    expect(facade.def).toBe(CourseModuleDef);
    expect(facade.serves(GetCourseEnrollmentUcDef)).toBe(true);
    expect(facade.serves(ProbeUcDef)).toBe(false);
  });

  it('модуль обслуживает и getModuleEnrollment', () => {
    const facade = new ModuleFacade(
      createCourseModule({
        app,
        facades: new ModuleFacades(),
        modules: new ModuleRepoFake(),
        legacy: legacy(true).facade,
      }),
    );
    expect(facade.serves(GetModuleEnrollmentUcDef)).toBe(true);
  });

  it('модуль обслуживает getModule и listModules (срез module)', () => {
    const facade = new ModuleFacade(
      createCourseModule({
        app,
        facades: new ModuleFacades(),
        modules: new ModuleRepoFake(),
        legacy: legacy(true).facade,
      }),
    );
    expect(facade.serves(GetModuleUcDef)).toBe(true);
    expect(facade.serves(ListModulesUcDef)).toBe(true);
  });
});

describe('getModuleEnrollment: адаптер над getModulePlace', () => {
  const MODULE = '2d8e4b6a-5f3c-4e7d-9a0b-9c8d7e6f5a4b';
  const PLACE: ModulePlace = {
    courseId: COURSE,
    isFirst: true,
    isLast: true,
  };

  function uc(courseLegacy: CourseLegacy) {
    const course = createCourseModule({
      app,
      facades: new ModuleFacades(),
      modules: new ModuleRepoFake(),
      legacy: courseLegacy,
    });
    return new ModuleFacade(course);
  }

  it('у модуля есть место в программе — enrollable: true', async () => {
    const { facade, asked } = legacy(true, START, PLACE);
    const res = await uc(facade).handle(
      GetModuleEnrollmentUcDef,
      { moduleId: MODULE },
      new SystemCaller(probe(facade).ref, USER),
      REQ,
    );
    expect(expectOk(res)).toEqual({ enrollable: true });
    expect(asked).toEqual([MODULE]);
  });

  it('места нет — enrollable: false', async () => {
    const { facade } = legacy(true, START, undefined);
    const res = await uc(facade).handle(
      GetModuleEnrollmentUcDef,
      { moduleId: MODULE },
      new SystemCaller(probe(facade).ref, USER),
      REQ,
    );
    expect(expectOk(res)).toEqual({ enrollable: false });
  });
});

describe('батч-вопросы о зачислении: ответ legacy как есть', () => {
  const MODULE = '2d8e4b6a-5f3c-4e7d-9a0b-9c8d7e6f5a4b';
  const OTHER = '3e9f5c7b-6a4d-4f8e-8b1c-0d9e8f7a6b5c';
  const FORK = '4fa06d8c-7b5e-4a9f-9c2d-1e0f9a8b7c6d';
  const asSystem = () =>
    new SystemCaller({ kind: 'useCase', module: 'probe', name: 'probe' });

  /** Модуль курсов над legacy с заданными батч-ответами; запоминает вопросы. */
  function course(courseIds: string[], moduleIds: string[]) {
    const asked: unknown[] = [];
    const base = legacy(true).facade;
    const facade = new ModuleFacade(
      createCourseModule({
        app,
        facades: new ModuleFacades(),
        modules: new ModuleRepoFake(),
        legacy: {
          ...base,
          whichCoursesIncludeModule: async (moduleId, ids) => {
            asked.push([moduleId, ids]);
            return courseIds;
          },
          whichModulesAreSame: async (moduleId, ids) => {
            asked.push([moduleId, ids]);
            return moduleIds;
          },
        },
      }),
    );
    return { facade, asked };
  }

  it('getCoursesIncludingModule — один вызов whichCoursesIncludeModule', async () => {
    const { facade, asked } = course([FORK], []);
    const res = await facade.handle(
      GetCoursesIncludingModuleUcDef,
      { moduleId: MODULE, courseIds: [COURSE, FORK] },
      asSystem(),
      REQ,
    );
    expect(expectOk(res)).toEqual({ courseIds: [FORK] });
    expect(asked).toEqual([[MODULE, [COURSE, FORK]]]);
  });

  it('getSameModules — один вызов whichModulesAreSame', async () => {
    const { facade, asked } = course([], [MODULE]);
    const res = await facade.handle(
      GetSameModulesUcDef,
      { moduleId: MODULE, moduleIds: [MODULE, OTHER] },
      asSystem(),
      REQ,
    );
    expect(expectOk(res)).toEqual({ moduleIds: [MODULE] });
    expect(asked).toEqual([[MODULE, [MODULE, OTHER]]]);
  });
});

describe('getCoursesStartingWithModule: адаптер над getModulePlace + whichCoursesIncludeModule', () => {
  const MODULE = '2d8e4b6a-5f3c-4e7d-9a0b-9c8d7e6f5a4b';
  const FORK = '4fa06d8c-7b5e-4a9f-9c2d-1e0f9a8b7c6d';
  const asSystem = () =>
    new SystemCaller({ kind: 'useCase', module: 'probe', name: 'probe' });

  /** Модуль курсов над legacy: место модуля и курсы, включающие его. */
  function course(place: ModulePlace | undefined, included: string[]) {
    const asked: unknown[] = [];
    const base = legacy(true).facade;
    const facade = new ModuleFacade(
      createCourseModule({
        app,
        facades: new ModuleFacades(),
        modules: new ModuleRepoFake(),
        legacy: {
          ...base,
          getModulePlace: async (moduleId) => {
            asked.push(['place', moduleId]);
            return place;
          },
          whichCoursesIncludeModule: async (moduleId, ids) => {
            asked.push(['include', moduleId, ids]);
            return included;
          },
        },
      }),
    );
    return { facade, asked };
  }
  const ask = (facade: ModuleFacade<typeof CourseModuleDef>) =>
    facade.handle(
      GetCoursesStartingWithModuleUcDef,
      { moduleId: MODULE, courseIds: [COURSE, FORK] },
      asSystem(),
      REQ,
    );

  it('модуль стартовый — ответ whichCoursesIncludeModule как есть', async () => {
    const { facade, asked } = course(
      { courseId: COURSE, isFirst: true, isLast: false },
      [COURSE, FORK],
    );
    expect(expectOk(await ask(facade))).toEqual({ courseIds: [COURSE, FORK] });
    expect(asked).toEqual([
      ['place', MODULE],
      ['include', MODULE, [COURSE, FORK]],
    ]);
  });

  it('модуль не первый — пусто, курсы не спрашиваются', async () => {
    const { facade, asked } = course(
      { courseId: COURSE, isFirst: false, isLast: true },
      [COURSE],
    );
    expect(expectOk(await ask(facade))).toEqual({ courseIds: [] });
    expect(asked).toEqual([['place', MODULE]]);
  });

  it('модуль вне опубликованных программ — пусто', async () => {
    const { facade, asked } = course(undefined, [COURSE]);
    expect(expectOk(await ask(facade))).toEqual({ courseIds: [] });
    expect(asked).toEqual([['place', MODULE]]);
  });
});
