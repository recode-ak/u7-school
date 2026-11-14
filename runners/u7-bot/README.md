# U7 Bot — Telegram-бот школы

Telegram-бот платформы u7-school на grammy. Работает на контракте
**«Диалог и Экран»** (см. [bot-architecture.md](../../conductor/architecture/ui/bot-architecture.md)
и [bot-ui-concept.md](../../conductor/guides/bot-ui-concept.md)):
Grammy-слой — тонкий адаптер апдейтов, состоянием диалогов владеет `BotTransport`,
сценарии отвечают `DialogResponse`, транспорт исполняет его по рендер-политике (bot-architecture §3.3).

## Структура

```
runners/u7-bot/
  src/
    main.ts                       # Точка входа: config → U7AppEnv → U7App (@u7-scl/app) → UiApp → BotTransport → jobs
    bot.ts                        # createBot(token) — Grammy-бот без сессий (диалогами владеет транспорт)
    context.ts                    # BotContext = Context (реэкспорт BotSession из core)
    config.ts                     # BotConfig (токены, группа школы, админы)
    create-ui-app.ts              # Фабрика U7BotUiApp (контроллеры + actorResolver + transport)
    ensure-registered.ts          # Гост-регистрация пользователя по telegramId
    core/
      u7-bot-controller.ts        # U7BotController — базовый контроллер (префиксация кодов)
      u7-bot-ui-story.ts          # U7BotUiStory — базовая стори (контракт команд ФР-4)
      u7-bot-app-meta.ts          # UI-типы бота; U7BotAppMeta — переэкспорт из @u7-scl/app
      ui-app.ts                   # U7BotUiApp — специализация BotUiApp (init/start)
      u7-menu.ts                  # Декларативные кнопки главного меню
    controllers/
      app/                        # /start, /help, главное меню, сообщество
      courses/                    # Каталог курсов (S00)
      streams/                    # Потоки: каталог, карточка, программа; inactivity-проактивы
      learning/                   # «Моя учёба»: хаб, дерево уроков, шаги, прогресс
      mentor/                     # Инструменты ментора: мои потоки, monitor, wizard создания, активация
      questionnaire/              # Анкета: invite/fill стори, render
      user/                       # Пользовательские уведомления
      shared/
        routes.ts                 # Канонические кросс-контроллерные маршруты
        buttons.ts                # Готовые кнопки (buttons.mainMenu и др.)
    infra/
      bot-transport.ts            # BotTransport — сессии, штампы, сжатие UUID, рендер §5, notify/invite, execute, messenger-events
      short-id.ts                 # Сжатие UUID ↔ короткие id для callback_data
      logger/                     # TelegramLogger
    shared/
      app-codes.ts                # Якоря диалогов приложения (app:main-menu, app/invite, ...)
  tests/
    helpers/
      test-app.ts                 # createTestApp() — ApiApp на временных репозиториях
      test-bot-transport.ts       # TestBotTransport (обёртка реального BotTransport), RecordingBotApi
      fixture-loader.ts           # copy-on-write фикстуры
    fixtures/templates/           # Эталонные JSON-фикстуры
    courses/ streams/ learning/ mentor/   # Интеграционные тесты
    e2e/                          # Сквозные сценарии «пользователь жмёт кнопки»
```

## Поток данных

```
Grammy → BotTransport (сессии, штампы, shortId, per-chat очередь)
       → U7BotUiApp → Controller → Story → appApi (доменные UseCase)
       ← DialogResponse ← ...       ← BotTransport рендерит по §5
```

- **BotTransport** владеет `BotSession` (диалог + активный экран), ставит штампы
  `:~<seq36>` в `callback_data`, сжимает UUID, сериализует апдейты per-chat очередью.
  Превышение лимита Telegram (64 байта) — fail-fast, битая кнопка не уходит.
- **U7BotUiApp** маршрутизирует команды (`/start`, `/help`, `/cancel` — конвейер uiApp,
  доменные команды — стори через `handleCommand`), кнопки и текстовый ввод — активным стори.
- **Контроллер** префиксирует коды кнопок своих стори (`controller:story:action:...`).

## Соглашения

- **Ответы стори** — только `DialogResponse`: `screen` / `finalize` / `notify` /
  `awaitInput` / `release` / `delegate` / `pass`. Ошибки валидации — `errorNotify`.
- **MarkdownV2:** тексты — `MdText`-литералы (`md` / `mdRaw` из `@u7-scl/core/shared`);
  динамические вставки экранируются `escapeMarkdown`. Текст кнопок — всегда plain.
- **Проактивы:** `notify` (без кнопок, вид-заголовок 🔔/ℹ️/⚠️); `invite` — временный
  канал с кнопками (удаляется с tasks-system).
- **Межмодульные вызовы:** через `this.appApi.execute()`.
- **Кросс-стори ссылки:** `this.cbFor(storyName, action, ...args)` внутри контроллера;
  кросс-контроллерные — адрес из `Routes` или готовая кнопка `buttons.mainMenu(text?)`.

## Запуск

```bash
# Разработка (с фикстурами — «театр одного актёра":
# все роли фикстурного мира играешь ты, переключение /persona)
bun run dev:fixtures               # свежий мир при каждом запуске
KEEP_WORLD=1 bun run dev:fixtures  # не пересеивать: текущий мир и правки живут

# Продакшен
NODE_ENV=production bun run runners/u7-bot/src/main.ts
```

## Тестирование

```bash
# Все тесты бота
bun test runners/u7-bot/

# Только конкретный файл
bun test runners/u7-bot/tests/streams/
```

## Связанные документы

- [Архитектура bot-level](../../conductor/architecture/ui/bot-architecture.md)
- [BotController Styleguide](../../conductor/architecture/ui/bot-controller.md) — иерархия, API
- [BotUiStory Styleguide](../../conductor/architecture/ui/bot-ui-story.md) — написание стори
- [Тестирование бота](../../conductor/architecture/ui/bot-test.md) — уровни и правила
- [UI Specs](./src/controllers/) — спецификации экранов по модулям
