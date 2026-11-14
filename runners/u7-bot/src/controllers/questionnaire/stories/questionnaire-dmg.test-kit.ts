import { afterEach, beforeEach, mock } from 'bun:test';
import {
  type Logger,
  LogLevel,
  type MdText,
  setGlobalLogger,
} from '@u7-scl/core/shared';
import type { DialogResponse, UiEventSubscription } from '@u7-scl/core/ui';
import {
  type QuestionnaireActionResponse,
  QuestionnaireEvents,
  QuestionnaireModuleDef,
} from '@u7-scl/domain/questionnaire/contract';
import {
  UserErrors,
  UserModuleDef,
  type UserView,
} from '@u7-scl/domain/user/contract';
import type { AnyEventDef, EventOf } from 'dmg-core';
import { envelopeOf } from '../../../../tests/helpers/envelope-of';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import {
  dmgDispatch as baseDmgDispatch,
  refuse,
  type UcAnswers,
} from '../../streams/stories/stream-dmg.test-kit';

export { Refusal, refuse } from '../../streams/stories/stream-dmg.test-kit';
export { testCallers };

/**
 * Мок `appApi.dispatch`: модуль анкет и `user` (профиль респондента —
 * `getUser`); любой другой модуль — ошибка теста.
 */
export const dmgDispatch = (answers: UcAnswers) =>
  baseDmgDispatch(answers, [QuestionnaireModuleDef, UserModuleDef]);

// ══ Данные ══

export const QUESTIONNAIRE_ID = 'q-1';
export const RESPONDENT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
export const RESPONDENT_TG = 456;
export const COURSE_ID = 'course-1';

/** Профиль респондента — ответ `getUser` (`UserView`, даты — числа). */
export const respondentProfile = (
  overrides: Partial<UserView> = {},
): UserView => ({
  uuid: RESPONDENT_ID,
  name: 'Респондент',
  telegramId: RESPONDENT_TG,
  roles: ['GUEST'],
  createdAt: 1,
  updatedAt: 1,
  version: 0,
  ...overrides,
});

// ══ Ответы UC (view-билдеры) ══

type InvitedView = Extract<QuestionnaireActionResponse, { type: 'invited' }>;

/** Ответ `getCurrent` в статусе invited. */
export const invitedView = (
  overrides: Partial<InvitedView> = {},
): InvitedView => ({
  type: 'invited',
  questionnaireId: QUESTIONNAIRE_ID,
  ...overrides,
});

/** Ответ `getCurrent`/`handleAction`: текстовый вопрос. */
export const newQuestionView = (
  overrides: Record<string, unknown> = {},
): QuestionnaireActionResponse =>
  ({
    type: 'new_question',
    questionnaireId: QUESTIONNAIRE_ID,
    question: {
      questionCode: 'qc2',
      type: 'text',
      question: 'Расскажи о себе',
    },
    questionIndex: 1,
    poolSize: 2,
    ...overrides,
  }) as QuestionnaireActionResponse;

/** Ответ `handleAction`: анкета завершена. */
export const completedView = (
  overrides: Record<string, unknown> = {},
): QuestionnaireActionResponse =>
  ({
    type: 'completed',
    questionnaireId: QUESTIONNAIRE_ID,
    ...overrides,
  }) as QuestionnaireActionResponse;

// ══ События ══

/** Payload события анкеты по схеме его Def. */
type PayloadOf<D extends AnyEventDef> = EventOf<D>['payload'];

/** Конверт DMG события анкеты: payload — по схеме Def, `aggregateId` — анкета. */
const baseEvent = <D extends AnyEventDef>(def: D, payload: PayloadOf<D>) =>
  envelopeOf(def, payload, { aggregateId: QUESTIONNAIRE_ID });

/** Общие поля события анкеты (payload по схеме Def). */
const questionnairePayload = (kind: 'standard' | 'likert' = 'standard') => ({
  questionnaireId: QUESTIONNAIRE_ID,
  respondentId: RESPONDENT_ID,
  kind,
  ownerInfo: { courseId: COURSE_ID },
});

/** `started` (payload по схеме Def, без `telegramId`/`response`). */
export const startedEvent = (
  overrides: Partial<PayloadOf<typeof QuestionnaireEvents.started>> = {},
) =>
  baseEvent(QuestionnaireEvents.started, {
    ...questionnairePayload(),
    ...overrides,
  });

/** `invited` (likert-приглашение). */
export const invitedEvent = (
  overrides: Partial<PayloadOf<typeof QuestionnaireEvents.invited>> = {},
) =>
  baseEvent(QuestionnaireEvents.invited, {
    ...questionnairePayload('likert'),
    ownerInfo: {},
    ...overrides,
  });

/** `abandonWarning` (ступень 6 ч). */
export const abandonWarningEvent = (
  overrides: Partial<PayloadOf<typeof QuestionnaireEvents.abandonWarning>> = {},
) =>
  baseEvent(QuestionnaireEvents.abandonWarning, {
    ...questionnairePayload(),
    ...overrides,
  });

/** `continueInvite` (ступень 3 ч). */
export const continueInviteEvent = (
  overrides: Partial<PayloadOf<typeof QuestionnaireEvents.continueInvite>> = {},
) =>
  baseEvent(QuestionnaireEvents.continueInvite, {
    ...questionnairePayload(),
    ...overrides,
  });

/** `abandoned` (по умолчанию `timeout`). */
export const abandonedEvent = (
  overrides: Partial<PayloadOf<typeof QuestionnaireEvents.abandoned>> = {},
) =>
  baseEvent(QuestionnaireEvents.abandoned, {
    ...questionnairePayload(),
    reason: 'timeout',
    ...overrides,
  });

/** Подписка story на событие по FQN Def; нет подписки — ошибка теста. */
export function subscriptionOf(
  story: { getEventSubscriptions(): UiEventSubscription[] },
  eventName: string,
): UiEventSubscription {
  const sub = story
    .getEventSubscriptions()
    .find((s) => s.def.name === eventName);
  if (!sub) throw new Error(`Нет подписки на ${eventName}`);
  return sub;
}

// ══ Стенд story ══

export type Sender = ReturnType<typeof makeSender>;

/** Мок `proactiveSender` (каналы notify/invite). */
export function makeSender() {
  return {
    name: 'questionnaire',
    notify: mock(async (_telegramId: number, _payload: { text: MdText }) => {}),
    invite: mock(
      async (
        _telegramId: number,
        _payload: {
          text: MdText;
          keyboard: { rows: { text: string; code: string }[][] };
        },
      ) => {},
    ),
    execute: mock(async () => {}),
    kickFromGroup: mock(async () => {}),
  };
}

type Initable = {
  init(deps: never, sender: never): void;
};

export type StoryEnvOpts = {
  /** Ответ `getUser` по uuid; нет записи — `USER_NOT_FOUND` (профиля нет). */
  users?: Record<string, UserView | undefined>;
  /** `getUser` бросает исключение (сбой чтения профиля). */
  getUserFails?: boolean;
  /** Ответы UC модуля анкет по имени UC (`getCurrent`, `handleAction`, …). */
  answers?: UcAnswers;
};

/**
 * Инициализирует story моками: DMG-мок `appApi.dispatch` (UC анкет и
 * `getUser` профиля респондента) и резолвер субъекта. Legacy `execute` в
 * моке нет: любой legacy-вызов UC — ошибка теста.
 */
export function initStory<S extends Initable>(
  story: S,
  opts: StoryEnvOpts = {},
) {
  const sender = makeSender();
  const dispatch = dmgDispatch({
    getUser: (input) => {
      if (opts.getUserFails) throw new Error('сбой getUser');
      const profile = opts.users?.[(input as { uuid: string }).uuid];
      return profile ?? refuse(UserErrors.NOT_FOUND.code, 'not_found');
    },
    ...opts.answers,
  });
  story.init(
    { appApi: { dispatch }, callers: testCallers } as never,
    sender as never,
  );
  return { story, sender, dispatch };
}

/** Команды UC анкет, ушедшие в `dispatch`: имя UC и вход, по порядку (без чтений профиля). */
export function dispatchedOf(dispatch: ReturnType<typeof dmgDispatch>) {
  return dispatch.mock.calls
    .map(([, command]) => ({ uc: command.uc, input: command.input }))
    .filter((call) => call.uc !== 'getUser');
}

/** Чтения профиля (`getUser`), ушедшие в `dispatch`: `uuid` по порядку. */
export function userReadsOf(dispatch: ReturnType<typeof dmgDispatch>) {
  return dispatch.mock.calls
    .filter(([, command]) => command.uc === 'getUser')
    .map(([, command]) => (command.input as { uuid: string }).uuid);
}

// ══ Логгер ══

export type MockLogger = Logger & {
  warn: ReturnType<typeof mock>;
  error: ReturnType<typeof mock>;
};

function createMockLogger(): MockLogger {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
    setLogLevel: mock(() => {}),
    getLogLevel: mock(() => LogLevel.DEBUG),
    setSourceLevel: mock(() => {}),
  } as unknown as MockLogger;
}

/** Глобальный мок-логгер на каждый тест блока `describe` (вызывать внутри него). */
export function useMockLogger(): MockLogger {
  const logger = createMockLogger();
  beforeEach(() => {
    logger.warn.mockClear();
    logger.error.mockClear();
    setGlobalLogger(logger);
  });
  afterEach(() => {
    setGlobalLogger(undefined as unknown as Logger);
  });
  return logger;
}

type WarnCall = [string, string, Record<string, unknown>];

/**
 * Вызовы `warn` story по источнику и части текста. Отсекает штатный `warn`
 * `dispatchUc` о `requestId`: unit зовёт обработчик подписки напрямую — вне
 * `UiEventContext` и `BotRequestContext`.
 */
export function warnsOf(
  logger: MockLogger,
  source: string,
  text: string,
): WarnCall[] {
  return (logger.warn.mock.calls as unknown as WarnCall[]).filter(
    ([callSource, message]) => callSource === source && message.includes(text),
  );
}

// ══ Экраны ══

/** Плоский список кнопок экрана: `[текст, код]`. */
export function buttonsOf(res: DialogResponse): string[][] {
  return (res.screen?.keyboard?.rows ?? []).flat().map((b) => [b.text, b.code]);
}
