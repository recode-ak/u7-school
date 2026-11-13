import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { AppController } from '@u7-scl/bot/app/app-controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotController } from '@u7-scl/bot/u7-bot-controller';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import { md } from '@u7-scl/core/shared';
import {
  assertDialogResponseMarkdownSafe,
  type DialogResponse,
} from '@u7-scl/core/ui';
import {
  GetQuestionnairesByUserUcDef,
  QuestionnaireModuleDef,
  QuestionnairePoolSchema,
  StartQuestionnaireUcDef,
} from '@u7-scl/domain/questionnaire/contract';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import { type OperationRef, SystemCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { expectOk } from 'dmg-core/testing';
import * as v from 'valibot';
import { QuestionnaireController } from '../../src/controllers/questionnaire/controller';

/**
 * E2E контракта ошибок UI-слоя (`bot-controller`, `bot-ui-story`):
 * экран ошибки вместо падения, экранирование MarkdownV2, кнопка выхода,
 * отсутствие утечки доменных деталей.
 *
 * Уровни:
 * - маршрутизация: неизвестный контроллер/стори (P8-24);
 * - команды: исключение стори в pipe + склейка `continue`-нотисов над
 *   ответом `stop` (P8-32);
 * - отказы UC в стори: validation (P8-33), conflict (P8-34), internal
 *   (P8-35) — через реальные анкетные маршруты;
 * - ввод: `errorNotify` поверх диалога, `awaitInput` сохраняется (P8-36)
 *   — стори-лаборатория в этом же файле.
 *
 * Статус сверки P8-33…P8-36 в сценариях отмечен «≠ намеренно»: тесты
 * фиксируют НЫНЕШНЕЕ поведение платформы.
 */

const MARINA_TG = 1007;
const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';
const PROBE_FROM: OperationRef = {
  kind: 'useCase',
  module: 'probe',
  name: 'probe',
};

const traceOf = () => Trace.fromRequest({ requestId: crypto.randomUUID() });

/** Стори «уведомление»: продолжает pipe и оставляет notice. */
class LabNoticeStory extends U7BotUiStory {
  override readonly name = 'notice';

  override async handleCallback(): Promise<DialogResponse> {
    return {};
  }

  override async handleCommand(
    update: Parameters<U7BotUiStory['handleCommand']>[0],
  ) {
    if (update.command !== 'explode') return { reaction: 'pass' as const };
    return {
      reaction: 'continue' as const,
      notice: md`Уведомление перед падением`,
    };
  }
}

/** Стори «падение»: исключение в pipe-команде (P8-32). */
class LabExplodeStory extends U7BotUiStory {
  override readonly name = 'explode';

  override async handleCallback(): Promise<DialogResponse> {
    return {};
  }

  override async handleCommand(
    update: Parameters<U7BotUiStory['handleCommand']>[0],
  ) {
    if (update.command !== 'explode') return { reaction: 'pass' as const };
    throw new Error('lab: исключение в стори');
  }
}

/** Стори «ввод»: ловит своё исключение и отдаёт `errorNotify` (P8-36). */
class LabFallStory extends U7BotUiStory {
  override readonly name = 'fall';

  override async handleCallback(action: string): Promise<DialogResponse> {
    if (action !== 'open') return {};
    return {
      ...this.screen(
        md`Лаборатория ошибок`,
        this.kb([[this.btn('Открыть ввод', 'lab:fall:ask')]]),
      ),
      awaitInput: { context: {} },
    };
  }

  override async handleMessage(): Promise<DialogResponse> {
    try {
      throw new Error('lab: падение при вводе');
    } catch (err) {
      return this.errorNotify(err);
    }
  }
}

/** Контроллер-лаборатория: единственный источник ошибок теста. */
class LabController extends U7BotController {
  override readonly name = 'lab';
  protected override readonly stories: U7BotUiStory[] = [
    new LabNoticeStory(),
    new LabExplodeStory(),
    new LabFallStory(),
  ];
}

/** Пул одного вопроса — для настоящей анкеты в статусе in_progress. */
const oneQuestionPool = () =>
  v.parse(QuestionnairePoolSchema, {
    inviteText: 'Анкета',
    questions: [
      {
        question: 'Какой у тебя опыт?',
        questionCode: 'q1',
        type: 'choice',
        multiple: false,
        answers: [{ answer: 'Новичок', answerCode: 'novice' }],
      },
    ],
  });

describe('E2E: экраны ошибок UI-слоя (F-33)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let marina: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('e2e-ui-errors');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new QuestionnaireController(),
      new LabController(),
    ]);
    marina = await app.userByTelegramId(MARINA_TG);
  });

  beforeEach(() => {
    transport.reset();
    transport.dropSession(MARINA_TG);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ── Хелперы ──

  const ctx = (
    tgId: number,
    opts: { callbackData?: string; text?: string } = {},
  ) => transport.makeBotContext(tgId, opts);

  const textOf = (response: { screen?: { text: unknown } }): string =>
    String(response.screen?.text ?? '');

  const buttonsOf = (response: DialogResponse): string[] =>
    (response.screen?.keyboard?.rows.flat() ?? []).map((b) => b.text);

  const startMenu = () => transport.handleStart(ctx(MARINA_TG));

  const pressRaw = (rawCode: string) =>
    transport.handleCallback(
      ctx(MARINA_TG, {
        callbackData: stampedCode(transport, MARINA_TG, rawCode),
      }),
    );

  /** Настоящий `startQuestionnaire` — анкета in_progress (для conflict). */
  async function createStandard(courseId: string): Promise<string> {
    expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        StartQuestionnaireUcDef.command({
          pool: oneQuestionPool(),
          ownerInfo: { courseId },
        }),
        new SystemCaller(PROBE_FROM, marina),
        traceOf(),
      ),
    );
    const list = expectOk(
      await app.apiApp.dispatch(
        QuestionnaireModuleDef,
        GetQuestionnairesByUserUcDef.command({ userId: marina.user.uuid }),
        marina,
        traceOf(),
      ),
    );
    const created = list.find((q) => String(q.ownerInfo.courseId) === courseId);
    if (!created) throw new Error('Созданная анкета не найдена');
    return created.uuid;
  }

  // ── Маршрутизация ──

  test('P8-24: кнопка с несуществующим префиксом контроллера — «Неизвестная команда»', async () => {
    await startMenu();

    const response = await pressRaw('ghost:hub:open');

    expect(textOf(response)).toContain('Неизвестная команда');
    assertDialogResponseMarkdownSafe(response);
  });

  // ── Команды ──

  test('P8-32: исключение стори в pipe — экран ошибки вместо падения', async () => {
    await startMenu();

    const response = await transport.handleCommand(ctx(MARINA_TG), '/explode');

    expect(String(response.screen?.text)).toContain(
      'Произошла внутренняя ошибка',
    );
    expect(buttonsOf(response)).toContain('⬅️ Меню');
    assertDialogResponseMarkdownSafe(response);
  });

  test.skip('P8-32: continue-нотисы склеиваются над ответом stop', async () => {
    // находка: P8-32 — исключение стори в pipe теряет накопленные
    // continue-нотисы: catch контроллера возвращает `stop` в обход
    // `#withNotices` (bot-controller.ts, `handleCommand`). По сценарию
    // нотис должен стоять над экраном ошибки, сейчас — пропадает.
    await startMenu();

    const response = await transport.handleCommand(ctx(MARINA_TG), '/explode');

    expect(String(response.notify?.text)).toContain(
      'Уведомление перед падением',
    );
    // Нотис — над экраном ошибки, экран не подменяется
    expect(String(response.screen?.text)).toContain(
      'Произошла внутренняя ошибка',
    );
  });

  // ── Отказы UC в стори ──

  test('P8-33: validation — «Ошибка валидации» со списком полей и выходом', async () => {
    await startMenu();

    const response = await pressRaw('questionnaire:invite:start:not-a-uuid');

    expect(textOf(response)).toContain('Ошибка валидации');
    expect(textOf(response)).toContain('questionnaireId');
    expect(buttonsOf(response)).toContain('⬅️ Меню');
    assertDialogResponseMarkdownSafe(response);
  });

  test('P8-34: conflict — «⚠️» с текстом ошибки и выходом в меню', async () => {
    const qId = await createStandard(crypto.randomUUID());
    await startMenu();

    const response = await pressRaw(`questionnaire:invite:start:${qId}`);

    expect(textOf(response)).toContain('⚠️');
    expect(textOf(response)).toContain('не в статусе invited');
    expect(buttonsOf(response)).toContain('⬅️ Меню');
    assertDialogResponseMarkdownSafe(response);
  });

  test('P8-35: internal — общий экран без доменных деталей', async () => {
    const file = `${app.fixtures.dbDir}/questionnaires/questionnaires.json`;
    const original = await Bun.file(file).text();
    try {
      await Bun.write(file, '{{{ not json');
      await startMenu();

      const response = await pressRaw(
        `questionnaire:invite:start:${crypto.randomUUID()}`,
      );

      expect(textOf(response)).toContain('Произошла внутренняя ошибка');
      expect(textOf(response)).not.toContain('not json');
      expect(textOf(response)).not.toContain('SyntaxError');
      expect(buttonsOf(response)).toContain('⬅️ Меню');
      assertDialogResponseMarkdownSafe(response);
    } finally {
      await Bun.write(file, original);
    }
  });

  // ── Ошибка без экрана ──

  test('P8-36: errorNotify при вводе — warn поверх диалога, ввод сохраняется', async () => {
    await startMenu();
    const opened = await pressRaw('lab:fall:open');
    expect(textOf(opened)).toContain('Лаборатория ошибок');
    expect(transport.dialogOf(MARINA_TG)?.input).toBeDefined();

    const failed = await transport.handleMessage(
      ctx(MARINA_TG, { text: 'данные' }),
    );

    expect(failed.notify?.kind).toBe('warn');
    expect(String(failed.notify?.text)).toContain('Произошла ошибка');
    expect(failed.screen).toBeUndefined();
    expect(transport.dialogOf(MARINA_TG)?.input).toBeDefined();
  });
});
