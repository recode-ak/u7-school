import { beforeEach, describe, expect, it } from 'bun:test';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  anonymous,
  author,
  makeContentEnv,
  REQ,
  STEP_1,
  STEP_2,
  STEP_3,
  STEP_4,
  student,
  system,
  textStep,
} from '../../content-uc.fixture';
import { GetSnapshotStepsUc } from './get-snapshot-steps.uc';

// Ф4а, сценарий 5. Курсовой system-UC для модуля `stream`: шаги по списку
// `stepIds` без статусного фильтра — гейт («шаг в снимке потока») держит
// `stream`. Предполагаемый контракт: `GetSnapshotStepsUcDef`
// ('getSnapshotSteps', `callers: ['system']`, `policy: allowAll`),
// вход `{ stepIds: uuid[] }`, выход `StepView[]` в порядке `stepIds`,
// отсутствующие шаги пропускаются, ошибок нет.

let env: ReturnType<typeof makeContentEnv>;
beforeEach(() => {
  env = makeContentEnv();
});

const uc = () => new GetSnapshotStepsUc(env.deps, CourseModuleDef);
const get = (stepIds: string[], caller = system) =>
  uc().handle({ stepIds }, caller, REQ);

describe('GetSnapshotStepsUc', () => {
  it('возвращает шаги всех статусов, в порядке stepIds', async () => {
    env.steps.seed(
      textStep(STEP_1, 'published'),
      textStep(STEP_2, 'draft'),
      textStep(STEP_3, 'archived'),
    );

    const result = expectOk(await get([STEP_3, STEP_1, STEP_2]));

    expect(result.map((s) => s.uuid)).toEqual([STEP_3, STEP_1, STEP_2]);
    expect(result.map((s) => s.status)).toEqual([
      'archived',
      'published',
      'draft',
    ]);
  });

  it('содержимое шага — как у getStep (view)', async () => {
    env.steps.seed(textStep(STEP_1, 'draft', { description: 'Описание' }));

    const [view] = expectOk(await get([STEP_1]));

    expect(view).toMatchObject({
      uuid: STEP_1,
      description: 'Описание',
      content: 'Текст шага',
      status: 'draft',
    });
  });

  it('отсутствующий шаг пропускается, вызов не падает', async () => {
    env.steps.seed(textStep(STEP_1, 'published'));

    const result = expectOk(await get([STEP_4, STEP_1]));

    expect(result.map((s) => s.uuid)).toEqual([STEP_1]);
  });

  it('пустой вход — пустой список, репозиторий не спрашивается', async () => {
    expect(expectOk(await get([]))).toEqual([]);
    expect(env.asked.steps).toEqual([]);
  });

  it('шаги читаются одним запросом, модули не спрашиваются', async () => {
    env.steps.seed(textStep(STEP_1, 'draft'), textStep(STEP_2, 'draft'));

    await get([STEP_1, STEP_2]);

    expect(env.asked.steps).toHaveLength(1);
    expect(env.asked.stepById).toEqual([]);
    expect(env.asked.modules).toEqual([]);
  });

  it.each([
    ['студент', student],
    ['автор модуля', author],
    ['гость', anonymous],
  ])('%s не допущен (callers: system) — UNAUTHORIZED', async (_, caller) => {
    env.steps.seed(textStep(STEP_1, 'draft'));

    const error = expectErr(
      await get([STEP_1], caller as never),
      'UNAUTHORIZED',
    );

    expect(error.payload).toMatchObject({
      callerKind: caller === anonymous ? 'guest' : 'user',
    });
  });
});
