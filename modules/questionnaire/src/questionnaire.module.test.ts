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
import {
  AggregateDef,
  allowAll,
  BaseEntityFields,
  type Caller,
  ModuleDef,
  ok,
  UseCaseDef,
} from 'dmg-core';
import {
  type AppContext,
  type ModuleDeps,
  ModuleFacade,
  ModuleFacades,
  type ParsedInputOf,
  Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import * as v from 'valibot';
import { QuestionnaireJsonRepo } from './infra/questionnaire.json-repo';
import { QuestionnaireRepoFake } from './questionnaire/questionnaire.repo.fake';
import {
  likertPool,
  OWNER_INFO,
  pool,
  REQ,
  RESPONDENT,
  respondent,
  systemFor,
} from './questionnaire/uc/questionnaire-uc.fixture';
import {
  createQuestionnaireModule,
  type QuestionnaireUser,
} from './questionnaire.module';

// Модуль анкет на DMG: заменяет адаптерный тест над legacy-фасадом
// (`QuestionnaireLegacy`, `startStandard`). Потребитель вызывает
// `startQuestionnaire` через фасад (D-43); smoke каждого UC — на реальном
// репозитории во временном каталоге.

const ProbeArDef = AggregateDef.define({
  name: 'probe',
  label: 'Проба',
  description: 'Агрегат модуля-потребителя фасада анкет.',
  state: v.object({ ...BaseEntityFields }),
  events: {},
  errors: {},
});
const probeSpec = {
  name: 'probeQuestionnaire',
  label: 'Проба анкеты',
  description: 'Запускает анкету через фасад модуля анкет.',
  type: 'command',
  aggregate: ProbeArDef,
  callers: ['user'],
  policy: allowAll,
  input: StartQuestionnaireUcDef.input,
  output: v.object({}),
  errors: [],
} as const;
const ProbeUcDef = UseCaseDef.define({
  ...probeSpec,
  calls: [StartQuestionnaireUcDef],
});
const ProbeModuleDef = ModuleDef.define({
  name: 'probe',
  label: 'Проба',
  description: 'Модуль-потребитель фасада анкет.',
  dependsOn: [QuestionnaireModuleDef],
  aggregates: [ProbeArDef],
  useCases: [ProbeUcDef],
  reactions: [],
  jobs: [],
});

class ProbeUc extends UseCaseFromDef<
  typeof ProbeUcDef,
  ModuleDeps,
  undefined,
  QuestionnaireUser
> {
  constructor(deps: ModuleDeps, module: typeof ProbeModuleDef) {
    super(ProbeUcDef, deps, module);
  }
  protected async load() {
    return ok(undefined);
  }
  protected async execute(
    input: ParsedInputOf<typeof ProbeUcDef>,
    _: undefined,
    __: UnitOfWork,
    caller: Caller<QuestionnaireUser>,
    trace: Trace,
  ) {
    return this.call(StartQuestionnaireUcDef, input, caller, trace);
  }
}

let app: AppContext;
let questionnaires: QuestionnaireRepoFake;
beforeEach(() => {
  app = testAppContext().app;
  questionnaires = new QuestionnaireRepoFake();
});

const moduleOn = (repo: QuestionnaireRepoFake | QuestionnaireJsonRepo) =>
  createQuestionnaireModule({
    app,
    facades: new ModuleFacades(),
    questionnaires: repo,
  });

describe('модуль анкет через фасад потребителя (D-43)', () => {
  const probe = () =>
    new ProbeUc(
      {
        app,
        facades: new ModuleFacades([
          new ModuleFacade(moduleOn(questionnaires)),
        ]),
      },
      ProbeModuleDef,
    );

  it('запуск через фасад создаёт анкету за субъекта, ownerInfo сохранён', async () => {
    const res = await probe().handle(
      { pool: pool(), ownerInfo: OWNER_INFO },
      respondent,
      REQ,
    );
    expect(expectOk(res)).toEqual({});
    expect(questionnaires.saved).toHaveLength(1);
    expect(questionnaires.saved[0]).toMatchObject({
      respondentId: RESPONDENT,
      kind: 'standard',
      status: 'in_progress',
      ownerInfo: OWNER_INFO,
    });
  });
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
