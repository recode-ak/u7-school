import { beforeEach, describe, expect, it } from 'bun:test';
import {
  CourseModuleDef,
  type CourseModuleFacade,
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
  requestTrace,
  type Trace,
  UseCaseFromDef,
} from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import * as v from 'valibot';
import { courseModuleFacade } from './course.facade';
import { type CourseLegacy, createCourseModule } from './course.module';

// Потребитель фасада курсов — UC другого модуля: объявляет
// `getCourseEnrollment` в `calls` и вызывает его через фасад (D-42).
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
/** Тот же UC, но `getCourseEnrollment` в `calls` не объявлен. */
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

type ProbeDeps = {
  readonly app: AppContext;
  readonly course: CourseModuleFacade;
};

class ProbeUc extends UseCaseFromDef<
  typeof ProbeUcDef | typeof SneakyUcDef,
  ProbeDeps,
  undefined
> {
  protected load = async () => ok(undefined);
  protected async execute(
    input: { courseId: string },
    _: undefined,
    __: unknown,
    caller: Caller,
    trace: Trace,
  ) {
    const call = this.callContext(caller, trace);
    return this.resolve.course.getCourseEnrollment(call, input.courseId);
  }
}

const COURSE = '0b6c2f4e-3d1a-4c5b-9e8f-7a6b5c4d3e2f';
const START = '1c7d3a5f-4e2b-4d6c-8f9a-8b7c6d5e4f3a';
const REQ = requestTrace({ requestId: 'r-1' });
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

function probe(
  def: typeof ProbeUcDef | typeof SneakyUcDef,
  courseLegacy: CourseLegacy,
) {
  const course = courseModuleFacade(
    createCourseModule({ app, legacy: courseLegacy }),
  );
  return new ProbeUc(def, { app, course }, ProbeModuleDef);
}

describe('фасад курсов (D-42, адаптер TR-11)', () => {
  it('курс доступен и есть стартовый модуль — enrollable с модулем', async () => {
    const { facade, asked } = legacy(true, START);
    const res = await probe(ProbeUcDef, facade).handle(
      { courseId: COURSE },
      USER,
      REQ,
    );
    expect(expectOk(res)).toEqual({ enrollable: true, startModuleId: START });
    expect(asked).toEqual([COURSE, COURSE]);
  });

  it('курс недоступен для записи — enrollable: false', async () => {
    const { facade } = legacy(false, START);
    const res = await probe(ProbeUcDef, facade).handle(
      { courseId: COURSE },
      USER,
      REQ,
    );
    expect(expectOk(res)).toEqual({ enrollable: false });
  });

  it('курс доступен, но программа пуста — enrollable: false', async () => {
    const { facade } = legacy(true, undefined);
    const res = await probe(ProbeUcDef, facade).handle(
      { courseId: COURSE },
      USER,
      REQ,
    );
    expect(expectOk(res)).toEqual({ enrollable: false });
  });

  it('UC нет в calls потребителя — UNAUTHORIZED, legacy не вызван', async () => {
    const { facade, asked } = legacy(true, START);
    const res = await probe(SneakyUcDef, facade).handle(
      { courseId: COURSE },
      USER,
      REQ,
    );
    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
      from: 'sneaky',
    });
    expect(asked).toEqual([]);
  });
});
