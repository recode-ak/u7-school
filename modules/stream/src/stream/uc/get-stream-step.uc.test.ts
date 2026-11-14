import { beforeEach, describe, expect, it } from 'bun:test';
import type { StepView } from '@u7-scl/domain/course/contract';
import { GetSnapshotStepsUcDef } from '@u7-scl/domain/course/contract';
import {
  GetStreamStepUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { type Caller, ok } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { StreamUser } from '../../stream.module';
import {
  admin,
  done,
  issued,
  makeEnv,
  mentor,
  owner,
  REQ,
  STEP_1,
  STEP_2,
  STREAM,
  streamOf,
  studentState,
} from '../../student/uc/student-uc.fixture';
import { GetStreamStepUc } from './get-stream-step.uc';

// Ф4а, сценарий 6. Чтение шага из потока по снимку: содержимое берётся через
// курсовой system-UC `getSnapshotSteps` (stub), а не через `getStep` — у
// студента нет права на неопубликованное в курсе. Предполагаемый контракт:
// `GetStreamStepUcDef` ('getStreamStep', `type: 'query'`, `callers: ['user']`),
// вход `{ streamId, stepId }`, выход `StepView`, ошибки `STREAM_NOT_FOUND`,
// `STEP_NOT_FOUND` (шаг вне снимка потока), `ACCESS_DENIED` (не участник).
// Снимок потока — `contentSnapshot` фикстуры: STEP_1, STEP_2.
//
// Замок по прогрессу (решение Нурболата, Ф4а): студент видит содержимое шага,
// только если шаг в его прогрессе `completed` или `issued`; не выданный —
// `ACCESS_DENIED`, курс не спрашивается. Статус записи (учится, ушёл, прошёл,
// не прошёл) на замок не влияет. Ментор потока и админ замка не знают.

const OUTSIDE = '99999999-9999-4999-8999-999999999991';

/** Шаг как его отдаёт курс: draft в курсе, но в снимке потока он есть. */
const courseView = (uuid: string, status: StepView['status']) =>
  ({
    uuid,
    moduleId: '3f2e1d0c-9b8a-4765-8432-10fedcba9876',
    kind: 'text',
    description: `Шаг ${uuid.slice(0, 2)}`,
    content: 'Текст шага',
    status,
    createdAt: 0,
    updatedAt: 0,
    version: 0,
  }) as unknown as StepView;

let env: ReturnType<typeof makeEnv>;
beforeEach(() => {
  env = makeEnv();
  env.seedStreams(streamOf('active'));
  env.seedStudents(studentState('active', { steps: [done(STEP_1)] }));
  env.course.answer(GetSnapshotStepsUcDef, ({ stepIds }) =>
    ok(stepIds.map((id) => courseView(id, 'draft'))),
  );
});

const ask = (
  stepId: string,
  caller: Caller<StreamUser> = owner,
  streamId = STREAM,
) =>
  new GetStreamStepUc(env.deps, StreamModuleDef).handle(
    { streamId, stepId },
    caller,
    REQ,
  );

describe('GetStreamStepUc — доступ', () => {
  it('студент потока видит шаг из снимка, даже если в курсе он draft', async () => {
    const view = expectOk(await ask(STEP_1));

    expect(view.uuid).toBe(STEP_1);
    expect(view.status).toBe('draft');
  });

  it.each([
    ['ментор потока', mentor],
    ['администратор', admin],
  ])('%s видит шаг', async (_, caller) => {
    expect(expectOk(await ask(STEP_2, caller)).uuid).toBe(STEP_2);
  });
});

describe('GetStreamStepUc — замок по прогрессу', () => {
  it('студент: шаг completed в прогрессе — виден', async () => {
    expect(expectOk(await ask(STEP_1)).uuid).toBe(STEP_1);
  });

  it('студент: шаг issued (текущий) — виден', async () => {
    env.seedStudents(
      studentState('active', {
        steps: [done(STEP_1), issued(STEP_2)],
        currentStepId: STEP_2,
      }),
    );

    expect(expectOk(await ask(STEP_2)).uuid).toBe(STEP_2);
  });

  it('студент: шаг не выдан (locked) — ACCESS_DENIED, курс не спрашивается', async () => {
    const error = expectErr(await ask(STEP_2), 'ACCESS_DENIED');

    expect(error.kind).toBe('access');
    expect(env.course.received).toEqual([]);
  });

  it.each(['abandoned', 'advanced', 'not_advanced'] as const)(
    'студент со статусом записи %s: пройденный шаг виден',
    async (status) => {
      env.seedStudents(studentState(status, { steps: [done(STEP_1)] }));

      expect(expectOk(await ask(STEP_1)).uuid).toBe(STEP_1);
    },
  );

  it.each([
    ['ментор потока', mentor],
    ['администратор', admin],
  ])('%s видит не выданный студентам шаг', async (_, caller) => {
    env.seedStudents();

    expect(expectOk(await ask(STEP_2, caller)).uuid).toBe(STEP_2);
  });

  it('шаг вне снимка важнее замка — STEP_NOT_FOUND даже для студента без шагов', async () => {
    env.seedStudents(studentState('active', { steps: [] }));

    expectErr(await ask(OUTSIDE), 'STEP_NOT_FOUND');
  });
});

describe('GetStreamStepUc — снимок и поток', () => {
  it('шаг вне снимка — STEP_NOT_FOUND, курс не спрашивается', async () => {
    const error = expectErr(await ask(OUTSIDE), 'STEP_NOT_FOUND');

    expect(error.kind).toBe('not_found');
    expect(env.course.received).toEqual([]);
  });

  it('потока нет — STREAM_NOT_FOUND { streamId }', async () => {
    const other = '99999999-9999-4999-8999-999999999999';

    const error = expectErr(
      await ask(STEP_1, owner, other),
      'STREAM_NOT_FOUND',
    );

    expect(error.payload).toEqual({ streamId: other });
  });

  it('курс спрашивается ровно по запрошенному шагу', async () => {
    await ask(STEP_1);

    expect(env.course.received).toHaveLength(1);
    expect(env.course.received[0]?.input).toEqual({ stepIds: [STEP_1] });
  });
});

describe('GetStreamStepUcDef', () => {
  it('только для пользователя: system и гость не допущены', () => {
    expect(GetStreamStepUcDef.callers).toEqual(['user']);
    expect(GetStreamStepUcDef.type).toBe('query');
  });
});
