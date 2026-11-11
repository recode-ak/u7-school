import { afterEach, beforeEach, mock } from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
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
import { Role } from '@u7-scl/user/domain';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import {
  dmgDispatch as baseDmgDispatch,
  type UcAnswers,
} from '../../streams/stories/stream-dmg.test-kit';
import type {
  QuestionnaireAbandonedEvent,
  QuestionnaireAbandonWarningEvent,
  QuestionnaireContinueInviteEvent,
  QuestionnaireInvitedEvent,
  QuestionnaireStartedEvent,
} from './questionnaire-events';

export { Refusal, refuse } from '../../streams/stories/stream-dmg.test-kit';
export { testCallers };

/** Мок `appApi.dispatch` модуля анкет: допустим только `QuestionnaireModuleDef`. */
export const dmgDispatch = (answers: UcAnswers) =>
  baseDmgDispatch(answers, [QuestionnaireModuleDef]);

// ══ Данные ══

export const QUESTIONNAIRE_ID = 'q-1';
export const RESPONDENT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
export const RESPONDENT_TG = 456;
export const COURSE_ID = 'course-1';

/** Профиль респондента из legacy `get-user` (полный `User`, годится как actor). */
export const respondentProfile = (overrides: Partial<User> = {}): User => ({
  uuid: RESPONDENT_ID,
  name: 'Респондент',
  telegramId: RESPONDENT_TG,
  roles: [Role.GUEST],
  createdAt: '2026-01-01T00:00:00.000Z',
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

const baseEvent = <P extends Record<string, unknown>>(
  eventName: string,
  payload: P,
) => ({
  eventId: crypto.randomUUID(),
  eventName,
  occurredAt: new Date().toISOString(),
  aggregateName: 'Questionnaire',
  aggregateId: QUESTIONNAIRE_ID,
  payload,
});

const payloadOf = (overrides: Record<string, unknown>) => ({
  questionnaireId: QUESTIONNAIRE_ID,
  respondentId: RESPONDENT_ID,
  kind: 'standard' as const,
  ownerInfo: { courseId: COURSE_ID } as Record<string, unknown>,
  ...overrides,
});

/** `started` (payload по схеме Def, без `telegramId`/`response`). */
export const startedEvent = (
  overrides: Record<string, unknown> = {},
): QuestionnaireStartedEvent =>
  baseEvent(QuestionnaireEvents.started.name, payloadOf(overrides)) as never;

/** `invited` (likert-приглашение). */
export const invitedEvent = (
  overrides: Record<string, unknown> = {},
): QuestionnaireInvitedEvent =>
  baseEvent(
    QuestionnaireEvents.invited.name,
    payloadOf({ kind: 'likert', ownerInfo: {}, ...overrides }),
  ) as never;

/** `abandonWarning` (ступень 6 ч). */
export const abandonWarningEvent = (
  overrides: Record<string, unknown> = {},
): QuestionnaireAbandonWarningEvent =>
  baseEvent(
    QuestionnaireEvents.abandonWarning.name,
    payloadOf(overrides),
  ) as never;

/** `continueInvite` (ступень 3 ч). */
export const continueInviteEvent = (
  overrides: Record<string, unknown> = {},
): QuestionnaireContinueInviteEvent =>
  baseEvent(
    QuestionnaireEvents.continueInvite.name,
    payloadOf(overrides),
  ) as never;

/** `abandoned` (по умолчанию `timeout`). */
export const abandonedEvent = (
  overrides: Record<string, unknown> = {},
): QuestionnaireAbandonedEvent =>
  baseEvent(
    QuestionnaireEvents.abandoned.name,
    payloadOf({ reason: 'timeout', ...overrides }),
  ) as never;

/** Подписка story на событие по FQN Def; нет подписки — ошибка теста. */
export function subscriptionOf(
  story: { getEventSubscriptions(): UiEventSubscription[] },
  eventName: string,
): UiEventSubscription {
  const sub = story
    .getEventSubscriptions()
    .find((s) => s.eventName === eventName);
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

/** Профиль `get-user`; `telegramId` может отсутствовать (пользователь без Telegram). */
export type ProfileOf = Omit<User, 'telegramId'> & { telegramId?: number };

export type StoryEnvOpts = {
  /** Профили `get-user` по uuid; нет записи — `undefined` (профиля нет). */
  users?: Record<string, ProfileOf | undefined>;
  /** `get-user` бросает исключение (сбой чтения профиля). */
  getUserFails?: boolean;
  /** Ответы UC модуля анкет по имени UC (`getCurrent`, `handleAction`, …). */
  answers?: UcAnswers;
};

/**
 * Инициализирует story моками: legacy `get-user` в `appApi.execute`, DMG-мок
 * `appApi.dispatch` и резолвер субъекта. Любой другой legacy-вызов
 * `execute` — ошибка теста: UC анкет идут только через `dispatch`.
 */
export function initStory<S extends Initable>(
  story: S,
  opts: StoryEnvOpts = {},
) {
  const sender = makeSender();
  const execute = mock(
    async (name: string, params?: Record<string, unknown>) => {
      if (name !== 'get-user') {
        throw new Error(`Неожиданный legacy-вызов UC: ${name}`);
      }
      if (opts.getUserFails) throw new Error('сбой get-user');
      return opts.users?.[params?.uuid as string];
    },
  );
  const dispatch = dmgDispatch(opts.answers ?? {});
  story.init(
    { appApi: { execute, dispatch }, callers: testCallers } as never,
    sender as never,
  );
  return { story, sender, execute, dispatch };
}

/** Команды, ушедшие в `dispatch`: имя UC и вход, по порядку. */
export function dispatchedOf(dispatch: ReturnType<typeof dmgDispatch>) {
  return dispatch.mock.calls.map(([, command]) => ({
    uc: command.uc,
    input: command.input,
  }));
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
 * `dispatchUc` о `requestId`: подписки событий работают вне `BotRequestContext`.
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
