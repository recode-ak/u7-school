import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  M1,
  M2,
  M3,
  makeCourseEnv,
  REQ,
  student,
  system,
} from './course-uc.fixture';
import { GetSameModulesUc } from './get-same-modules.uc';

// Перенос из `course.module.test.ts` («getSameModules») и legacy
// `whichModulesAreSame` (`course-in-proc-facade.ts:94-100`): сегодня — равенство
// id, повторы сохраняются (D-65); репозитории не читаются. Только `system`.

let env: ReturnType<typeof makeCourseEnv>;
beforeEach(() => {
  env = makeCourseEnv();
});

const uc = () => new GetSameModulesUc(env.deps, CourseModuleDef);
const same = (moduleIds: string[], moduleId = M1) =>
  uc().handle({ moduleId, moduleIds }, system, REQ);

describe('GetSameModulesUc', () => {
  it('возвращает кандидатов, равных модулю', async () => {
    expect(expectOk(await same([M1, M2]))).toEqual({ moduleIds: [M1] });
  });

  it('повторы сохраняются', async () => {
    expect(expectOk(await same([M1, M2, M1]))).toEqual({
      moduleIds: [M1, M1],
    });
  });

  it('среди кандидатов нет модуля — пусто', async () => {
    expect(expectOk(await same([M2, M3]))).toEqual({ moduleIds: [] });
  });

  it('пустой список кандидатов — пустой ответ', async () => {
    expect(expectOk(await same([]))).toEqual({ moduleIds: [] });
  });

  it('репозитории не читаются', async () => {
    await same([M1, M2]);
    expect(env.asked.filters).toEqual([]);
    expect(env.asked.byIds).toEqual([]);
    expect(env.asked.byId).toEqual([]);
  });

  it('вызывающий user не допущен (callers: system) — UNAUTHORIZED', async () => {
    const res = await uc().handle(
      { moduleId: M1, moduleIds: [] },
      student as never,
      REQ,
    );

    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'user',
    });
  });

  it('moduleIds с не-uuid — INPUT_VALIDATION', async () => {
    expectErr(await same(['not-a-uuid']), 'INPUT_VALIDATION');
  });
});
