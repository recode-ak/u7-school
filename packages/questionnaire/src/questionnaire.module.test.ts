import { beforeEach, describe, expect, it } from 'bun:test';
import type { User } from '@u7-scl/app/domain';
import type { QuestionnairePool } from '@u7-scl/domain/questionnaire';
import {
  QuestionnaireModuleDef,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import {
  allowAll,
  BaseEntityFields,
  type Caller,
  defineAggregate,
  defineModule,
  defineUseCase,
  ok,
  UserCaller,
} from 'dmg-core';
import {
  type AppContext,
  type ModuleDeps,
  ModuleFacade,
  ModuleFacades,
  Trace,
  type UnitOfWork,
  UseCaseFromDef,
} from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import * as v from 'valibot';
import {
  createQuestionnaireModule,
  type QuestionnaireLegacy,
} from './questionnaire.module';

// Потребитель модуля анкет — UC другого модуля: объявляет
// `startQuestionnaire` в `calls` и вызывает его через `this.call` (D-43);
// фасад — `ModuleFacade` над модулем анкет.
const ProbeArDef = defineAggregate({
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

const ProbeUcDef = defineUseCase({
  ...probeSpec,
  calls: [StartQuestionnaireUcDef],
});
/** Тот же UC, но `startQuestionnaire` в `calls` не объявлен — вызов не компилируется. */
const SneakyUcDef = defineUseCase({ ...probeSpec, name: 'sneaky' });

const ProbeModuleDef = defineModule({
  name: 'probe',
  label: 'Проба',
  description: 'Модуль-потребитель фасада анкет.',
  dependsOn: [QuestionnaireModuleDef],
  aggregates: [ProbeArDef],
  useCases: [ProbeUcDef, SneakyUcDef],
  reactions: [],
  jobs: [],
});

type Input = { pool: QuestionnairePool; owner: Record<string, unknown> };

class ProbeUc extends UseCaseFromDef<
  typeof ProbeUcDef,
  ModuleDeps,
  undefined,
  User
> {
  constructor(deps: ModuleDeps, module: typeof ProbeModuleDef) {
    super(ProbeUcDef, deps, module);
  }
  protected load = async () => ok(undefined);
  protected async execute(
    input: Input,
    _: undefined,
    __: UnitOfWork,
    caller: Caller<User>,
    trace: Trace,
  ) {
    return this.call(StartQuestionnaireUcDef, input, caller, trace);
  }
}

class SneakyUc extends UseCaseFromDef<
  typeof SneakyUcDef,
  ModuleDeps,
  undefined,
  User
> {
  constructor(deps: ModuleDeps, module: typeof ProbeModuleDef) {
    super(SneakyUcDef, deps, module);
  }
  protected load = async () => ok(undefined);
  protected async execute(
    input: Input,
    _: undefined,
    __: UnitOfWork,
    caller: Caller<User>,
    trace: Trace,
  ) {
    // @ts-expect-error startQuestionnaire нет в calls UC sneaky
    return this.call(StartQuestionnaireUcDef, input, caller, trace);
  }
}

const POOL: QuestionnairePool = {
  inviteText: 'Приглашение',
  questions: [
    {
      question: 'Q1',
      questionCode: 'q1',
      type: 'choice',
      multiple: false,
      answers: [{ answer: 'A', answerCode: 'a' }],
    },
  ],
};
const OWNER = { kind: 'wish', wishId: 'w-1' };
const USER = {
  uuid: '00000000-0000-0000-0000-000000000001',
  name: 'Test',
  telegramId: 123,
  roles: [],
  createdAt: '2024-01-01T00:00:00.000Z',
} as unknown as User;
const REQ = Trace.fromRequest({ requestId: 'r-1' });

type StartCall = readonly [User, QuestionnairePool, Record<string, unknown>];

/** Legacy-фасад анкет: запоминает аргументы `startStandard`. */
function legacy() {
  const calls: StartCall[] = [];
  const facade: QuestionnaireLegacy = {
    startStandard: async (actor, pool, ownerInfo) => {
      calls.push([actor, pool, ownerInfo]);
    },
  };
  return { facade, calls };
}

let app: AppContext;
beforeEach(() => {
  app = testAppContext().app;
});

/** Резолвер потребителя: фасад — модуль анкет над заданным legacy. */
function depsWith(questionnaireLegacy: QuestionnaireLegacy): ModuleDeps {
  const questionnaire = createQuestionnaireModule({
    app,
    facades: new ModuleFacades(),
    legacy: questionnaireLegacy,
  });
  return {
    app,
    facades: new ModuleFacades([new ModuleFacade(questionnaire)]),
  };
}

describe('модуль анкет через фасад (D-43, адаптер TR-11)', () => {
  it('запуск вызывает legacy startStandard: субъект, пул, owner как ownerInfo', async () => {
    const { facade, calls } = legacy();
    const res = await new ProbeUc(depsWith(facade), ProbeModuleDef).handle(
      { pool: POOL, owner: OWNER },
      new UserCaller(USER),
      REQ,
    );
    expect(expectOk(res)).toEqual({});
    expect(calls).toEqual([[USER, POOL, OWNER]]);
  });

  it('UC нет в calls потребителя — ошибка типа (рантайм-проверки нет)', () => {
    const { facade } = legacy();
    expect(new SneakyUc(depsWith(facade), ProbeModuleDef).ref.name).toBe(
      'sneaky',
    );
  });
});
