# Бриф среза: u7-school / разметка ПД и подключение лога (F-111, Фаза 4)

База — `119f3e6c` (u7-school на `dmg-core` v0.3.0). Механика пакета — `node_modules/dmg-core/docs/reference/oplog.md` (D-86). Живые `data/` не читать и не трогать; `data/fixtures/oplog/2026-11-13.jsonl` (вне git, копия реального лога) — не трогать и не использовать для проверки «нет ПД»: проверка — на свежем логе во временном каталоге.

## Пометить `F.sensitive` (аудит `dmg-data-keeper`, пути от `domain/src/`)

**State/VO** (пометка наследуется в производные схемы):
- `user/user/user.state.ts` — `name` (обёртка поверх `trimmed`: `F.sensitive(trimmed(...))`), `telegramId`, `nick`.
- `questionnaire/questionnaire/questionnaire.state.ts` — `answers` (поле целиком, не `AnswerVo.answerText`), `draftAnswers`, `ownerInfo`.
- `peer-review/review/review.state.ts` — `text` (поле state; `ReviewTextSchema` не трогать).
- `stream/stream/stream.state.ts` — `enrollmentKey`, `telegramGroupInvite`.
- student (`abandonDetails`, `completionDetails`, `notices`) — **не помечать**: только picklist и timestamp (решение orchestrator).

**Схемы операций, написанные заново** (пометка не наследуется):
- `user/user/uc/register-guest.uc.ts` — вход `nick`; `user/user/uc/list-users.uc.ts` — вход `name`; `user/user/uc/get-telegram-addresses.uc.ts` — выход `addresses[].telegramId`.
- `user/user/user.errors.ts` — payload `NOT_FOUND` (ветка `{ telegramId }` union — payload скроется целиком, принято), `TELEGRAM_ID_TAKEN.telegramId`.
- `wish/wish/wish.events.ts` — `addressee.telegramId` (`invited`).
- `questionnaire/questionnaire/uc/start-questionnaire.uc.ts`, `send-likert-invite.uc.ts` — вход `ownerInfo`; `questionnaire.events.ts` — константа `ownerInfo`; `uc/handle-action.uc.ts` — вход `value`; `questionnaire.types.ts` — `selectedAnswers`, `previousSelectedAnswers` в схемах ответов экрана.
- `peer-review/review/uc/create-review.uc.ts` — вход `text`; `uc/get-my-review.uc.ts` — выход `text`; `review.types.ts` — `ReviewSnapshotSchema.text`.
- `stream/student/uc/enroll-student.uc.ts` — вход `enrollmentKey`.

## Вне схем

- **`trace.channel.visitorId`** (`runners/u7-bot/src/core/dispatch-uc.ts:46`) сейчас — `String(telegramId)`: Telegram ID в каждой записи лога. Станет — непрозрачный стабильный id: HMAC-SHA256 от `telegramId` с ключом из токена бота (конфиг бота уже его содержит), 16 hex, `node:crypto`. Используется только как ключ отсева повторов гостя (`command-replay.ts`) — стабильность сохраняется. Реализация — класс (ООП, не свободная функция), ключ задаётся при старте бота; в тестах — фиксированный ключ.
- **`retainDays: 90`** — `platform/app/src/u7-app.ts` (единственное место создания `JsonlOperationLog`).
- **`scripts/oplog.ts`** + `"oplog": "bun run scripts/oplog.ts"` в корневом `package.json`: запускает CLI пакета `dmg-core oplog` по `${DB_DIR:-./data}/oplog` с остальными аргументами (`bun run oplog --request <id>`).

## Тесты (dmg-test-designer)

1. По списку аудита — на каждое место `SensitiveMask.isSensitive(схема, путь)` (или `containsSensitive`) `=== true`; один тест-таблица на модуль домена, рядом с тестами домена (TST-08: механику пакета не перепроверять).
2. Разбор старой записи не меняется: `v.parse(UserState, запись)` до и после пометки — на фикстурах/существующих тестах state (если уже покрыто — не дублировать).
3. Сквозной: прогон операций `u7-app` (как существующие `u7-app*.test.ts`) во временном `DB_DIR` — регистрация гостя, анкета, отзыв, зачисление по ключу; в строках JSONL нет значений `name`, `telegramId` (числом и строкой), `nick`, текста отзыва, ключа зачисления, ответа анкеты.
4. `u7-app` создаёт лог с `retainDays: 90`.
5. `visitorId`: стабилен для одного `telegramId`, разный для разных, не содержит `telegramId`; отсев повторов гостя работает.
6. `bun run oplog` (скрипт) на временном каталоге с записями — лента; без аргументов — подсказка.
7. Проверить точные `toEqual` по записи лога в `u7-app*.test.ts` и тестах UC с `writes` (могут упасть от `changes`/маскирования) — поправить ожидания.

## Правила

DOM-11 (`F.sensitive` — из `F`), CODE-02, CODE-04, TST-05..08, ООП вместо хелперов (класс для `visitorId`), без новых зависимостей.

## Критерии приёмки

- `CI=true bun run check` зелёный, тестов не меньше 3420; `bun run test:bot` не меньше 1232.
- Все места аудита помечены (тест по списку); в свежем логе прогона нет ПД.
- `DB_DIR=<временный> bun run oplog --request <id>` выдаёт ленту.

## Отчёты

### dmg-data-keeper (2026-11-15)

Аудит — список выше. Совместимость: старые `data/fixtures/oplog/*.jsonl` (без `writes`/`changes`, есть `at`/`module`/`op`/`kind`) читатель принимает; `F.sensitive` — метаданные схемы, формат state и снимков не меняется, миграция и бэкап не нужны. Риски: union `NOT_FOUND` скрывается целиком (принято); `ownerInfo.courseId` в логе скрыт (принято); `trace.channel.visitorId` = Telegram ID (решение — HMAC); `data/fixtures/oplog/2026-11-13.jsonl` содержит имя и Telegram ID (вне git; проверка ПД — на свежем логе).

### dmg-test-designer (2026-11-15)

Новые тесты: `domain/src/{user/user/user,wish/wish/wish,questionnaire/questionnaire/questionnaire,peer-review/review/review,stream/stream/stream}.sensitive.test.ts`, `platform/app/tests/u7-app.oplog.test.ts` (сквозной + `retainDays: 90`), `runners/u7-bot/src/core/visitor-id.test.ts`, `scripts/oplog.test.ts`. Прогон: 42 fail по делу, 4 охранных зелёных.

API: `VisitorId` (`runners/u7-bot/src/core/visitor-id.ts`): `constructor(key)` (пустой — throw), `of(telegramId): string` — первые 16 hex HMAC-SHA256; ключ — `config.botToken` при старте. `scripts/oplog.ts`: без аргументов — подсказка, код 2; нет каталога — код 2.

Для автора: `u7-bot-ui-story.test.ts:455` ждёт `visitorId: '1'` — поправить на значение `VisitorId` с фиксированным ключом; проверить `toEqual` по `ctx.oplog` в wish ER и stream sync UC.

### dmg-domain-author (2026-11-15)

Пометки по списку; `VisitorId` — процесс-глобальная установка (`install` при старте, повтор с другим ключом — throw; передача через `resolve` ломала ~300 тестов) — долг C-DEBT-57; `retainDays: 90`; `scripts/oplog.ts` через бин пакета. Правки тестов: `u7-bot-ui-story.test.ts:455` (ожидание `VisitorId`), `u7-app.oplog.test.ts` (`previousQuestion` — контент анкеты, не ПД). check 3477/0, test:bot 1244/0. Коммит `08343f47`.

### dmg-reviewer (2026-11-15)

Блокеров нет. Question: глобальный `VisitorId` — принято, C-DEBT-57. Minor: тест статического API, бин пакета в `scripts/oplog.ts`, имя теста `handleAction` — исправлены. Полнота пометок подтверждена, Telegram ID в trace/лог не попадает.
