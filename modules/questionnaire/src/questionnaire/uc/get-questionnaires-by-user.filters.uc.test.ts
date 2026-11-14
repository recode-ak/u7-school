import { beforeEach, describe, expect, it } from 'bun:test';
import { QuestionnaireModuleDef } from '@u7-scl/domain/questionnaire/contract';
import { expectOk } from 'dmg-core/testing';
import { GetQuestionnairesByUserUc } from './get-questionnaires-by-user.uc';
import {
  COURSE,
  makeEnv,
  OTHER_USER,
  REQ,
  RESPONDENT,
  respondent,
  state,
} from './questionnaire-uc.fixture';

// F-43: фильтры status/kind/courseId UC передаёт репозиторию; сама фильтрация —
// в `questionnaire.json-repo.test.ts`.

const A = '00000000-0000-4000-8000-0000000000a1';
const FOREIGN = '00000000-0000-4000-8000-0000000000a5';

let env: ReturnType<typeof makeEnv>;
const run = (filter: object = {}) =>
  new GetQuestionnairesByUserUc(env.deps, QuestionnaireModuleDef).handle(
    { userId: RESPONDENT, ...filter },
    respondent,
    REQ,
  );

beforeEach(() => {
  env = makeEnv();
  env.seed(
    state('in_progress', { uuid: A, ownerInfo: { courseId: COURSE } }),
    state('in_progress', {
      uuid: FOREIGN,
      respondentId: OTHER_USER,
      ownerInfo: { courseId: COURSE },
    }),
  );
});

describe('GetQuestionnairesByUserUc — фильтры', () => {
  it('фильтр { status, kind, courseId } доходит до findByRespondent', async () => {
    const real = env.questionnaires.findByRespondent;
    const asked: unknown[] = [];
    env.questionnaires.findByRespondent = async (userId, filter) => {
      asked.push([userId, filter]);
      return real(userId, filter);
    };
    const filter = {
      status: 'in_progress',
      kind: 'standard',
      courseId: COURSE,
    } as const;

    expectOk(await run(filter));

    expect(asked).toEqual([[RESPONDENT, filter]]);
  });

  it('чужие анкеты не попадают', async () => {
    const list = expectOk(await run({ courseId: COURSE }));

    expect(list.map((q) => q.uuid)).toEqual([A]);
  });
});
