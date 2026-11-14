# Бриф: перевод тестов на общие хелперы (Ф4)

> Трек `pre-dmg-ui-cleanup`, Фаза 4. База повторов — `summary.md`, Ф0 (те же команды grep). Карта собрана Sonnet (`Explore`), решения — orchestrator.

## Границы

- Только тестовый код: `*.test.ts`, `*.fixture.ts`, `*.test-kit.ts`, `runners/u7-bot/tests/**`. Прод-код не трогать. `data/` не трогать.
- `dmg-core` не правим: всё нужное уже есть в `dmg-core/testing` (`TEST_TRACE`, `testTrace`, `testUuid`, `TempDir`, `useTempDir`) — API в `node_modules/dmg-core/docs/reference/testing.md`.
- **Не переводим** (исключения, итог сравнения с Ф0 их перечисляет):
  - unit-тесты stories `runners/u7-bot/src/controllers/*/stories/*.test.ts` — перепишет dmg-ui. Внутри них — только записи T-DEBT (ниже); `findBtn`, UUID-литералы остаются.
  - UC/ER/module-тесты `modules/wish` и `modules/peer-review` (16 файлов с `mkdtemp`, `'r-1'`) — Ф5 переводит их на фейки репозиториев; двойная работа не нужна. `mkdtemp` в них уходит в Ф5.
  - `repoWith` в 11 `*.json-repo.test.ts` — однострочная фабрика над конкретным классом репозитория; общий хелпер кода не уменьшит. Остаётся, но на `TempDir` (см. П1).
  - `makeUiApp` в `platform/core/src/ui/**` и `runners/u7-bot/src/core/ui-app.test.ts` — разные функции.
  - `waitUntil` в `modules/peer-review/src/peer-review.module.test.ts` — другая семантика (бросает, возвращает значение).
  - Боевой `U7_SCHOOL_ID`, `Trace.fromRequest` вне тестов, `.pi/extensions/**`.
  - `requestId` вида `tg:<n>#<m>` (`platform/app/tests/u7-app.test.ts:263`, `e2e/update-replay`) — проверяется явно.
  - UUID-константы (`COURSE_ID = 'cb200001-…'`) — литерал читается лучше `testUuid(1, 'cb200001')`. Заменяются только локальные генераторы `id(n)` / `U(n)`.
  - Каталоги миров (`tests/worlds/materializer.ts`, `fixture-loader.ts`) — своя подсистема.

## Целевые хелперы

### Из `dmg-core/testing` (готовы)

| Было | Стало | Условие |
|---|---|---|
| `Trace.fromRequest({ requestId: 'r-1' })` | `TEST_TRACE` | один запрос на тест или replay не задействован |
| `Trace.fromRequest({ requestId: crypto.randomUUID() })`, локальные `trace()`/`req()`/`cmd(n)` | `testTrace()` | «свежий id на команду» (D-56) |
| `requestId: 'r-1'` в `cause` событий | `TEST_TRACE.requestId`, если сверяется со следом команды; иначе — как есть | |
| `mkdtemp` + `beforeEach`/`afterEach` + `rm` | `const dir = useTempDir('<префикс>-')`, путь — `dir().file(...)` (сверь API по `testing.md`) | |
| `mkdtemp` на уровне файла/describe + `afterAll(rm)` | `TempDir.create('<префикс>-')` в `beforeAll`, `dispose()` в `afterAll` | тесты делят каталог |
| `mkdtemp` + `try/finally rm` внутри теста | `using dir = TempDir.create('<префикс>-')` | tsconfig — `ESNext`, `using` доступен |
| локальные `id(n)`, `U(n)` | `testUuid(n, '<префикс>')` | сверь n ≥ 10: локальный генератор давал другой хвост |

Префикс каталога — прежний (читаемость); хардкод `/tmp/` уходит в `os.tmpdir()` через `TempDir`.

### Новые в боте

**`runners/u7-bot/tests/helpers/`** (интеграция и e2e):

| Хелпер | API | Закрывает |
|---|---|---|
| `TestBotTransport.press(tgId, textContains)` | метод: `handleCallback(makeBotContext(tgId, { callbackData: pressedCode(this, tgId, text) }))` | `press` групп A, B, C (16 определений) |
| `TestBotTransport.pressRaw(tgId, rawCode)` | метод: нажатие готового кода со штампом (`stampedCode`) | `press(rawCode)`, `pressCode`, `pressRaw`, `craft` в e2e |
| `TestBotTransport.waitForMessage(tgId, { contains?, timeoutMs? = 3000 }): Promise<string \| undefined>` | опрос `api.sentMessages` раз в 20 мс | `waitMessageFor`, `waitMessageContaining`, `waitForSentTo` |
| `Screen` (класс, `screen.ts`) | `Screen.of(response)`: `buttons(): Button[]`, `texts(): string[]`, `codes(): string[]`, `button(textContains): Button` (бросает «Кнопка «…» не найдена») | `buttonsOf`, `buttonTexts`, `codesOf`, `findButton`, `clickButton`-поиск |
| `waitUntil(probe, timeoutMs = 3000): Promise<void>` (`wait-until.ts`) | универсальная утилита опроса; при таймауте **не бросает** (как сейчас) | 5 копий в `e2e/peer-review-*` |

Особые `press` не объединять силой: `e2e/pagination` (свой экран и `assertDialogResponseMarkdownSafe`), `e2e/school` и `courses/course-catalog.integration` (кнопка из переданного `response`) — перевести на `Screen.of(response).button(text)` + `pressRaw`, если поведение то же; иначе оставить и записать в отчёт.

**`runners/u7-bot/src/`** (unit, не stories):

| Хелпер | Где | Закрывает |
|---|---|---|
| `mockLogger()` — `Logger` из `@u7-scl/core/shared` из `mock`-функций (7 методов) | `src/core/logger.test-kit.ts` | `makeLogger` ×5. `MemoryLogger` не подходит: другой интерфейс, тесты проверяют `toHaveBeenCalled*` |
| `makeUiApp`, `makeCtx`, `kb` для транспорта | `src/infra/bot-transport.test-kit.ts` | копии в `bot-transport.test.ts` и `bot-transport-persist.test.ts` |
| `subscriptionOf(story, name)` | `src/core/story.test-kit.ts` | `subHandler`/`subscriptionOf` ×3+ (T-DEBT-5; запись указывала `tests/helpers` — unit-тесты из `src` туда не ходят, место уточнено) |

`domain/src/<m>/testing.ts` новых не нужно: межмодульных фикстур перевод не требует.

## Пачки (S, роль `migrator`)

Каждая пачка — гейт `bun run scripts/agent-gate.ts`, число тестов до/после в отчёте.

- **П0 — хелперы бота** (задача 2): red-тесты `Screen` и новых методов `TestBotTransport` (в `test-bot-transport`/рядом) → реализация; `mockLogger`, `bot-transport.test-kit.ts`, `story.test-kit.ts` — без своих тестов (проверяются потребителями).
- **П1 — модули и платформа:** `TEST_TRACE` в 4 `*-uc.fixture.ts` (`export const REQ` → реэкспорт или прямой импорт `TEST_TRACE`) и их потребителях; `testTrace()` в `user.module.test.ts`, `questionnaire.module.test.ts`; `TempDir` в 9 `*.json-repo.test.ts` вне wish/peer-review (`repoWith` пишет в `dir.file(name)`; общий файл `users.json` в `user.json-repo.test.ts` — сохранить общий каталог на describe); `user.module.test.ts`, `questionnaire.module.test.ts`; `platform/app/**` (`u7-app*.test.ts`, `u7-caller-resolver.test.ts`, `job-run-json-repo`, `file-replay-store`); `testUuid` — `domain/src/stream/*.dqs.test.ts`.
- **П2 — scripts:** `TempDir`/`using` в `scripts/*.test.ts`, `testUuid` в `stream-snapshot-sync.test.ts`.
- **П3 — бот, tests/:** `press`/`pressRaw`/`waitForMessage`/`Screen`/`waitUntil`/`testTrace()` во всех `tests/e2e`, `tests/<module>`, `tests/helpers` (`test-app.ts`, `student-fate.ts`); `transport.e2e` — `using TempDir`; T-DEBT-7.
- **П4 — бот, src/:** `mockLogger`, `bot-transport.test-kit.ts`, `useTempDir` в `json-bot-session-repo.test.ts` и `bot-transport-persist.test.ts`; `subscriptionOf` (T-DEBT-5); T-DEBT-2, T-DEBT-3, T-DEBT-4; T-DEBT-1 (домен).

T-DEBT: решения записаны в `conductor/debt/tests.md` — выполнить как записано; удалённые тесты — список в отчёте (файл, имя, где покрыто).

## Правила

- Поведение тестов не меняется: те же утверждения, то же число `it` (кроме T-DEBT).
- `useTempDir` бросает при вызове геттера вне теста — в `beforeAll` и на уровне модуля не использовать.
- Импорты — `import { … } from 'dmg-core/testing'`; `biome check` — причину, не глушить.
- Не трогать `conductor/`, не коммитить.

## Критерии приёмки

- grep из базы Ф0 (без исключений выше): `Trace.fromRequest({ requestId` — 0 в тестах; `mkdtemp` — 0 вне wish/peer-review (до Ф5); определения `press`, `buttonsOf`, `waitMessageFor`, `waitUntil`, `makeLogger`, `subHandler` — только хелперы и перечисленные исключения.
- `CI=true bun run check` и `bun run test:bot` зелёные; тестов ≥ базы минус удалённые по T-DEBT.
- T-DEBT-1…5, 7 закрыты (удаляет orchestrator, коммит `закрыть T-DEBT-n`).

## Отчёты

<!-- отчёты авторов и ревьюера — ниже -->
