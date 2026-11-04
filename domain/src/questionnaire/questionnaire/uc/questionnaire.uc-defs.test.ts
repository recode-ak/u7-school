import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import { QuestionnaireAr } from '../questionnaire.ar';
import { QuestionnaireEvents } from '../questionnaire.events';
import {
  likertPool,
  OWNER_INFO,
  QUESTIONNAIRE,
  RESPONDENT,
  simplePool,
  stored,
} from '../questionnaire.fixture';
import { QuestionnairePolicy } from '../questionnaire.policy';
import { AbandonUcDef } from './abandon.uc';
import { DeclineInviteUcDef } from './decline-invite.uc';
import { GetCurrentUcDef } from './get-current.uc';
import { GetQuestionnaireUcDef } from './get-questionnaire.uc';
import { GetQuestionnairesByUserUcDef } from './get-questionnaires-by-user.uc';
import { HandleActionUcDef } from './handle-action.uc';
import { SendLikertInviteUcDef } from './send-likert-invite.uc';
import { StartByInviteUcDef } from './start-by-invite.uc';
import { StartQuestionnaireUcDef } from './start-questionnaire.uc';

// Def 9 UC (MAN-11, Р10, Р12): имя, тип, callers, Policy, ошибки, события, вход
// и выход. Перенос `start-questionnaire.uc.test.ts` (вход — `ownerInfo`) и таблицы «Def UC».

const ok = (schema: v.GenericSchema, value: unknown) =>
  v.safeParse(schema, value).success;
const view = QuestionnaireAr.restore(stored('in_progress')).view();
const { rules } = QuestionnairePolicy;
const idInput = { questionnaireId: QUESTIONNAIRE };

describe('StartQuestionnaireUcDef', () => {
  it('command для других модулей: system, hasRespondent, событие started', () => {
    expect(normalize(StartQuestionnaireUcDef)).toMatchObject({
      name: 'startQuestionnaire',
      type: 'command',
      aggregate: 'questionnaire',
      callers: ['system'],
      errors: [],
      emits: ['questionnaire.questionnaire.started'],
    });
    expect(StartQuestionnaireUcDef.policy).toBe(rules.hasRespondent);
    expect(StartQuestionnaireUcDef.emits).toEqual([
      QuestionnaireEvents.started,
    ]);
  });

  it('вход — пул и ownerInfo; пул проверяется схемой; owner не принимается', () => {
    const { input } = StartQuestionnaireUcDef;
    const pool = simplePool();
    expect(v.parse(input, { pool, ownerInfo: OWNER_INFO })).toEqual({
      pool,
      ownerInfo: OWNER_INFO,
    });
    expect(ok(input, { pool: { questions: [] }, ownerInfo: OWNER_INFO })).toBe(
      false,
    );
    expect(ok(input, { pool })).toBe(false);
    expect(ok(input, { pool, owner: OWNER_INFO })).toBe(false);
  });

  it('выход пустой', () => {
    expect(v.parse(StartQuestionnaireUcDef.output, {})).toEqual({});
  });
});

describe('SendLikertInviteUcDef', () => {
  it('command: system, hasRespondent, событие invited', () => {
    expect(normalize(SendLikertInviteUcDef)).toMatchObject({
      name: 'sendLikertInvite',
      type: 'command',
      aggregate: 'questionnaire',
      callers: ['system'],
      errors: [],
      emits: ['questionnaire.questionnaire.invited'],
    });
    expect(SendLikertInviteUcDef.policy).toBe(rules.hasRespondent);
  });

  it('вход — likert-пул и ownerInfo', () => {
    const { input } = SendLikertInviteUcDef;
    const pool = likertPool();
    expect(v.parse(input, { pool, ownerInfo: {} })).toEqual({
      pool,
      ownerInfo: {},
    });
    expect(ok(input, { pool: simplePool(), ownerInfo: {} })).toBe(false);
    expect(ok(input, { pool: { questions: [] }, ownerInfo: {} })).toBe(false);
    expect(ok(input, { pool })).toBe(false);
  });
});

describe('StartByInviteUcDef', () => {
  it('command пользователя: canAccess, NOT_FOUND и NOT_INVITED, события нет (Т5)', () => {
    const def = normalize(StartByInviteUcDef);
    expect(def).toMatchObject({
      name: 'startByInvite',
      type: 'command',
      callers: ['user'],
      emits: [],
    });
    expect(def.errors).toEqual(
      expect.arrayContaining([
        'QUESTIONNAIRE_NOT_FOUND',
        'QUESTIONNAIRE_NOT_INVITED',
      ]),
    );
    expect(StartByInviteUcDef.policy).toBe(rules.canAccess);
  });

  it('вход { questionnaireId }, выход — экран', () => {
    expect(v.parse(StartByInviteUcDef.input, idInput)).toEqual(idInput);
    expect(ok(StartByInviteUcDef.input, { questionnaireId: 'x' })).toBe(false);
    expect(
      ok(StartByInviteUcDef.output, {
        type: 'completed',
        questionnaireId: QUESTIONNAIRE,
      }),
    ).toBe(true);
  });
});

describe('DeclineInviteUcDef', () => {
  it('command пользователя: canAccess, событие abandoned', () => {
    const def = normalize(DeclineInviteUcDef);
    expect(def).toMatchObject({
      name: 'declineInvite',
      type: 'command',
      callers: ['user'],
      emits: ['questionnaire.questionnaire.abandoned'],
    });
    expect(def.errors).toEqual(
      expect.arrayContaining([
        'QUESTIONNAIRE_NOT_FOUND',
        'QUESTIONNAIRE_NOT_INVITED',
      ]),
    );
    expect(DeclineInviteUcDef.policy).toBe(rules.canAccess);
    expect(v.parse(DeclineInviteUcDef.output, {})).toEqual({});
  });
});

describe('HandleActionUcDef', () => {
  it('command пользователя: canAccess, четыре ошибки, событие completed', () => {
    const def = normalize(HandleActionUcDef);
    expect(def).toMatchObject({
      name: 'handleAction',
      type: 'command',
      callers: ['user'],
      emits: ['questionnaire.questionnaire.completed'],
    });
    expect(def.errors).toEqual(
      expect.arrayContaining([
        'QUESTIONNAIRE_NOT_FOUND',
        'QUESTIONNAIRE_NOT_IN_PROGRESS',
        'QUESTIONNAIRE_CHOICE_EXPECTED',
        'QUESTIONNAIRE_EMPTY_ANSWER_CODE',
      ]),
    );
    expect(HandleActionUcDef.policy).toBe(rules.canAccess);
  });

  it('вход { questionnaireId, type: callback | text, value }', () => {
    const { input } = HandleActionUcDef;
    expect(ok(input, { ...idInput, type: 'callback', value: 'yes' })).toBe(
      true,
    );
    expect(ok(input, { ...idInput, type: 'text', value: 'привет' })).toBe(true);
    expect(ok(input, { ...idInput, type: 'photo', value: 'x' })).toBe(false);
    expect(ok(input, { ...idInput, type: 'text' })).toBe(false);
  });
});

describe('AbandonUcDef', () => {
  it('command пользователя: canAccess, NOT_FOUND и NOT_ACTIVE, событие abandoned', () => {
    const def = normalize(AbandonUcDef);
    expect(def).toMatchObject({
      name: 'abandon',
      type: 'command',
      callers: ['user'],
      emits: ['questionnaire.questionnaire.abandoned'],
    });
    expect(def.errors).toEqual(
      expect.arrayContaining([
        'QUESTIONNAIRE_NOT_FOUND',
        'QUESTIONNAIRE_NOT_ACTIVE',
      ]),
    );
    expect(AbandonUcDef.policy).toBe(rules.canAccess);
    expect(v.parse(AbandonUcDef.output, {})).toEqual({});
  });
});

describe('GetQuestionnaireUcDef', () => {
  it('query: canAccess, вход questionnaireId (не uuid, Т11), выход — вид анкеты', () => {
    expect(normalize(GetQuestionnaireUcDef)).toMatchObject({
      name: 'getQuestionnaire',
      type: 'query',
      callers: ['user'],
      emits: [],
    });
    expect(GetQuestionnaireUcDef.policy).toBe(rules.canAccess);
    expect(v.parse(GetQuestionnaireUcDef.input, idInput)).toEqual(idInput);
    expect(ok(GetQuestionnaireUcDef.input, { uuid: QUESTIONNAIRE })).toBe(
      false,
    );
    expect(ok(GetQuestionnaireUcDef.output, view)).toBe(true);
  });
});

describe('GetCurrentUcDef', () => {
  it('query: canAccess, NOT_FOUND, выход — экран', () => {
    const def = normalize(GetCurrentUcDef);
    expect(def).toMatchObject({
      name: 'getCurrent',
      type: 'query',
      callers: ['user'],
    });
    expect(def.errors).toEqual(
      expect.arrayContaining(['QUESTIONNAIRE_NOT_FOUND']),
    );
    expect(GetCurrentUcDef.policy).toBe(rules.canAccess);
    expect(
      ok(
        GetCurrentUcDef.output,
        QuestionnaireAr.restore(stored('in_progress')).screen(),
      ),
    ).toBe(true);
  });
});

describe('GetQuestionnairesByUserUcDef', () => {
  it('query: canListFor, вход { userId }, выход — массив видов, ошибок нет', () => {
    expect(normalize(GetQuestionnairesByUserUcDef)).toMatchObject({
      name: 'getQuestionnairesByUser',
      type: 'query',
      callers: ['user'],
      errors: [],
    });
    expect(GetQuestionnairesByUserUcDef.policy).toBe(rules.canListFor);
    expect(
      v.parse(GetQuestionnairesByUserUcDef.input, { userId: RESPONDENT }),
    ).toEqual({ userId: RESPONDENT });
    expect(ok(GetQuestionnairesByUserUcDef.output, [view, view])).toBe(true);
    expect(ok(GetQuestionnairesByUserUcDef.output, [])).toBe(true);
  });
});
