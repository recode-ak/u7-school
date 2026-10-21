import { beforeEach, describe, expect, it } from 'bun:test';
import type { User } from '@u7-scl/app/domain';
import type { QuestionnairePool } from '@u7-scl/domain/questionnaire';
import {
  QuestionnaireModuleDef,
  type QuestionnaireModuleFacade,
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
  requestTrace,
  type Trace,
  UseCaseFromDef,
} from 'dmg-core/app';
import { expectErr, expectOk, testAppContext } from 'dmg-core/testing';
import * as v from 'valibot';
import { questionnaireModuleFacade } from './questionnaire.facade';
import {
  createQuestionnaireModule,
  type QuestionnaireLegacy,
} from './questionnaire.module';

// Потребитель фасада анкет — UC другого модуля: объявляет
// `startQuestionnaire` в `calls` и вызывает его через фасад (D-42).
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
/** Тот же UC, но `startQuestionnaire` в `calls` не объявлен. */
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

type ProbeDeps = {
  readonly app: AppContext;
  readonly questionnaire: QuestionnaireModuleFacade;
};

class ProbeUc extends UseCaseFromDef<
  typeof ProbeUcDef | typeof SneakyUcDef,
  ProbeDeps,
  undefined,
  User
> {
  protected load = async () => ok(undefined);
  protected async execute(
    input: { pool: QuestionnairePool; owner: Record<string, unknown> },
    _: undefined,
    __: unknown,
    caller: Caller<User>,
    trace: Trace,
  ) {
    const call = this.callContext(caller, trace);
    return this.resolve.questionnaire.startQuestionnaire(
      call,
      input.pool,
      input.owner,
    );
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
const REQ = requestTrace({ requestId: 'r-1' });

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

function probe(
  def: typeof ProbeUcDef | typeof SneakyUcDef,
  questionnaireLegacy: QuestionnaireLegacy,
) {
  const questionnaire = questionnaireModuleFacade(
    createQuestionnaireModule({ app, legacy: questionnaireLegacy }),
  );
  return new ProbeUc(def, { app, questionnaire }, ProbeModuleDef);
}

describe('фасад анкет (D-42, адаптер TR-11)', () => {
  it('запуск вызывает legacy startStandard: субъект, пул, owner как ownerInfo', async () => {
    const { facade, calls } = legacy();
    const res = await probe(ProbeUcDef, facade).handle(
      { pool: POOL, owner: OWNER },
      new UserCaller(USER),
      REQ,
    );
    expect(expectOk(res)).toEqual({});
    expect(calls).toEqual([[USER, POOL, OWNER]]);
  });

  it('UC нет в calls потребителя — UNAUTHORIZED, legacy не вызван', async () => {
    const { facade, calls } = legacy();
    const res = await probe(SneakyUcDef, facade).handle(
      { pool: POOL, owner: OWNER },
      new UserCaller(USER),
      REQ,
    );
    expect(expectErr(res, 'UNAUTHORIZED').payload).toEqual({
      callerKind: 'system',
      from: 'sneaky',
    });
    expect(calls).toEqual([]);
  });
});
