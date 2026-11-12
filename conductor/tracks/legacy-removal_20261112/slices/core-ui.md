# Бриф среза: core-ui (Ф3) — `core/ui` и бот без legacy

Черновик `dmg-tech-lead` (Sonnet). Трек `legacy-removal_20261112`. Раскладка файлов — [removal.md](./removal.md); строки этого брифа: все `platform/core/src/ui/**` (22 файла, правки — 11), `shared/serialize-error.ts`, `domain/common/notify-kind.ts`, `domain/errors/*` (замена потребителей), тесты `ui` и бота.

## Границы

Правим:
- `platform/core/src/ui/**`: `event-subscription.ts`, `types.ts`, `ui-app.ts`, `ui-controller.ts`/`ui-story.ts` (по тайпчеку), `ui/index.ts`; `bot/{app-types,bot-controller,bot-ui-story,types,ui-app}.ts`; импорты `#domain-legacy/*`, `#api-legacy/*`, `#ui-legacy/*`, `#shared-legacy/*` внутри `ui` → относительные.
- `platform/core/src/shared/serialize-error.ts` — убрать ветку `AppException`.
- `runners/u7-bot/src`: `core/{u7-bot-app-meta,u7-bot-controller,u7-bot-ui-story,ui-app}.ts` (закрывающие типы без `U7BotAppMeta`), `config.ts` (`AppEnvMode` → `AppMode` из `dmg-core/app`), 8 stories с подписками (+ `questionnaire/stories/questionnaire-events.ts` — типы событий); тесты и помощники — список ниже.
- `platform/app/src/u7-app.ts` и `platform/app/tests/u7-app.test.ts` — **минимально**, если принят вариант A (см. «Решения брифа» п. 1).

Не трогаем: `platform/core/src/{api,domain,infra,legacy-bridge}` (удаляет Ф5; `domain/*` теряет потребителей), `app-legacy`, импорты `@u7-scl/app-legacy`/`core/infra` в `runners` (Ф4), `u7-cli`, `data/`, сами модули и домен.

## Решения брифа

1. **Красная зона Ф3–Ф4 — избежать (вариант A, рекомендую).** Тип `appApi` в UI станет `ApiApp` из `dmg-core/app`; но `U7App.apiApp` сегодня — legacy-оболочка `ApiApp<U7BotAppMeta>` (`platform/app/src/u7-app.ts:72, 129`), класс с приватными полями несовместим с dmg `ApiApp`. Вариант A: в Ф3 `U7App` отдаёт наружу `apiApp: DmgApiApp<Identified>` (тот же `dmg.api`) и `eventBus` = шина DMG (`context.bus` из `legacyEventBus`), а legacy-оболочка и legacy-шина остаются **приватными** до Ф4 (оболочка нужна только для `init`/`start`/`stop` планировщика). Правка `u7-app.ts` — несколько строк; `u7-app.test.ts` — 4 утверждения (`getModule(...)` ×5, `appResolver.eventBus`-сравнение, повторный `apiApp.init`). Тогда `check` зелёный на конце Ф3 и красной зоны (план, «Красная зона Ф3–Ф4») нет.
   - **Вариант B (по плану):** UI на типах DMG, `U7App` без правок; падающие тесты бота/e2e — поимённо в `debt.md` до конца Ф4. Выбрать, если A не удаётся (например, `legacyEventBus` не отдаёт публикацию подписчикам `UiApp` по `def`: проверяется тестом `u7-app` — публикация конверта на `app.eventBus` доходит до подписки).
   - Если A принят — в Ф4 из `assembly.md` остаётся удалить приватные legacy-поля.
2. **Подписка по Def.** `UiEventSubscription<D extends AnyEventDef> = { readonly def: D; handle(envelope: EnvelopeOf<D>): Promise<void> }` (метод, не свойство-стрелка — массивы разнотипных подписок присваиваются `UiEventSubscription[]`); `eventSubscription(def, handle)`. `UiApp.subscribeEvents`: `eventBus.subscribe(subscription.def, subscription.handle)`. `UiAppResolve.eventBus: EventBus` из `dmg-core/app`. Имя события — `subscription.def.name` (тесты: `s.eventName` → `s.def.name`).
3. **Типы событий stories** — `EnvelopeOf<typeof WishEvents.confirmed>` и т.п. вместо `DomainEvent & { eventName; payload }` (`wish-confirmed.story.ts:21-24`, `questionnaire-events.ts:9-35`). `payload` — по схеме Def (не меняется); истории читают только `event.payload.*` (grep `event\.\(occurredAt\|eventId\|aggregate\)` по `runners/u7-bot/src` — пусто) → `occurredAt: number` на поведение не влияет, но тестовые события строятся как конверты (`occurredAt` числом).
4. **`handleError(err: unknown)`** в `BotUiStory` (`bot-ui-story.ts:304-348`) и `BotController` (`bot-controller.ts:355+`): `fromError`/`AppException` удаляются. Локальный разбор: любое необработанное исключение → **internal**: `error`-лог (`serializeError(err)`) и общее сообщение «Произошла внутренняя ошибка» (текст и клавиатура выхода `errorExitRows` — без изменений). Ветки `validation`/`not-found`/`conflict`/`access-denied`/`bad-request` в `handleError` и `errorNotify` недостижимы (живых источников `AppException` нет: `throw*` вне `platform/core` — 0, `inventory.md` §6) и **удаляются**; отказы UC DMG идут через `ucErrorNotify` (не меняется). `serializeError` — ветка `AppException` удаляется (`Error` и «прочее» остаются).
5. **`NotifyKind`** — тип в `ui/bot/types.ts`: `export type NotifyKind = 'notify' | 'info' | 'warn'` (`NoticeKind = NotifyKind` остаётся). `NOTIFY_KINDS`/`NotifyKindSchema` потребителей не имеют — не переносятся.
6. **`BotUiAppResolve`** теряет `TAppMeta`: `BotUiAppResolve<TActor extends PersonCaller = PersonCaller> extends UiAppResolve { actorResolver; appApi: ApiApp<Identified> }`; тот же шаг в `BotController`, `BotUiStory`, `BotUiApp` (`ui-app.ts:27-37`), `U7BotUiAppResolve extends BotUiAppResolve<U7BotActor>`. Типа `AppMeta` в проекте не остаётся.
7. **Помощники тестов:** `runners/u7-bot/tests/helpers/test-bot-transport.ts` (`new InProcEventBus()` из `core/infra` → `InProcEventBus` из `dmg-core/app` с логгером) и `test-app.ts` (`EventBus` из `core/domain` → из `dmg-core/app`) — переводятся в Ф3, чтобы подписки stories проверялись на шине DMG. Помощник конверта для тестов — `envelopeOf(def, payload, overrides?)` в `runners/u7-bot/tests/helpers/` (новый; поля `eventId`, `occurredAt`, `aggregateId`, `cause`, `correlationId` — по `EventEnvelope`), используют e2e и тесты stories.

## Шаги

1. **`dmg-test-designer` (Sonnet)** — red-тесты (перечень ниже) + помощник `envelopeOf`; не использует `.skip`; удаляет перечисленные ниже `AppException`-тесты, список «удалён → где покрыт» — в отчёте.
2. **`migrator` — два подшага:**
   - **3a (Sonnet, а не flash):** `ui` (п. 2, 4, 5, 6) и `serialize-error`; видимое поведение сообщений об ошибках и подписок — у flash две регрессии видимого поведения (`deepseek.md` §2, «UI / stories с Сохраняемым поведением»).
   - **3b (flash):** 8 stories (14 подписок: `inactivity.story` ×3, `hub` ×1, `peer-review/invite.story` ×1, `review-notify.story` ×1, `questionnaire/invite.story` ×1, `questionnaire/fill.story` ×4, `wish-invite.story` ×1, `wish-confirmed.story` ×1), `questionnaire-events.ts`, закрывающие типы бота, `config.ts`, `U7App` по варианту A. Механика по готовым тестам и grep-критериям; каждое поручение, похожее на «правку старых тестов» (замена `eventName` → `def`, конверт вместо legacy-события в e2e) — отдельной строкой в промпте: оба исполнителя раньше пропускали перевод legacy-публикаций, считая его ослаблением.
3. **Гейт:** `bun run scripts/agent-gate.ts`; `git diff --numstat` на тестах (удаления — только по списку); grep-критерии ниже; `bun run test:bot`.
4. **`dmg-reviewer` (Opus).**

## Было → станет

| Было | Станет | Ссылка |
|---|---|---|
| `UiEventSubscription<TEvent extends DomainEvent>`: `eventName`, `handle(event)` | `UiEventSubscription<D extends AnyEventDef>`: `def`, `handle(EnvelopeOf<D>)` | `ui/event-subscription.ts` |
| `UiAppResolve.eventBus` — legacy `EventBus` | `EventBus` из `dmg-core/app` | `ui/types.ts:1-9` |
| `UiApp.subscribeEvents`: `subscribe(eventName, handle)` | `subscribe(def, handle)` | `ui/ui-app.ts:77-90` |
| `BotUiAppResolve<TAppMeta, TActor>`, `appApi: ApiApp<TAppMeta>` (legacy) | `BotUiAppResolve<TActor>`, `appApi: ApiApp<Identified>` (dmg) | `ui/bot/app-types.ts:7-17` |
| `BotController/BotUiStory/BotUiApp<TAppMeta, TActor, TResolve>` | без `TAppMeta` | `ui/bot/bot-controller.ts`, `bot-ui-story.ts`, `ui-app.ts:27-37` |
| `handleError`: `fromError` → 6 веток по `kind` | локальный разбор `unknown` → internal | `bot-ui-story.ts:304-348`, `bot-controller.ts:355` |
| `errorNotify`: `fromError` → ветки по `kind` | то же | `bot-ui-story.ts:410+` |
| `serializeError`: ветка `AppException` | убрана | `shared/serialize-error.ts:17-40` |
| `NotifyKind` из `#domain-legacy/common/notify-kind` | объявлен в `ui/bot/types.ts` | `ui/bot/types.ts:3` |
| `U7BotUiAppResolve extends BotUiAppResolve<U7BotAppMeta, U7BotActor>` | `BotUiAppResolve<U7BotActor>` | `runners/u7-bot/src/core/u7-bot-app-meta.ts:19-20` |
| `config.ts`: `AppEnvMode` из `@u7-scl/core/domain` | `AppMode` из `dmg-core/app` | `runners/u7-bot/src/config.ts:1` |
| stories: `DomainEvent & { eventName; payload }` | `EnvelopeOf<typeof XEvents.y>` | 8 stories, `questionnaire-events.ts` |
| `U7App.apiApp`: legacy оболочка, `eventBus`: legacy шина (вариант A) | `apiApp`: `DmgApiApp<Identified>`, `eventBus`: шина DMG; оболочка приватна | `platform/app/src/u7-app.ts:72-75, 129, 141` |

## Сохраняемое поведение

- Видимые пользователю экраны и реплики не меняются: общее сообщение «Произошла внутренняя ошибка…» (экран) и `ucErrorNotify` для отказов UC (label, перечень полей валидации, `denyMessage`) — дословно; кнопка выхода `errorExitRows` на экране ошибки — как есть.
- Единственное изменение: исключение с типом `AppException` (в живом коде не бросается) теперь показывается как `internal`, а не по своему `kind`.
- Подписки stories: те же 14 событий, те же обработчики (`#handle*`), порядок и условия «молчаливых пропусков» не меняются; проактивные уведомления (`notify`, `invite`) — без изменений.
- Повторы: `UiApp.start()` не дублирует обработчики; `stop()` отписывает все (`ui-app.test.ts`).
- Журнал: `logger.error('bot', 'Ошибка в story', serializeError(err))` — формат meta не меняется для `Error`/прочего.
- **Тесты, закрепляющие состав модуля/подписок** (grep `getEventSubscriptions|eventName` по `*.test.ts`): `controllers/questionnaire/stories/inventory.test.ts:158` (`s.eventName` → `s.def.name`), `fill.dialog.test.ts:474` (то же), `questionnaire-dmg.test-kit.ts:171-176` (`subscriptionOf`) — **меняются**; `core/ui-app.test.ts:124`, `create-ui-app.test.ts:48`, `app-controller.test.ts:141`, `infra/bot-transport.test.ts:1554` — моки `eventBus: {} as never` — не меняются. Вне границ среза закрепляющих состав тестов нет.

### Тесты Ф3: что меняется (счёт `test()`/`it()`, `test.each` — один вызов)

Правка по типам/конвертам (поведение то же):
- `platform/core/src/ui/ui-app.test.ts` (9) и `ui-controller.test.ts` (3) — подписки по Def, события-конверты;
- `ui/bot/ui-app.test.ts` (30), `dialog-cache.test.ts` (11) — моки `ApiApp`/шины;
- `runners/u7-bot/src/controllers/…`: `courses/stories/wish-confirmed.story.test.ts` (4), `wish-invite.story.test.ts` (8), `learning/stories/hub.test.ts` (17), `peer-review/stories/invite.story.test.ts` (13), `review-notify.story.test.ts` (4), `streams/stories/inactivity.story.test.ts` (23), `questionnaire/stories/{inventory (7), fill.dialog (18+), invite.story.dmg (17), fill.story.events (5)}.test.ts`, `questionnaire-dmg.test-kit.ts` (помощник: `baseEvent` → конверт, `subscriptionOf`);
- e2e, публикующие legacy-форму напрямую в `app.eventBus.publish({ eventName, occurredAt: '…' … })`: `tests/e2e/inactivity.e2e.test.ts` (7; 3 публикации), `questionnaire-events.e2e.test.ts` (3; 1), `questionnaire-ux.e2e.test.ts` (1; 1) — публикуют конверт DMG (`occurredAt` числом) — **расхождение с планом**, который их не называет;
- `runners/u7-bot/tests/helpers/{test-bot-transport,test-app}.ts` — шина DMG.

Удаляются вместе с веткой `AppException` (TST-08: логика `handleError` сузилась; покрыта оставшимися тестами «internal»/«обычный Error»/`ucErrorNotify`):
- `platform/core/src/ui/bot/bot-ui-story.test.ts` (27): «validation с issues → экран-список полей» (`:288`), «validation без issues → общий экран» (`:308`), `test.each` «not-found/conflict/access-denied/bad-request → экран с текстом» (`:322`), `test.each` «internal/unauthorized → общий экран» (`:353`; кейс «internal» покрыт переписанным `:484`), `errorNotify` «validation с issues → warn-реплика» (`:426`), `test.each` «not-found…bad-request» errorNotify (`:453`) — **6 вызовов `test()`**; переписать с `new Error(...)`: хук `errorExitRows` (`:379`, `:414`) и «internal → общее сообщение» (`:484`).
- `runners/u7-bot/src/core/u7-bot-ui-story.test.ts` (43): `describe` `handleError`: «validation error» (2: `:150`, `:172`), «not-found» (`:188`), «conflict» (`:201`), «access-denied» (`:214`), «bad-request» (`:227`), «internal error» (`:240`, дубль «обычного Error» `:268`), «unauthorized» (`:256`), «MarkdownV2-безопасность»: validation ×2 (`:303`, `:320`) — **10 `test()`**; переписать на `new Error`: `:293` («internal: fallback-текст»), `:346` и `:383` (кнопка «⬅️ Меню» на экране ошибки).
- `platform/core/src/ui/bot/bot-controller.test.ts` (25): «validation с issues → экран-список» (`:553`) — **1 `test()`**; переписать: `:332`, `:411` (ожидается общий internal-экран вместо текста `AppException`), `:583`, `:602` (хуки).
- Итого удалено **17 вызовов `test()`** (3 из них — `test.each` по 2–4 кейса), число к базовой линии Ф0 сверять с поправкой на кейсы `test.each`.

## Внешние зависимости

- `dmg-core/app`: `ApiApp`, `EventBus`, `EnvelopeOf`, `InProcEventBus`, `AppMode`; `dmg-core`: `AnyEventDef`, `Identified`, `PersonCaller`.
- Домен: Def событий из контрактов (`@u7-scl/domain/{wish,questionnaire,stream,peer-review}/contract`) — stories уже импортируют их (`WishEvents` и т.п.); новых связей нет. `core/ui` в `dmg-core` — единственная новая зависимость `core` (уже в `platform/core/package.json`); импортов `@u7-scl/domain` в `core` нет (ARC-01).
- Входящих событий и контрактов чужих модулей не меняем.

## Открытые вопросы

Стратегических нет.

Тактические (предлагаемое решение):
1. Вариант A или B (п. 1) — **A**; при провале A — B с записью красной зоны в TR/`debt.md`.
2. `UiEventSubscription` — свойство `def` вместо `eventName`: **`def`** (по Def подписывается шина; имя — `def.name`).
3. `ui-controller.ts`/`ui-story.ts` — правятся только при ошибке типа (`UiEventSubscription[]`).
4. Оставить `shared` целиком (ConsoleLogger, now, serialize-error…) — это решение Ф5 (`removal.md`, вопрос С3).

## Правила (ID `rules.md`)

ARC-01 (core не импортирует домен/приложение), ARC-04/ARC-08 (бот — только `contract` домена), ERR-06/ERR-07 (необработанное не замалчивается: error-лог), ERR-05 (ошибка не знает тексты UI — тексты экрана остаются в `ui`), TST-05 (правки в области задачи), TST-06, TST-08 (список «удалён → где покрыт»), TST-09, CODE-04, DOM-12 (`occurredAt` — `Timestamp`).

## Документы

Срез не правит `dmg-core`. Проектные: `conductor/architecture/ui/bot-architecture.md` (упоминания legacy `ApiApp`/`DomainEvent`) — Ф7 (`documentarian`), если ссылки есть: `grep -n "DomainEvent\|AppException\|TAppMeta" conductor/architecture/ui/*.md`.

## Критерии приёмки

- `grep -rn "#[a-z]*-legacy/\|@u7-scl/core/domain\|@u7-scl/core/api" platform/core/src/ui runners/u7-bot --include=*.ts` — пусто (с `node_modules`, `conductor/archive` исключены самим путём).
- `grep -rn "DomainEvent\|AppException\|fromError\|AppMeta\b\|TAppMeta" platform/core/src/ui platform/core/src/shared runners --include=*.ts` — пусто (`platform/core/src/{domain,api}` не проверяются: удаляет Ф5).
- `grep -rn "eventName" platform/core/src/ui runners/u7-bot --include=*.ts` — пусто, кроме `domain`-полей payload (проверить вручную каждое вхождение).
- `grep -n "NotifyKind" platform/core/src/ui/bot/types.ts` — объявление есть; `grep -rn "domain-legacy/common/notify-kind" platform/core/src/ui` — пусто.
- Вариант A: `grep -n "ApiApp<U7BotAppMeta>\|legacyEventBus\b" platform/app/src/u7-app.ts` — только приватные поля/комментарий до Ф4; `U7App['apiApp']` — dmg `ApiApp`.
- `bun run test:bot` и e2e зелёные (A) либо падения — поимённо в `debt.md` (B); `bun run check` зелёный (A); число тестов: база Ф0 − 17 удалённых вызовов (с учётом `test.each`) — все прочие сценарии на месте.
- `bun run arch:check` зелёный.
