# Бриф Ф5.1: харнес e2e бота

Трек `revision-release_20261112`, строки F-01…F-05 [fixes.md](../fixes.md). Роль — `dmg-test-designer`. Только тестовая инфраструктура и мир фикстур; прод-код (`runners/u7-bot/src/**`, `domain/`, `modules/`) не меняется.

## Границы

- Можно: `runners/u7-bot/tests/helpers/**`, `runners/u7-bot/tests/worlds/**`, тесты самих хелперов (`*.test.ts` рядом).
- Нельзя: прод-код, `conductor/`, `data/` (кроме генерации `data/fixtures` штатной командой мира, если она часть теста), `node_modules/`, коммиты.
- Нужна правка прод-кода (например, точка подмены часов в сборке приложения) — эскалация с предложением, не правка.

## Шаги

1. **F-01 Управляемые часы.** `createTestApp` (`tests/helpers/test-app.ts`) получает управляемые часы: старт с заданного момента, `advance(ms)`/`set(at)`; их видят UC/ER/Job (`this.now()`) и планировщик, если он участвует. Сначала найди, откуда сборка берёт часы (`createU7App` / `dmgApp`, `Clock` в `dmg-core`), — если подмена уже возможна параметром, используй его. Проверка — тест хелпера: Job `sweepAbandonedQuestionnaires` после `advance(3 ч)` даёт `continueInvite` (P7-49) — это и будущий образец для F-15/F-17. Существующие тесты без часов работают как прежде (по умолчанию — реальное время или нынешнее поведение).
2. **F-02 События групп через транспорт.** В `TestBotTransport` (`tests/helpers/test-bot-transport.ts`) — `chatMember(...)` / `myChatMember(...)`, которые строят апдейт grammy и отдают его **обработчику транспорта** (`handleChatMember` / `handleMyChatMember` реального `BotTransport`), а не `uiApp.handleMessengerEvent`. Регистрацию в `main.ts` харнес не проверяет — это F-42 (прод), его red-тест будет в `group-events.e2e` (F-13).
3. **F-03 Хелперы транспорта:** нажатие до `/start` (диалога нет), неизвестный shortId (есть `dropSession`, проверь достаточность), дубль-тап одной кнопки, текст без `/`, сбой `RecordingBotApi` (бросает на следующем вызове заданного метода), параллельные апдейты (два апдейта без `await` между ними). Только хелперы и их тесты; сценарии P1-28… — потом, в `transport.e2e` (F-12).
4. **F-04 Хеш кеша миров (TR-57).** `tests/worlds/materializer.ts:63` (`computeSourceHash`) не учитывает `builder.ts` — правка билдера не сбрасывает кеш. Red: тест, что изменение содержимого `builder.ts` меняет хеш; затем правка.
5. **F-05 Мир `core-education`.** У Андрея (active, Поток 2) есть кампания `c1a11111-1111-4111-8111-111111111111` (`worlds/core-education.ts:606`) — из-за неё ER `createStudentCampaign` выходит по `unique`, и приглашение на отзыв вручную не проверить. Перенеси кампанию на другого студента мира (не персону ручной проверки `guest|candidate|andrey|marina|oleg|dev|mentor2`) или убери, сохранив смысл `worlds/equivalence.test.ts:76`; e2e, опирающиеся на эту кампанию, должны остаться зелёными (найди grep'ом по uuid и по имени Андрея в `peer-review-*.e2e`). Конфликт смыслов — эскалация.

## Правила

- TDD: тест хелпера — red, запуск, затем реализация (для F-04 — обязательно red).
- Не ослабляй типы ради тестов (`as unknown as` в новых местах — только с причиной в отчёте).
- Читай связанные файлы одним вызовом, не перечитывай прочитанное; гайд — `conductor/architecture/ui/bot-test.md`.

## Готово

- Во время работы: `bun test runners/u7-bot/tests/helpers runners/u7-bot/tests/worlds`.
- В конце: `bun run test:bot`, `bun run scripts/agent-gate.ts` — зелёные; число тестов не меньше 924 + новые.
- Тест кажется неверным — не правь, опиши.

## Отчёт

Файлы; по каждому F — что сделано; отклонения с причиной; итог команд; эскалации; «Кандидат в чистку тестов», если увидел.

## Отчёты

### Автор (`dmg-test-designer`, Sonnet, 2026-11-13)

F-01…F-04 готовы: `test-clock.ts` (`TestClock` — `spyOn` на `now` из `@u7-scl/core/shared`, через него `appClock` UC/ER/Job и `InProcJobScheduler`), `createTestApp(tag, world, { clock: { startAt } })`; `TestBotTransport.chatMember/myChatMember` через `handleChatMember/handleMyChatMember` транспорта; хелперы `pressWithoutDialog`, `pressUnknownShortId` (`dropSession` недостаточен — отвечает «Наберите /start»), `doubleTap`, `pressConcurrently`, `sendText`, `api.failNext`, `answers/alerts`; захват ответа — `AsyncLocalStorage`; хеш мира учитывает `builder.ts` (red → green). `test:bot` 941 pass (+17). Orchestrator: убрал `TR-57` из 2 комментариев (`arch:check` запрещает ID реестра в коде).

**F-05 — эскалация:** кампания `c1a11111` нужна `peer-review-reviews-for-me.e2e` («От: Андрей»), `equivalence.test.ts:76`; перенос на 4-го студента потока 2 меняет счётчики в 4 тестах. **Решение orchestrator:** мир не менять; приглашение на отзыв покрыто e2e `peer-review-campaign` (субъект — Марина), при ручной проверке — Марина, не Андрей.

### Ревьюер (`dmg-reviewer`, Opus)

`error` нет. 4 `warn` (утечка подмены `now` при сбое `loadFixtures`; два активных `TestClock`; старт часов раньше якоря мира; хеш только `builder.ts` без его импортов) и 2 `info` — исправлены автором за один круг: часы после `loadFixtures`, второй `TestClock` бросает, по умолчанию старт — якорь мира, хеш — все `worlds/*.ts` без тестов. Попутно: `Date.now()` в `progress.ts:144` мимо часов → F-48. `test:bot` 942 pass, `check` зелёный.
