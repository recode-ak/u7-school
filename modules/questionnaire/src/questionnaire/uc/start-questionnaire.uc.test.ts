import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { expectErr, expectOk } from 'dmg-core/testing';
import {
  makeEnv,
  OWNER_INFO,
  pool,
  REQ,
  RESPONDENT,
  systemAlone,
  systemFor,
  T0,
} from './questionnaire-uc.fixture';
import { StartQuestionnaireUc } from './start-questionnaire.uc';

// Перенос `api/module.test.ts` (start) и `start-questionnaire.uc` (адаптер): настоящий UC.
// Респондент — субъект вызова; событие started — из UoW агрегата, без `telegramId`.

let env: ReturnType<typeof makeEnv>;
const run = (
  caller = systemFor(),
  input = { pool: pool(), ownerInfo: OWNER_INFO },
) =>
  new StartQuestionnaireUc(env.deps, QuestionnaireModuleDef).handle(
    input,
    caller,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
});

describe('StartQuestionnaireUc', () => {
  it('создаёт анкету in_progress за субъекта вызова с пулом и ownerInfo', async () => {
    expect(expectOk(await run())).toEqual({});

    expect(env.questionnaires.saved).toHaveLength(1);
    expect(env.questionnaires.saved[0]).toMatchObject({
      kind: 'standard',
      respondentId: RESPONDENT,
      status: 'in_progress',
      currentQuestionCode: 'q1',
      ownerInfo: OWNER_INFO,
      questionPool: pool(),
      createdAt: T0,
      updatedAt: T0,
    });
  });

  it('публикует started { questionnaireId, respondentId, kind, ownerInfo } без telegramId и response', async () => {
    await run();
    const saved = env.questionnaires.saved[0];

    expect(env.events()).toEqual([
      [
        'questionnaire.questionnaire.started',
        {
          questionnaireId: saved?.uuid,
          respondentId: RESPONDENT,
          kind: 'standard',
          ownerInfo: OWNER_INFO,
        },
      ],
    ]);
  });

  it('системный вызов без человека — ACCESS_DENIED, ничего не записано и не опубликовано', async () => {
    expectErr(await run(systemAlone), 'ACCESS_DENIED');
    expect(env.questionnaires.saved).toEqual([]);
    expect(env.ctx.published).toEqual([]);
  });

  it('пул без вопросов отклоняется схемой входа', async () => {
    const res = await run(systemFor(), {
      pool: { questions: [] },
      ownerInfo: {},
    });
    expect(res.ok).toBe(false);
    expect(env.questionnaires.saved).toEqual([]);
  });
});
