import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  AbandonUcDef,
  DeclineInviteUcDef,
  GetCurrentUcDef,
  GetQuestionnairesByUserUcDef,
  GetQuestionnaireUcDef,
  HandleActionUcDef,
  SendLikertInviteUcDef,
  StartByInviteUcDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import { type AppContext, ModuleFacades } from 'dmg-core/app';
import {
  expectErr,
  expectOk,
  TempDir,
  testAppContext,
  testTrace,
} from 'dmg-core/testing';
import { QuestionnaireJsonRepo } from './infra/questionnaire.json-repo';
import type { QuestionnaireRepoFake } from './questionnaire/questionnaire.repo.fake';
import {
  likertPool,
  OWNER_INFO,
  pool,
  RESPONDENT,
  respondent,
  systemFor,
} from './questionnaire/uc/questionnaire-uc.fixture';
import { createQuestionnaireModule } from './questionnaire.module';

// Модуль анкет на DMG: заменяет адаптерный тест над legacy-фасадом
// (`QuestionnaireLegacy`, `startStandard`). Smoke каждого UC — на реальном
// репозитории во временном каталоге.

let app: AppContext;
beforeEach(() => {
  app = testAppContext().app;
});

const moduleOn = (repo: QuestionnaireRepoFake | QuestionnaireJsonRepo) =>
  createQuestionnaireModule({
    app,
    facades: new ModuleFacades(),
    questionnaires: repo,
  });

describe('smoke: каждый UC на реальном репозитории (временный каталог)', () => {
  const dir = TempDir.create('questionnaire-module-test-');
  afterAll(() => dir.dispose());

  it('запуск → ответ → завершение → список; likert → отказ; abandon; get*', async () => {
    const repo = new QuestionnaireJsonRepo(dir.file('questionnaires.json'));
    const mod = moduleOn(repo);

    expectOk(
      await mod.dispatch(
        StartQuestionnaireUcDef.command({
          pool: pool(),
          ownerInfo: OWNER_INFO,
        }),
        systemFor(),
        testTrace(),
      ),
    );
    expectOk(
      await mod.dispatch(
        SendLikertInviteUcDef.command({ pool: likertPool(), ownerInfo: {} }),
        systemFor(),
        testTrace(),
      ),
    );

    const list = expectOk(
      await mod.dispatch(
        GetQuestionnairesByUserUcDef.command({ userId: RESPONDENT }),
        respondent,
        testTrace(),
      ),
    );
    expect(list.map((q) => q.kind)).toEqual(['standard', 'likert']);
    const [standard, likert] = list;
    if (!standard || !likert) throw new Error('анкеты не созданы');
    const id = (questionnaireId: string) => ({ questionnaireId });

    const current = expectOk(
      await mod.dispatch(
        GetCurrentUcDef.command(id(standard.uuid)),
        respondent,
        testTrace(),
      ),
    );
    expect(current.type).toBe('new_question');
    expectOk(
      await mod.dispatch(
        HandleActionUcDef.command({
          ...id(standard.uuid),
          type: 'callback',
          value: 'yes',
        }),
        respondent,
        testTrace(),
      ),
    );
    const done = expectOk(
      await mod.dispatch(
        HandleActionUcDef.command({
          ...id(standard.uuid),
          type: 'callback',
          value: 'ok',
        }),
        respondent,
        testTrace(),
      ),
    );
    expect(done.type).toBe('completed');
    expect(
      expectOk(
        await mod.dispatch(
          GetQuestionnaireUcDef.command(id(standard.uuid)),
          respondent,
          testTrace(),
        ),
      ).status,
    ).toBe('completed');

    expect(
      expectOk(
        await mod.dispatch(
          StartByInviteUcDef.command(id(likert.uuid)),
          respondent,
          testTrace(),
        ),
      ).type,
    ).toBe('new_question');
    expectOk(
      await mod.dispatch(
        AbandonUcDef.command(id(likert.uuid)),
        respondent,
        testTrace(),
      ),
    );
    expectErr(
      await mod.dispatch(
        DeclineInviteUcDef.command(id(likert.uuid)),
        respondent,
        testTrace(),
      ),
      'QUESTIONNAIRE_NOT_INVITED',
    );
  });
});
