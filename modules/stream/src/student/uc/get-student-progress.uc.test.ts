import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import { GetStudentProgressUc } from './get-student-progress.uc';
import {
  anonymous,
  done,
  issued,
  makeEnv,
  mentor,
  owner,
  REQ,
  STEP_1,
  STEP_2,
  STUDENT,
  stranger,
  streamOf,
  studentState,
} from './student-uc.fixture';

// Перенос `api/student/get-student-progress-uc.test.ts`: прогресс виден любому
// (allowAll); «Студент не найден» — not_found (Т9). Расчёты UI (С1, вариант a)
// теперь в ответе: `progress { module, projects, card, tree, step?, lesson? }`.

const LESSON = '22222222-2222-4222-8222-222222222222';
let env: ReturnType<typeof makeEnv>;
const ask = (
  extra: { stepId?: string; lessonId?: string } = {},
  caller = owner,
) =>
  new GetStudentProgressUc(env.deps, StreamModuleDef).handle(
    { studentId: STUDENT, ...extra },
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
  env.seedStreams(streamOf('active'));
  env.seedStudents(
    studentState('active', {
      steps: [done(STEP_1), issued(STEP_2)],
      currentStepId: STEP_2,
    }),
  );
});

describe('GetStudentProgressUc', () => {
  it('студент в виде и прогресс по снимку потока (1 из 2 шагов)', async () => {
    const res = expectOk(await ask());

    expect(res.student).toMatchObject({ uuid: STUDENT, status: 'active' });
    expect(res.progress?.module).toEqual({
      completed: 1,
      total: 2,
      percent: 50,
    });
    expect(res.progress?.projects).toEqual({
      completed: 0,
      total: 1,
      percent: 0,
    });
    expect(res.progress?.card.moduleProgress).toEqual({
      completed: 1,
      total: 2,
      percent: 50,
    });
    expect(res.progress?.tree.projects).toHaveLength(1);
  });

  it('step и lesson заполняются только при переданных stepId/lessonId', async () => {
    const bare = expectOk(await ask());
    expect(bare.progress?.step).toBeUndefined();
    expect(bare.progress?.lesson).toBeUndefined();

    const full = expectOk(await ask({ stepId: STEP_1, lessonId: LESSON }));
    expect(full.progress?.step).toBeDefined();
    expect(full.progress?.lesson).toMatchObject({
      lessonTitle: 'Урок 1',
      steps: [
        { stepId: STEP_1, status: 'completed', index: 1 },
        { stepId: STEP_2, status: 'current', index: 2 },
      ],
    });
  });

  it('нет потока — студент есть, progress нет', async () => {
    env.seedStudents(
      studentState('active', {
        streamId: '99999999-9999-4999-8999-999999999999',
      }),
    );
    const res = expectOk(await ask());
    expect(res.student.uuid).toBe(STUDENT);
    expect(res.progress).toBeUndefined();
  });

  it('прогресс виден любому: чужой студент, ментор, гость', async () => {
    for (const caller of [stranger, mentor, anonymous]) {
      expect(expectOk(await ask({}, caller)).student.uuid).toBe(STUDENT);
    }
  });

  it('студента нет — STUDENT_NOT_FOUND (not_found, Т9)', async () => {
    const error = expectErr(
      await new GetStudentProgressUc(env.deps, StreamModuleDef).handle(
        { studentId: '99999999-9999-4999-8999-999999999999' },
        owner,
        REQ,
      ),
      'STUDENT_NOT_FOUND',
    );
    expect(error.kind).toBe('not_found');
    expect(error.label).toBe('Студент не найден');
  });

  it('чтение не пишет и не публикует', async () => {
    expectOk(await ask());
    expect(env.students.saved).toEqual([]);
    expect(env.ctx.published).toEqual([]);
  });
});
