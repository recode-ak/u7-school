# Архитектура Telegram-бота (bot-level)

**Назначение:** единый архитектурный разрез UI-слоя Telegram-бота на контракте
«Диалог и Экран» (инварианты — §1, контракты — §2.5, рендер — §3.3, решения — §6):
из чего собран UI, кто чем владеет, как течёт апдейт от Telegram до домена и обратно.

Живой код:
- базовые классы/типы — `platform/core/src/ui/bot/`;
- приложение бота — `runners/u7-bot/src/`;
- транспорт — `runners/u7-bot/src/infra/bot-transport.ts`.

---

## 1. Слои

```
Grammy (адаптер) → BotTransport (сессии, штампы, рендер) → BotUiApp (диалоги, маршрутизация)
                 → Controller (диспетчер сторис) → Story (сценарий) → ApiApp (доменные UC)
```

| Слой | Объект | Где | Ответственность |
|---|---|---|---|
| Адаптер | `createBot`, `BotContext` | `runners/u7-bot/src/bot.ts`, `context.ts` | Grammy-бот; `Context` без сессий (Grammy-session нет) |
| Транспорт | `BotTransport` | `runners/u7-bot/src/infra/bot-transport.ts` | Сессии `BotSession`, штампы `:~seq`, shortId-сжатие, рендер `DialogResponse` (§3.3), per-chat очередь, `ProactiveSender` |
| Хаб | `BotUiApp` / `U7BotUiApp` | `platform/core/src/ui/bot/ui-app.ts`, `runners/u7-bot/src/core/ui-app.ts` | Core: `dialog.path/seq`, `enterDialog`, `dispatch`, delegate-склейка, pipe команд (ФР-4). U7: `/start`, `/help`, `/cancel`, системные коды `app:*`, меню из `menuButtons` |
| Диспетчер | `BotController` / `U7BotController` | `platform/core/src/ui/bot/bot-controller.ts`, `runners/u7-bot/src/core/u7-bot-controller.ts` | Реестр сторис, префиксация кодов `name:`, `handleError`, `errorExitRows` |
| Сценарий | `BotUiStory` / `U7BotUiStory` | `platform/core/src/ui/bot/bot-ui-story.ts`, `runners/u7-bot/src/core/u7-bot-ui-story.ts` | Логика экрана: UC → `DialogResponse`; `awaitInput`-ввод, `contextHelp`, `menuButtons`, `/cancel` в pipe |
| Данные | `DialogResponse` / `Screen` / `BotSession` / `ProactiveSender` | `platform/core/src/ui/bot/types.ts` | Типы между слоями |
| Домен | `ApiApp.execute()` | `platform/core/src/api/` | UseCase'ы доменных модулей |

**Разделение владения:** сессиями и экраном владеет транспорт; диалогом
(`path`/`seq`) — uiApp; логикой сценария — стори; домен никогда не знает о Telegram.

**Инварианты.** И1 — диалог один (до первого `/start` не открыт), смена только через `enterDialog`. И2 — один живой экран: смена экрана или диалога гасит прежний («хлебные крошки», в т.ч. при ответе без `screen`); кнопки не текущего экрана отвергает транспорт без исключений. И3 — проактив не трогает диалог: `notify` — текст без кнопок, сессию не читает и не пишет; временное исключение — `invite` (ФР-6), до модуля задач.

---

## 2. Ключевые объекты

### 2.1. `BotTransport` (транспорт/исполнение)

`runners/u7-bot/src/infra/bot-transport.ts`. Владеет:

- **сессиями `BotSession`** — внутренняя мапа `tgId → { dialog, screen }`
  (создаётся лениво пустой: до первого `/start` диалог не открыт — ФР-1);
- **единым входом слэш-команд (ФР-4)** — перехват `/`-текста в `message:text`
  (`parseCommandText`), без поимённой grammy-регистрации;
- **валидацией callback без исключений (ФР-3)** — порядок: диалог открыт →
  штамп `:~<seq36>` совпал с `dialog.seq` → shortId разжат; иначе alert
  («Наберите /start» / «Экран устарел» / «кнопка устарела после рестарта»);
- **рендер-политикой** (§3.3);
- **сжатием UUID** (`compressAction`/`expandAction` + `short-id.ts`),
  fail-fast лимит `callback_data ≤ 64 байта`;
- **per-chat очередью** на все апдейты и проактивы (строгий порядок на чат).

**Персистентность.** `BotSession` и shortId-мапа переживают рестарт: порт `BotSessionRepo` (`platform/core/src/ui/bot/bot-session-repo.ts`), реализация `JsonBotSessionRepo` (`runners/u7-bot/src/infra/json-bot-session-repo.ts`, `data/bot/`). Запись синхронная после каждого апдейта, восстановление — до старта polling/webhook; старые кнопки остаются нажимаемыми. Повреждённый файл — fail-fast, ошибка записи — warn и работа из памяти.

### 2.2. `BotUiApp` / `U7BotUiApp` (хаб)

`platform/core/src/ui/bot/ui-app.ts`. Core-механика:

- **`enterDialog(session, path, mode)`** — единственная точка инкремента `seq`
  (ФР-2): `switch` (кнопки/мосты/delegate) — смена пути растит seq и сбрасывает
  ввод; `reopen` (`/start`, `/cancel`) — всегда seq++. Штампы прежнего экрана
  становятся мёртвыми — транспорт отправляет send и ретирит старую клавиатуру.
- **`dispatch(data)`** — маршрутизация `controller:story:action...`: вход в
  диалог `controller/story` + делегирование контроллеру.
- **`#resolveDelegate`** — исполняет `delegate.path` (симметрично handleCallback)
  и склеивает ответы (notify — конкатенация; screen/release — приоритет делегата).
- **pipe команд (ФР-4)** — `handleCommand` опрашивает контроллеры (активный
  первым), реакции `pass/continue/stop`; stop с `delegate` исполняется ядром.

`U7BotUiApp` (`runners/u7-bot/src/core/ui-app.ts`) добавляет U7-специфику:
`/start` (гост-регистрация → reopen якоря `app/menu` → welcome из `menuButtons`),
`/help` (контекстная справка активной стори `contextHelp()` или общий справочник),
`/cancel` (сброс активной стори в pipe + глобальный reopen меню; ответ без
`screen` дополняется экраном меню), дефолт «неизвестная команда», перехват
системных кодов `app:main-menu` / `app:help` в `dispatch` (единая точка для
кнопок и delegate).

### 2.3. `BotController` / `U7BotController` (диспетчер)

- `handleCallback` — ищет стори по префиксу `story:`, делегирует, префиксует
  коды ответа (`#prefixResponse`: клавиатуры `screen` + `delegate.path`);
  необработанные ошибки → `handleError` (ошибка = экран, `MdText` через `md`).
- `handleMessage` — делегирует стори активного диалога (`dialog.path`);
  `null` — адресата нет.
- `handleCommand` — pipe стори (активная первой), `pass/continue/stop`.
- `U7BotController.menuButtons(actor): Promise<MenuButton[]>` — сбор кнопок
  главного меню от стори (`Promise.all`, параллельно) с префиксацией и
  сортировкой по приоритету; упавшая проверка видимости скрывает свою кнопку
  (+ warn), меню в целом живо.

### 2.4. `BotUiStory` / `U7BotUiStory` (сценарий)

Сценарий одного экрана: `appApi.execute(...)` → `DialogResponse`. Хелперы:
`cb(action, ...ids)` / `cbFor(story, action, ...ids)`, `confirm(...)`,
`formatDate`, `handleError` (ошибка-экран), `errorNotify` (warn-реплика поверх
диалога — ФР-5, для переспросов при живом `awaitInput`).

`U7BotUiStory` добавляет: `dialogPath`/`isActive` (для `/cancel` в pipe —
сброс себя + stop-реплика), `contextHelp` (контекстная справка), `menuButtons`
(кнопка главного меню), `errorExitRows` — «⬅️ Меню» на экранах ошибок.

### 2.5. Типы (`platform/core/src/ui/bot/types.ts`)

```ts
DialogResponse  // screen? / finalize? / notify? / awaitInput? / release? / delegate?
Screen          // text: MdText + keyboard?
BotSession      // dialog?: { path, seq, input? }, screen?: { messageId, ownerSeq, ... }
ProactiveSender // notify / invite (временный, ФР-6) / kickFromGroup
CommandReaction // pass | continue{notice} | stop{response}   (pipe команд)
```

Стори/контроллеры возвращают `DialogResponse`; `delegate` до транспорта не
доходит — его исполняет uiApp. Тексты — `MdText` (`md`/`mdRaw`/`mdConcat` —
см. [bot-ui-story.md](./bot-ui-story.md), §4).

---

## 3. Поток обработки

### 3.1. Вход апдейтов (`main.ts`)

Регистрация без поимённых команд: `privateBot.on('callback_query:data')`,
`privateBot.on('message:text')` → транспорт. Слэш-тексты перехватываются
транспортом по `/`-префиксу и уходят в pipe uiApp; `/start` — приветствие +
меню (reopen), `/help` — справка, `/cancel` — сброс + короткое меню. Прочие
тексты — ввод только при живом `dialog.input`, иначе подсказка. Групповые
события (`chat_member`, FR-7) — отдельные обработчики `handlers/group-handler.ts`.

### 3.2. Нажатие кнопки

```
Grammy callback_query.data
  → BotTransport: очередь → валидация (диалог / штамп / shortId)
  → BotUiApp.handleCallback → dispatch(controller:story:action)
    → enterDialog(switch) → Controller.handleCallback → Story.handleCallback
      → appApi.execute(UC) → DialogResponse
  ← delegate? → #resolveDelegate (маршрут + склейка)
  → BotTransport.#render (§3.3): notify → finalize → screen → awaitInput/release
```

### 3.3. Рендер-политика (владелец — транспорт)

1. **`notify`** — реплика поверх диалога (первой, заголовок по `kind`:
   🔔/ℹ️/⚠️), сессию, экран и ввод не трогает.
2. Гашение устаревшего экрана при любом ответе («хлебные крошки»): смена
   диалога без `screen` не оставляет мёртвую клавиатуру.
3. **`finalize`** — перезапись своего экрана (фиксация выбора), клавиатура
   снимается; чужой экран — warn-лог и пропуск.
4. **`screen`** — свой экран (ownerSeq = seq, без finalize/newMessage) →
   edit на месте; иначе retire прежнего (с маркером «Вы выбрали: …» при
   известном коде нажатой кнопки) + send нового; новый messageId становится
   `session.screen`. `newMessage: true` — экран доставляется новым сообщением
   даже для своего экрана: прежний гасится с маркером «Вы выбрали: …»
   (текст сохраняется, клавиатура снимается), затем send — для пошаговой
   выдачи (шаги обучения), где история сообщений — часть UX.
5. **`awaitInput` / `release`** — установка/снятие ожидания текстового ввода
   (`dialog.input.context`).

### 3.4. Проактивные каналы (`ProactiveSender`)

- **`notify(telegramId, { text, kind })`** — единственный постоянный проактив
  (И3): не трогает сессию/экран/диалог. Источники — подписки стори на доменные
  события (`getEventSubscriptions` + `uiApp.start()`); тексты домена — plain,
  экранирование и 🔔-рендер — в стори/транспорте. Чистые уведомления без
  подписчиков — тихий no-op (u7-cli).
- **`invite(telegramId, { text, keyboard })`** — ВРЕМЕННЫЙ проактив с кнопками
  (ФР-6, удаляется с tasks-system): кнопки штампуются seq диалога получателя;
  без диалога открывается временный якорь `app/invite` (seq = 1).
- **`kickFromGroup(groupId, userId)`** — мягкий кик (ban 60с + unban).

---

## 4. Формат `callback_data`

Формат: `controller:story:action[:...ids]:~<seq36>`.

- **Префиксация** — в `BotController`: стори возвращает `story:action`,
  контроллер добавляет `controller:`; коды с чужим префиксом (`app:main-menu`)
  не трогаются. Кросс-контроллерные адреса — реестр `Routes`
  (`runners/u7-bot/src/controllers/shared/routes.ts`), готовые кнопки —
  `buttons.mainMenu(text?)` (`shared/buttons.ts`).
- **Штамп `:~<seq36>`** — в транспорте при отправке (после сжатия); сверка на
  входе. Убивает кнопки старых экранов, истории, гонок и рестартов.
- **Сжатие UUID** — в транспорте (`shortIds`, первые 8 hex + суффикс при
  коллизии); гарантия ≤ 64 байта — fail-fast, не ошибка Telegram API.
- **Системные коды** `app:main-menu` / `app:help` (`shared/app-codes.ts`) —
  перехватываются `U7BotUiApp.dispatch` до маршрутизации; транспорт их не сжимает.

---

## 5. Сборка приложения (`main.ts`)

1. `config = loadConfig(process.env)` (окружение читает только `main.ts`, ARC-09) → логгер.
2. `bot = createBot(token)` (без сессий).
3. `apiBundle = createApiApp(...)` — домены + репозитории.
4. `uiBundle = createUiApp(...)` — контроллеры + `U7BotUiApp` (без init).
5. `transport = new BotTransport(uiApp, bot.api)`.
6. `uiApp.init(resolve, transport)` — каскад вниз до стори; `uiApp.start()` —
   подписки стори на события (до старта job'ов); `apiApp.start()` — job'ы.
7. Верификация админа, group-хендлеры, регистрация grammy-обработчиков,
   allowed_updates (`chat_member` — явно), polling/webhook, graceful shutdown.

---

## 6. Принятые решения

- Диалог не открыт до `/start`; ленивого фиктивного меню нет, якорь `app/menu` нужен только для `seq`.
- Проактивный запуск диалога запрещён: диалог открывает только действие пользователя, сервер лишь зовёт.
- `/start` и `/help` идут мимо pipe команд: активность стори проверяет uiApp, неактивная стори на `/help` не отвечает.
- Ядро имён команд не знает; меню — декларативные `menuButtons`, словаря команд и `setMyCommands` нет.
- Серия экранов в контракт не входит (`newMessage` — единственный путь пошаговой выдачи); TTL ввода удалён как мёртвый — бездействие обслуживают доменные sweep и задачи.
- Системные коды и якоря (`app:main-menu`, `app:help`, `app/menu`, `app/invite`) — один модуль `runners/u7-bot/src/shared/app-codes.ts`.
- Экраны ошибок получают кнопку выхода от приложения (`errorExitRows`); `errorNotify` — реплика-переспрос без захвата экрана.

## 7. Связанные документы

- [BotController Styleguide](./bot-controller.md)
- [BotUiStory Styleguide](./bot-ui-story.md)
- [Тестирование бота](./bot-test.md)
- [Границы архитектуры](../../../node_modules/dmg-core/docs/reference/layers.md), [Domain boundaries](../../../node_modules/dmg-core/docs/reference/domain-modeling.md)
- Концепция: [bot-ui-concept.md](../../guides/bot-ui-concept.md); вход будущего UI-слоя — [dmg-ui-entry.md](../../roadmap/dmg-ui-entry.md)
