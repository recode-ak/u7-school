import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import type { Caller } from 'dmg-core';
import { expectErr, expectOk } from 'dmg-core/testing';
import type { QuestionnaireUser } from '../../questionnaire.module';
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
  caller: Caller<QuestionnaireUser> = systemFor(),
  input: unknown = { pool: pool(), ownerInfo: OWNER_INFO },
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
  it('создаёт анкету in_progress за субъекта вызова и публикует started', async () => {
    expect(expectOk(await run())).toEqual({});

    const saved = env.questionnaires.saved[0];
    expect(env.questionnaires.saved).toHaveLength(1);
    expect(saved).toMatchObject({
      kind: 'standard',
      respondentId: RESPONDENT,
      status: 'in_progress',
      currentQuestionCode: 'q1',
      ownerInfo: OWNER_INFO,
      questionPool: pool(),
      createdAt: T0,
      updatedAt: T0,
    });
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

  it.each([
    {
      title: 'поле owner вместо ownerInfo',
      input: { pool: pool(), owner: OWNER_INFO },
    },
    {
      title: 'пустой пул',
      input: { pool: { questions: [] }, ownerInfo: {} },
    },
  ])('$title — INPUT_VALIDATION, анкета не создана', async ({ input }) => {
    expectErr(await run(systemFor(), input), 'INPUT_VALIDATION');
    expect(env.questionnaires.saved).toEqual([]);
    expect(env.ctx.published).toEqual([]);
  });
});
