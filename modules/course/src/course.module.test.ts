import { describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  GetCourseEnrollmentUcDef,
} from '@u7-scl/domain/course/contract';
import {
  AggregateDef,
  allowAll,
  BaseEntityFields,
  type Caller,
  F,
  ModuleDef,
  ok,
  UseCaseDef,
  UserCaller,
} from 'dmg-core';
import {
  type ModuleDeps,
  ModuleFacade,
  ModuleFacades,
  Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import * as v from 'valibot';
import {
  COURSE,
  courseState,
  M1,
  makeCourseEnv,
} from './course/uc/course-uc.fixture';
import { createCourseModule } from './course.module';

// Потребитель модуля курсов — UC другого модуля: объявляет
// `getCourseEnrollment` в `calls` и вызывает его через `this.call` (D-43);
// фасад — `ModuleFacade` над модулем курсов. Сценарии UC — в тестах рядом
// (`course/uc/*.uc.test.ts`), состав модуля — `course.module.serves.test.ts`.
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

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const USER = new UserCaller({ uuid: 'u-1' });

/** Резолвер потребителя: фасад — модуль курсов над стендом UC. */
function probeDeps(env: ReturnType<typeof makeCourseEnv>): ModuleDeps {
  const course = createCourseModule(env.deps);
  return {
    app: env.ctx.app,
    facades: new ModuleFacades([new ModuleFacade(course)]),
  };
}

describe('модуль курсов через фасад потребителя (D-43, calls)', () => {
  it('UC потребителя вызывает getCourseEnrollment и получает стартовый модуль', async () => {
    const env = makeCourseEnv();
    env.seedCourses(courseState('published'));
    const deps = probeDeps(env);

    const res = await new ProbeUc(deps, ProbeModuleDef).handle(
      { courseId: COURSE },
      USER,
      REQ,
    );

    expect(expectOk(res)).toEqual({ enrollable: true, startModuleId: M1 });
  });

  it('UC нет в calls потребителя — ошибка типа (рантайм-проверки нет)', () => {
    const env = makeCourseEnv();
    const deps = probeDeps(env);

    expect(new SneakyUc(deps, ProbeModuleDef).ref.name).toBe('sneaky');
  });

  it('модуль курсов обслуживает свой UC и только его', () => {
    const env = makeCourseEnv();
    const facade = new ModuleFacade(createCourseModule(env.deps));

    expect(facade.def).toBe(CourseModuleDef);
    expect(facade.serves(GetCourseEnrollmentUcDef)).toBe(true);
    expect(facade.serves(ProbeUcDef)).toBe(false);
  });
});
