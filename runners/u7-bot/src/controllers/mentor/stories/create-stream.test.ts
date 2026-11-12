import { describe, expect, test } from 'bun:test';
import { TEST_SCHOOL } from '@u7-scl/app';
import type {
  BotSession,
  CommandUpdate,
  DialogResponse,
} from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import { CourseModuleDef, ModuleErrors } from '@u7-scl/domain/course/contract';
import {
  CreateStreamUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { userActor } from '../../../core/user-actor.test-kit';
import {
  dmgDispatch,
  type Refusal,
  refuse,
} from '../../courses/stories/course-dmg.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { CreateStreamStory } from './create-stream';

/** Модули мастера: курсы (модули) и потоки (создание). */
const MODULES = [CourseModuleDef, StreamModuleDef];

/** Контекст wizard-а (живёт в dialog.input.context) */
type WizardCtx = Record<string, unknown>;

/** Сессия с ожидающим вводом и контекстом wizard-а */
function wizardSession(step: number, extra: WizardCtx = {}): BotSession {
  return {
    dialog: {
      path: 'mentor/create-stream',
      seq: 2,
      input: { context: { step, ...extra } },
    },
  };
}

const NO_SESSION: BotSession = {
  dialog: { path: 'mentor/create-stream', seq: 2 },
};

const mentorActor = userActor({
  uuid: '11111111-1111-4111-8111-aaaaaaaab011',
  name: 'Ментор Тест',
  telegramId: 123,
  roles: ['MENTOR'],
});

const mockModule = {
  uuid: 'mod-1',
  title: 'JavaScript Основы',
  description: 'Курс по основам JS',
  goal: 'Научиться писать код',
  result: 'Выпускной проект',
  rules: 'Дедлайны раз в неделю',
  targetAudience: 'Новички в IT',
  additional: 'Нужен компьютер',
  status: 'published',
};

/** Полный набор module*-полей для wizard-сессий */
const MOD_FIELDS: WizardCtx = {
  moduleGoal: 'Цель',
  moduleResult: 'Рез',
  moduleRules: 'Прав',
  moduleTargetAudience: 'Ауд',
  moduleAdditional: 'Доп',
};

/**
 * Пять необязательных полей wizard-а (шаги 4–8): шаг показа, значение из
 * модуля (`moduleKey`), следующий шаг и фрагмент его экрана. Зеркалит таблицу
 * `OPTIONAL_FIELDS` из `create-stream.ts`.
 */
interface OptionalField {
  fieldName: 'goal' | 'result' | 'rules' | 'targetAudience' | 'additional';
  moduleKey: keyof WizardCtx;
  step: number;
  nextStep: number;
  nextMarker: string;
}

const OPTIONAL_FIELDS: OptionalField[] = [
  {
    fieldName: 'goal',
    moduleKey: 'moduleGoal',
    step: 4,
    nextStep: 5,
    nextMarker: 'Результат',
  },
  {
    fieldName: 'result',
    moduleKey: 'moduleResult',
    step: 5,
    nextStep: 6,
    nextMarker: 'Правила',
  },
  {
    fieldName: 'rules',
    moduleKey: 'moduleRules',
    step: 6,
    nextStep: 7,
    nextMarker: 'Целевая аудитория',
  },
  {
    fieldName: 'targetAudience',
    moduleKey: 'moduleTargetAudience',
    step: 7,
    nextStep: 8,
    nextMarker: 'Дополнительно',
  },
  {
    fieldName: 'additional',
    moduleKey: 'moduleAdditional',
    step: 8,
    nextStep: 9,
    nextMarker: 'Telegram',
  },
] as const;

function createStory(
  apiOverrides?: { listModules?: unknown[] | Refusal },
  createStream: () => unknown = () => ({
    streamId: '11111111-1111-4111-8111-111111111111',
  }),
) {
  const story = new CreateStreamStory();
  const dispatch = dmgDispatch(
    {
      createStream,
      listModules: () => apiOverrides?.listModules ?? [mockModule],
      getModule: (input) => {
        const { moduleId } = input as { moduleId: string };
        if (moduleId === mockModule.uuid) return mockModule;
        return { title: '', description: '' };
      },
    },
    MODULES,
  );
  // Второй аргумент — имя контроллера (для isActive в pipe-командах)
  story.init(
    {
      appApi: { dispatch },
      callers: testCallers,
      school: TEST_SCHOOL,
    } as never,
    { name: 'mentor' } as never,
  );
  return { story, dispatch };
}

const inputMsg = (text: string) => ({
  type: 'message' as const,
  text,
  telegramId: 123,
});

const cancelCmd = (): CommandUpdate => ({
  type: 'command',
  command: 'cancel',
  args: '',
  telegramId: 123,
});

function ctxOf(response: DialogResponse): WizardCtx {
  return (response.awaitInput?.context ?? {}) as WizardCtx;
}

describe('CreateStreamStory (US-6) — контракт «Диалог и Экран»', () => {
  // ── Шаг 0: выбор модуля ──

  test('start: список модулей + awaitInput (контекст wizard-а)', async () => {
    const { story } = createStory();
    const response = await story.handleCallback(
      'start',
      mentorActor,
      NO_SESSION,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text)).toContain('Выберите модуль');
    expect(response.screen?.keyboard?.rows).toEqual([
      [{ text: 'JavaScript Основы', code: 'create-stream:module:mod-1' }],
    ]);
    expect(response.awaitInput?.context).toBeDefined();
  });

  test('start: нет модулей — экран с кнопкой «Обновить список»', async () => {
    const { story } = createStory({ listModules: [] });
    const response = await story.handleCallback(
      'start',
      mentorActor,
      NO_SESSION,
    );
    expect(String(response.screen?.text)).toContain('Нет доступных модулей');
    expect(response.screen?.keyboard?.rows).toEqual([
      [{ text: '🔄 Обновить список', code: 'create-stream:start' }],
    ]);
    expect(response.awaitInput).toBeDefined();
  });

  test('start: отказ listModules — реплика ucErrorNotify, а не «нет модулей»', async () => {
    const { story } = createStory({
      listModules: refuse('SERVER_INTERNAL', 'internal'),
    });
    const response = await story.handleCallback(
      'start',
      mentorActor,
      NO_SESSION,
    );
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain('Произошла ошибка');
    expect(response.screen).toBeUndefined();
  });

  // ── Шаг 1: модуль выбран → название ──

  test('module:{id}: шаг 1 (название), подсказка модуля, кнопка «Принять»', async () => {
    const { story } = createStory();
    const response = await story.handleCallback(
      'module:mod-1',
      mentorActor,
      NO_SESSION,
    );

    const text = String(response.screen?.text);
    expect(text).toContain('название потока');
    expect(text).toContain('JavaScript Основы');
    expect(response.screen?.keyboard?.rows).toEqual([
      [{ text: '✅ Принять', code: 'create-stream:accept-title' }],
    ]);
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(1);
    expect(ctx.moduleId).toBe('mod-1');
    expect(ctx.title).toBe('JavaScript Основы');
  });

  test('accept-title: шаг 2 (описание)', async () => {
    const { story } = createStory();
    const session = wizardSession(1, {
      moduleId: 'mod-1',
      title: 'JS Basics',
      description: 'Описание потока',
      ...MOD_FIELDS,
    });
    const response = await story.handleCallback(
      'accept-title',
      mentorActor,
      session,
    );

    expect(String(response.screen?.text)).toContain('описание потока');
    expect(response.screen?.keyboard?.rows).toEqual([
      [{ text: '✅ Принять', code: 'create-stream:accept-description' }],
    ]);
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(2);
    expect(ctx.title).toBe('JS Basics');
  });

  test('accept-description: шаг 3 (дата старта)', async () => {
    const { story } = createStory();
    const session = wizardSession(2, {
      title: 'JS',
      description: 'Курс',
      ...MOD_FIELDS,
    });
    const response = await story.handleCallback(
      'accept-description',
      mentorActor,
      session,
    );

    const text = String(response.screen?.text);
    expect(text).toContain('дату старта');
    expect(text).toContain('YYYY');
    // Инвариант литералов MdText: `\.` — валидный MarkdownV2, а `\\.` —
    // литеральный backslash + голая точка, Telegram отклонит сообщение
    expect(text).not.toContain('\\\\');
    expect(ctxOf(response).step).toBe(3);
  });

  // ── Ввод названия/описания/даты ──

  test('ввод шаг 1 — название → шаг 2', async () => {
    const { story } = createStory();
    const session = wizardSession(1, {
      moduleId: 'mod-1',
      description: 'Описание потока',
      ...MOD_FIELDS,
    });
    const response = await story.handleMessage(
      inputMsg('Мой поток'),
      mentorActor,
      session,
    );
    expect(String(response.screen?.text)).toContain('описание потока');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(2);
    expect(ctx.title).toBe('Мой поток');
  });

  test('ввод шаг 2 — описание → шаг 3', async () => {
    const { story } = createStory();
    const session = wizardSession(2, { title: 'Поток', ...MOD_FIELDS });
    const response = await story.handleMessage(
      inputMsg('Тестовый поток'),
      mentorActor,
      session,
    );
    expect(String(response.screen?.text)).toContain('дату старта');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(3);
    expect(ctx.description).toBe('Тестовый поток');
  });

  test('ввод шаг 3 — дата YYYY-MM-DD → шаг 4 (Цель)', async () => {
    const { story } = createStory();
    const session = wizardSession(3, {
      title: 'Поток',
      description: 'Описание',
      moduleGoal: 'Стать разработчиком',
      moduleResult: 'Рез',
      moduleRules: 'Прав',
      moduleTargetAudience: 'Ауд',
      moduleAdditional: 'Доп',
    });
    const response = await story.handleMessage(
      inputMsg('2026-09-01'),
      mentorActor,
      session,
    );
    expect(String(response.screen?.text)).toContain('Цель');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(4);
    expect(ctx.startDate).toBe('2026-09-01T00:00');
  });

  test('ввод шаг 3 — дата со временем (ISO) сохраняется', async () => {
    const { story } = createStory();
    const session = wizardSession(3, {
      title: 'П',
      description: 'О',
      ...MOD_FIELDS,
    });
    const response = await story.handleMessage(
      inputMsg('2026-09-01T14:00'),
      mentorActor,
      session,
    );
    const ctx = ctxOf(response);
    expect(ctx.startDate).toBe('2026-09-01T14:00');
    expect(ctx.step).toBe(4);
  });

  // ── Шаги 4-8: необязательные поля (accept/skip/ввод) ──

  const optionalBase = {
    title: 'Поток',
    description: 'Описание',
    startDate: '2026-09-01T00:00',
    ...MOD_FIELDS,
  };

  test.each(OPTIONAL_FIELDS)(
    'accept-$fieldName: значение из модуля → шаг $nextStep ($nextMarker)',
    async (field) => {
      const { story } = createStory();
      const session = wizardSession(field.step, optionalBase);
      const response = await story.handleCallback(
        `accept-${field.fieldName}`,
        mentorActor,
        session,
      );
      expect(String(response.screen?.text)).toContain(field.nextMarker);
      const ctx = ctxOf(response);
      expect(ctx.step).toBe(field.nextStep);
      expect(ctx[field.fieldName]).toBe(MOD_FIELDS[field.moduleKey]);
    },
  );

  test.each(OPTIONAL_FIELDS)(
    'skip-$fieldName: пустое поле → шаг $nextStep ($nextMarker)',
    async (field) => {
      const { story } = createStory();
      const session = wizardSession(field.step, optionalBase);
      const response = await story.handleCallback(
        `skip-${field.fieldName}`,
        mentorActor,
        session,
      );
      expect(String(response.screen?.text)).toContain(field.nextMarker);
      const ctx = ctxOf(response);
      expect(ctx.step).toBe(field.nextStep);
      expect(ctx[field.fieldName]).toBe('');
    },
  );

  test.each(OPTIONAL_FIELDS)(
    'ввод шаг $step ($fieldName) → шаг $nextStep ($nextMarker)',
    async (field) => {
      const { story } = createStory();
      const session = wizardSession(field.step, optionalBase);
      const text = `Своё значение: ${field.fieldName}`;
      const response = await story.handleMessage(
        inputMsg(text),
        mentorActor,
        session,
      );
      expect(String(response.screen?.text)).toContain(field.nextMarker);
      const ctx = ctxOf(response);
      expect(ctx.step).toBe(field.nextStep);
      expect(ctx[field.fieldName]).toBe(text);
    },
  );

  // ── Шаги 9-11: группа, инвайт, кодовое слово ──

  test('шаг 9: предзаполнен studentGroup.id, кнопки Оставить и Пропустить', async () => {
    const { story } = createStory();
    const session = wizardSession(8, {
      title: 'Поток',
      goal: 'Цель',
      additional: 'Доп',
    });
    const response = await story.handleCallback(
      'skip-additional',
      mentorActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain(
      String(TEST_SCHOOL.studentGroup.id),
    );
    const buttons = response.screen?.keyboard?.rows.flat() ?? [];
    expect(buttons.some((b) => b.code.endsWith(':accept-group'))).toBe(true);
    expect(buttons.some((b) => b.code.endsWith(':skip-group'))).toBe(true);
  });

  test('accept-group → шаг 10 с telegramGroupId = default studentGroup.id', async () => {
    const { story } = createStory();
    const session = wizardSession(9, {
      title: 'Поток',
      goal: 'Цель',
      additional: 'Доп',
    });
    const response = await story.handleCallback(
      'accept-group',
      mentorActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain('инвайт');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(10);
    expect(ctx.telegramGroupId).toBe(String(TEST_SCHOOL.studentGroup.id));
    const buttons = response.screen?.keyboard?.rows.flat() ?? [];
    expect(buttons.some((b) => b.code.endsWith(':accept-invite'))).toBe(true);
    expect(buttons.some((b) => b.code.endsWith(':skip-invite'))).toBe(true);
  });

  test('accept-invite → шаг 11 с telegramGroupInvite = default studentGroup.inviteUrl', async () => {
    const { story } = createStory();
    const session = wizardSession(10, {
      title: 'Поток',
      telegramGroupId: String(TEST_SCHOOL.studentGroup.id),
    });
    const response = await story.handleCallback(
      'accept-invite',
      mentorActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    expect(String(response.screen?.text)).toContain('кодовое слово');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(11);
    expect(ctx.telegramGroupInvite).toBe(TEST_SCHOOL.studentGroup.inviteUrl);
  });

  test('skip-group → шаг 10 (инвайт-ссылка)', async () => {
    const { story } = createStory();
    const session = wizardSession(9, {
      title: 'Поток',
      goal: 'Цель',
      additional: 'Доп',
    });
    const response = await story.handleCallback(
      'skip-group',
      mentorActor,
      session,
    );
    expect(String(response.screen?.text)).toContain('инвайт');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(10);
    expect(ctx.telegramGroupId).toBe('');
  });

  test('ввод шаг 9 — ID группы → шаг 10', async () => {
    const { story } = createStory();
    const session = wizardSession(9, { title: 'Поток', additional: 'Доп' });
    const response = await story.handleMessage(
      inputMsg('-100123456789'),
      mentorActor,
      session,
    );
    expect(String(response.screen?.text)).toContain('инвайт');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(10);
    expect(ctx.telegramGroupId).toBe('-100123456789');
  });

  test('skip-invite → шаг 11 (кодовое слово)', async () => {
    const { story } = createStory();
    const session = wizardSession(10, {
      title: 'Поток',
      telegramGroupId: '-100123456789',
    });
    const response = await story.handleCallback(
      'skip-invite',
      mentorActor,
      session,
    );
    expect(String(response.screen?.text)).toContain('кодовое слово');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(11);
    expect(ctx.telegramGroupInvite).toBe('');
  });

  test('ввод шаг 10 — инвайт-ссылка → шаг 11', async () => {
    const { story } = createStory();
    const session = wizardSession(10, {
      title: 'Поток',
      telegramGroupId: '-100123456789',
    });
    const response = await story.handleMessage(
      inputMsg('https://t.me/+abc123'),
      mentorActor,
      session,
    );
    expect(String(response.screen?.text)).toContain('кодовое слово');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(11);
    expect(ctx.telegramGroupInvite).toBe('https://t.me/+abc123');
  });

  // ── Шаг 12: превью ──

  test('skip-key → превью со всеми полями и точными кнопками', async () => {
    const { story } = createStory();
    const session = wizardSession(11, {
      title: 'Мой Поток',
      description: 'Описание',
      startDate: '2026-09-01T14:00',
      telegramGroupId: '-100123456789',
      telegramGroupInvite: 'https://t.me/+abc123',
      goal: 'Научиться',
      result: 'Проект',
      rules: 'Дедлайны',
      targetAudience: 'Новички',
      additional: 'Ноутбук',
    });
    const response = await story.handleCallback(
      'skip-key',
      mentorActor,
      session,
    );

    const text = String(response.screen?.text);
    expect(text).toContain('Превью потока');
    expect(text).toContain('Мой Поток');
    expect(text).toContain('Научиться');
    expect(text).toContain('Проект');
    expect(text).toContain('ID группы');
    expect(text).toContain('100123456789');
    expect(text).toContain('Ссылка для студентов');
    expect(text).toContain('abc123');
    expect(text).toContain('Всё верно');
    expect(response.screen?.keyboard?.rows).toEqual([
      [
        { text: '✅ Создать', code: 'create-stream:confirm' },
        { text: '⬅️ Изменить', code: 'create-stream:start' },
      ],
    ]);
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(12);
    expect(ctx.enrollmentKey).toBe('');
  });

  test('ввод шаг 11 — кодовое слово → превью', async () => {
    const { story } = createStory();
    const session = wizardSession(11, {
      title: 'Поток',
      goal: 'Цель',
    });
    const response = await story.handleMessage(
      inputMsg('secret123'),
      mentorActor,
      session,
    );
    expect(String(response.screen?.text)).toContain('Превью потока');
    const ctx = ctxOf(response);
    expect(ctx.step).toBe(12);
    expect(ctx.enrollmentKey).toBe('secret123');
  });

  test('ввод шаг 12 — переспрос «Используйте кнопки выше» (реплика, ввод живёт)', async () => {
    const { story } = createStory();
    const response = await story.handleMessage(
      inputMsg('да'),
      mentorActor,
      wizardSession(12),
    );
    expect(String(response.notify?.text)).toContain('Используйте кнопки выше');
    expect(response.screen).toBeUndefined();
    expect(response.release).toBeUndefined();
  });

  // ── confirm: создание потока ──

  test('confirm: UC createStream с полным cmd, экран успеха + release', async () => {
    const { story, dispatch } = createStory();
    const session = wizardSession(12, {
      moduleId: 'mod-1',
      title: 'Мой Поток',
      description: 'Описание',
      startDate: '2026-09-01T14:00',
      telegramGroupId: '-100123456789',
      telegramGroupInvite: 'https://t.me/+abc123',
      goal: 'Цель',
      result: 'Результат',
      rules: 'Правила',
      targetAudience: 'Аудитория',
      additional: 'Дополнительно',
      enrollmentKey: 'secret',
    });
    const response = await story.handleCallback(
      'confirm',
      mentorActor,
      session,
    );

    expect(String(response.screen?.text)).toContain('успешно создан');
    expect(response.release).toBe(true);
    // Точная реплика: `\!` — экранированный `!`; двойной backslash перед `!`
    // даёт невалидный MarkdownV2 (Telegram вернёт 400 на весь экран)
    expect(String(response.screen?.text)).toBe('✅ *Поток успешно создан\\!*');
    assertDialogResponseMarkdownSafe(response);

    // Ментор потока — субъект, школа — из настроек: во входе их нет; дата — UTC-метка
    expect(dispatch.mock.calls.map(([, command]) => command)).toEqual([
      CreateStreamUcDef.command({
        title: 'Мой Поток',
        description: 'Описание',
        moduleId: 'mod-1',
        startDate: Date.parse('2026-09-01T14:00:00.000Z'),
        telegramGroupId: '-100123456789',
        goal: 'Цель',
        result: 'Результат',
        rules: 'Правила',
        targetAudience: 'Аудитория',
        additional: 'Дополнительно',
        enrollmentKey: 'secret',
        telegramGroupInvite: 'https://t.me/+abc123',
      }),
    ]);
  });

  test('confirm: отказ UC (модуль не найден) — реплика с текстом отказа, без экрана успеха', async () => {
    const { story } = createStory(undefined, () =>
      refuse(ModuleErrors.NOT_FOUND.code, 'not_found', {}, 'Модуль не найден'),
    );
    const response = await story.handleCallback(
      'confirm',
      mentorActor,
      wizardSession(12, { moduleId: 'mod-1', title: 'Поток' }),
    );
    expect(response.notify?.kind).toBe('warn');
    expect(String(response.notify?.text)).toContain('Модуль не найден');
    expect(response.screen).toBeUndefined();
    expect(response.release).toBeUndefined();
  });

  test('confirm без контекста — реплика-предупреждение + release', async () => {
    const { story } = createStory();
    const response = await story.handleCallback(
      'confirm',
      mentorActor,
      NO_SESSION,
    );
    expect(String(response.notify?.text)).toContain('потерян');
    expect(response.release).toBe(true);
  });

  // ── Ошибки состояний ──

  test('ввод без контекста — реплика-предупреждение + release', async () => {
    const { story } = createStory();
    const response = await story.handleMessage(
      inputMsg('что-то'),
      mentorActor,
      NO_SESSION,
    );
    expect(String(response.notify?.text)).toContain('потерян');
    expect(response.release).toBe(true);
  });

  test('ввод на неизвестном шаге — реплика-предупреждение', async () => {
    const { story } = createStory();
    const response = await story.handleMessage(
      inputMsg('что-то'),
      mentorActor,
      wizardSession(99),
    );
    expect(String(response.notify?.text)).toContain('Неизвестный шаг');
  });

  test('не-message update — переспрос «текстовое сообщение»', async () => {
    const { story } = createStory();
    const response = await story.handleMessage(
      { type: 'callback', data: 'x', telegramId: 123, messageId: 1 },
      mentorActor,
      wizardSession(1),
    );
    expect(String(response.notify?.text)).toContain('текстовое сообщение');
  });

  // ── /cancel через pipe (CommandReaction) ──

  test('/cancel активной стори — stop с репликой «отменено» + release', async () => {
    const { story } = createStory();
    const reaction = await story.handleCommand(
      cancelCmd(),
      mentorActor,
      wizardSession(3, { title: 'Поток' }),
    );
    expect(reaction.reaction).toBe('stop');
    if (reaction.reaction === 'stop') {
      expect(String(reaction.response.notify?.text)).toContain('отменено');
      expect(reaction.response.release).toBe(true);
    }
  });

  test('/cancel неактивной стори — pass без побочных действий', async () => {
    const { story } = createStory();
    const reaction = await story.handleCommand(
      cancelCmd(),
      mentorActor,
      // Диалог другой стори
      { dialog: { path: 'mentor/monitor', seq: 1 } },
    );
    expect(reaction.reaction).toBe('pass');
  });
});
