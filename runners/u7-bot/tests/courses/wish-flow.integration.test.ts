import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import type { User } from '@u7-scl/app-legacy/domain';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { CoursesController } from '@u7-scl/bot/courses/controller';
import {
  assertDialogResponseMarkdownSafe,
  type DialogResponse,
} from '@u7-scl/core/ui';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import type { WishStatus } from '@u7-scl/wish/domain';
import { WishAr } from '@u7-scl/wish/domain';

/**
 * Интеграционный тест wish-флоу (ветка A — instant): модуль wish подключён
 * к каталогу курсов, один самый длинный путь
 *   apply → повторный apply → W04 → cancel → confirm → W05 → apply
 * и экранирование MarkdownV2 в карточках курсов мира с опасными названиями.
 * Ветки W04 (expressed, pending, confirmed), «уже нет» и экран отмены —
 * в `course-catalog.story.test.ts`.
 *
 * Контракт «Диалог и Экран»: ассерты — по DialogResponse, захваченному
 * на границе uiApp. Реальный ApiApp (wish-модуль включён) + реальный
 * CoursesController. Коды прямых вызовов штампуются актуальным штампом
 * открытого экрана; клики по кнопкам ответа — тот же штамп (внутри
 * одной стори seq не меняется). Статусы проверяются по wishRepo.
 */
describe('Wish: жизненный цикл желания курса (интеграционный)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: User;

  const INSTANT_COURSE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  // Курс мира с опасным названием (MarkdownV2), запись через анкету (малый пул)
  const ESCAPING_COURSE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  // Начало названия `course-test-escaping` в экранированном виде
  const ESCAPED_ESCAPING_PREFIX = 'Тест\\. Курс \\(v2\\.0\\)';
  // Published-фикстурный курс с опасным названием (MarkdownV2), без пула
  const DANGEROUS_COURSE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  // Опасное название на карточке курса: средняя крошка усечена до 34 символов
  // (у курса из одного этапа три крошки), точки экранированы
  const ESCAPED_DANGEROUS_PREFIX = 'Опас\\. Название\\.\\.\\.';
  const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

  beforeAll(async () => {
    app = await createTestApp('wish-flow');
    const courseController = new CoursesController();
    const appController = new AppController(SCHOOL_GROUP_URL);
    transport = createTestBotTransport(app, [appController, courseController]);
    guest = (await app.userFacade.getUserByTelegramId(1001))!;
  });

  beforeEach(() => {
    transport.reset();
  });

  afterAll(async () => {
    await app.cleanup();
  });

  // ── Хелперы ──

  /** Открывает диалог гостя (актуальный штамп для нажатий). */
  async function openDialog(): Promise<void> {
    await transport.handleStart(transport.makeBotContext(guest.telegramId));
  }

  /** Прямой callback «Хочу пройти курс»: сырой код + актуальный штамп. */
  async function apply(courseId: string): Promise<DialogResponse> {
    return transport.handleCallback(
      transport.makeBotContext(guest.telegramId, {
        callbackData: stampedCode(
          transport,
          guest.telegramId,
          `course:course-catalog:apply:${courseId}`,
        ),
      }),
    );
  }

  /** Клик по кнопке последнего ответа (код raw, штамп — текущий экран). */
  async function click(
    response: DialogResponse,
    buttonText: string,
  ): Promise<DialogResponse> {
    const btn = buttonsOf(response).find((b) => b.text === buttonText);
    expect(btn, `Кнопка «${buttonText}» не найдена в ответе`).toBeDefined();
    return transport.handleCallback(
      transport.makeBotContext(guest.telegramId, {
        callbackData: stampedCode(transport, guest.telegramId, btn!.code),
      }),
    );
  }

  function hasButton(response: DialogResponse, text: string): boolean {
    return buttonsOf(response).some((b) => b.text.includes(text));
  }

  function buttonsOf(
    response: DialogResponse,
  ): Array<{ text: string; code: string }> {
    return response.screen?.keyboard?.rows.flat() ?? [];
  }

  /**
   * Все статусы желаний гостя на курс. Порядок записей в файле при равных
   * createdAt недетерминирован, поэтому проверяем набор, а не «последнюю».
   */
  async function wishStatuses(courseId: string): Promise<WishStatus[]> {
    return (
      await app.wishRepo.findAllByUserAndTarget(guest.uuid, {
        kind: 'course',
        courseId,
      })
    ).map((w) => w.snapshot().status);
  }

  /** Изоляция тестов: гасит активные желания гостя (cancelled не мешает созданию). */
  async function deactivateWishes(): Promise<void> {
    for (const ar of await app.wishRepo.findByUser(guest.uuid)) {
      const w = ar.snapshot();
      if (w.status !== 'cancelled' && w.status !== 'fulfilled') {
        await app.wishRepo.save(WishAr.restore({ ...w, status: 'cancelled' }));
      }
    }
  }

  /** apply → cancel → «✅ Да»: возвращает W05-ответ (желание cancelled). */
  async function applyAndCancel(courseId: string): Promise<DialogResponse> {
    await apply(courseId);
    const w04 = await apply(courseId);
    expect(w04.screen?.text).toContain('уже выразил');
    const confirmScreen = await click(w04, '🗑️ Отменить желание');
    return click(confirmScreen, '✅ Да');
  }

  // ── A4: «✅ Да» → W05, повторное желание возможно ──

  test('cancel: «✅ Да» → «отменено», в репо cancelled; apply после отмены → W03', async () => {
    await deactivateWishes();
    await openDialog();

    const w05 = await applyAndCancel(INSTANT_COURSE_ID);
    expect(w05.screen?.text).toContain('отменено');
    expect(hasButton(w05, 'Главное меню')).toBe(true);
    expect(await wishStatuses(INSTANT_COURSE_ID)).toContain('cancelled');
    expect(await wishStatuses(INSTANT_COURSE_ID)).not.toContain('expressed');

    const again = await apply(INSTANT_COURSE_ID);
    expect(again.screen?.text).toContain('зафиксировано');
    expect(await wishStatuses(INSTANT_COURSE_ID)).toContain('expressed');
  });

  // ── A7: экранирование опасного названия ──

  test('опасные названия курсов — карточки markdown-safe', async () => {
    await openDialog();

    // Курс мира с опасным названием: карточка курса из одного этапа
    const escapingCard = await transport.handleCallback(
      transport.makeBotContext(guest.telegramId, {
        callbackData: stampedCode(
          transport,
          guest.telegramId,
          `course:course-catalog:course:${ESCAPING_COURSE_ID}`,
        ),
      }),
    );
    expect(escapingCard.screen?.text).toContain(ESCAPED_ESCAPING_PREFIX);
    assertDialogResponseMarkdownSafe(escapingCard);

    // Published-курс мира: опасное название в крошках и на кнопке
    const list = await transport.handleCallback(
      transport.makeBotContext(guest.telegramId, {
        callbackData: stampedCode(
          transport,
          guest.telegramId,
          `course:course-catalog:course:${DANGEROUS_COURSE_ID}`,
        ),
      }),
    );
    expect(list.screen?.text).toContain(ESCAPED_DANGEROUS_PREFIX);
    assertDialogResponseMarkdownSafe(list);
  });
});
