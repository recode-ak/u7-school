import { beforeEach, describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import {
  allowAll,
  BaseEntityFields,
  type Caller,
  defineAggregate,
  defineModule,
  defineUseCase,
  F,
  ok,
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

// Потребитель модуля курсов — UC другого модуля: объявляет
// `getCourseEnrollment` в `calls` и вызывает его через `this.call` (D-43);
// фасад — `ModuleFacade` над модулем курсов.
const ProbeArDef = defineAggregate({
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

const ProbeUcDef = defineUseCase({
  ...probeSpec,
  calls: [GetCourseEnrollmentUcDef],
});
/** Тот же UC, но `getCourseEnrollment` в `calls` не объявлен — вызов не компилируется. */
const SneakyUcDef = defineUseCase({ ...probeSpec, name: 'sneaky' });

const ProbeModuleDef = defineModule({
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
function legacy(enrollable: boolean, startModuleId?: string) {
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
    legacy: courseLegacy,
  });
  return { app, facades: new ModuleFacades([new ModuleFacade(course)]) };
}

function probe(courseLegacy: CourseLegacy) {
  return new ProbeUc(depsWith(courseLegacy), ProbeModuleDef);
}

describe('модуль курсов через фасад (D-43, адаптер TR-11)', () => {
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
        legacy: legacy(true).facade,
      }),
    );
    expect(facade.def).toBe(CourseModuleDef);
    expect(facade.serves(GetCourseEnrollmentUcDef)).toBe(true);
    expect(facade.serves(ProbeUcDef)).toBe(false);
  });
});
