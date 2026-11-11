import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AbandonUcDef,
  DeclineInviteUcDef,
  GetCurrentUcDef,
  GetQuestionnairesByUserUcDef,
  GetQuestionnaireUcDef,
  HandleActionUcDef,
  QuestionnaireModuleDef,
  SendLikertInviteUcDef,
  StartByInviteUcDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import { type AppContext, ModuleFacades, Trace } from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import { QuestionnaireJsonRepo } from './infra/questionnaire.json-repo';
import { QuestionnaireRepoFake } from './questionnaire/questionnaire.repo.fake';
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

describe('smoke: каждый UC на реальном репозитории (mkdtemp)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'questionnaire-module-test-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('запуск → ответ → завершение → список; likert → отказ; abandon; get*', async () => {
    const repo = new QuestionnaireJsonRepo(join(dir, 'questionnaires.json'));
    const mod = moduleOn(repo);
    // Своя команда — свой `requestId`: повтор входа отсеивает D-56.
    const req = () => Trace.fromRequest({ requestId: crypto.randomUUID() });

    expectOk(
      await mod.dispatch(
        StartQuestionnaireUcDef.command({
          pool: pool(),
          ownerInfo: OWNER_INFO,
        }),
        systemFor(),
        req(),
      ),
    );
    expectOk(
      await mod.dispatch(
        SendLikertInviteUcDef.command({ pool: likertPool(), ownerInfo: {} }),
        systemFor(),
        req(),
      ),
    );

    const list = expectOk(
      await mod.dispatch(
        GetQuestionnairesByUserUcDef.command({ userId: RESPONDENT }),
        respondent,
        req(),
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
        req(),
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
        req(),
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
        req(),
      ),
    );
    expect(done.type).toBe('completed');
    expect(
      expectOk(
        await mod.dispatch(
          GetQuestionnaireUcDef.command(id(standard.uuid)),
          respondent,
          req(),
        ),
      ).status,
    ).toBe('completed');

    expect(
      expectOk(
        await mod.dispatch(
          StartByInviteUcDef.command(id(likert.uuid)),
          respondent,
          req(),
        ),
      ).type,
    ).toBe('new_question');
    expectOk(
      await mod.dispatch(
        AbandonUcDef.command(id(likert.uuid)),
        respondent,
        req(),
      ),
    );
    expectErr(
      await mod.dispatch(
        DeclineInviteUcDef.command(id(likert.uuid)),
        respondent,
        req(),
      ),
      'QUESTIONNAIRE_NOT_INVITED',
    );
  });
});
