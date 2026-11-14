# Бриф Ф5.3: бот-раннер

Трек `revision-release_20261112`, строки F-40…F-4D, F-91 [fixes.md](../fixes.md). Порции — по задачам плана; этот бриф — порция 1: **F-40** (гость без `/start`, [C-01](../cards.md#c-01)) и **F-43** (ветвление stories по полям view → признаки в готовом ответе UC, [C-03](../cards.md#c-03), D-72 / DOM-18 пакета).

## Порция 1: F-40, F-43

### Границы

- F-40: `runners/u7-bot/src/create-ui-app.ts` (резолвер), `runners/u7-bot/src/core/ui-app.ts`, `platform/core/src/ui/bot/{ui-app,app-types}.ts` (тип `actorResolver`), их тесты; e2e — `runners/u7-bot/tests/e2e/transport.e2e.test.ts` (или `main-menu.e2e`).
- F-43, домен: `domain/src/stream/stream/{stream.ar.ts, uc/get-stream.uc.ts}`, `domain/src/questionnaire/questionnaire/uc/get-questionnaires-by-user.uc.ts`; прикладной слой: `modules/stream/src/stream/uc/get-stream.uc.ts`, `modules/questionnaire/src/**/get-questionnaires-by-user.uc.ts`; stories — шесть мест ниже. Тесты рядом.
- Нельзя: `conductor/`, `data/`, `node_modules/`, `dmg-core`, прочие модули и контракты; коммиты. `../u7-school-v0.2.6` — только чтение.

### Было → станет

**F-40.** Сейчас: команда (кроме `/start`) от человека без записи пользователя (нет `/start`, есть сессия; или запись удалена) — `actorResolver` бросает `Error('Пользователь с telegramId … не найден')`, ответа нет; так же в v0.2.6 (`apps/u7-bot/src/create-ui-app.ts:89-92`). Кнопки и текст без диалога транспорт уже отсекает (`bot-transport.ts:55,65`; P1-28, P1-32).
Станет: `actorResolver: (tgId) => Promise<TActor | null>` (тип в `platform/core/src/ui/bot/app-types.ts`); резолвер раннера на «не `UserCaller`» возвращает `null`; прочие отказы `callers.resolveByTelegramId` — по-прежнему исключение. Каждый вызов резолвера в `ui-app` (раннер — 4, `platform/core` — 3) на `null` отвечает `notify` «Наберите /start» (текст — как `NO_DIALOG_MESSAGE` транспорта) и дальше не идёт; `/start` — без изменений (регистрация до резолва).

**F-43.** Решения в stories — по признакам ответа UC, не по `status` из view (D-72: поля `view()` агрегата — только для рендера).

| Место | Было | Станет |
|---|---|---|
| `mentor/stories/view-stream-mentor.ts:105-123` | `stream.status === 'enrollment' / 'active' / 'completed'` → кнопки «Запустить / Завершить / В архив» | `GetStream` отдаёт `canActivate`, `canComplete`, `canArchive` (= `canManage` и переход допустим по Def); кнопки — по ним, отдельная проверка `canEdit` для этой строки не нужна, если совпадает с `canManage` (проверь; расходится — эскалация) |
| `streams/stories/view-stream.story.ts:184, 467` | `stream.status === 'enrollment'` для «Записаться» | `GetStream` отдаёт `isEnrolling` (поток в наборе); `#canEnroll` (живая запись студента) — без изменений |
| `streams/stories/stream-catalog.story.ts:57-66` | один `listStreams({})` и фильтр по `s.status` | `listStreams({ status })` по группе — уже есть фильтр в Def; порядок групп и счётчики `hasCompleted` / `hasArchived` — из длин ответов |
| `mentor/stories/my-streams.ts:65-70` | фильтр по `s.status` | так же: `listStreams({ mentorId, status })` по нужным группам |
| `questionnaire/stories/fill.story.ts:325` | `find(s => s.kind === 'standard' && s.status === 'in_progress' && s.ownerInfo.courseId === courseId)` | `getQuestionnairesByUser` получает необязательные фильтры `status`, `kind`, `courseId` (по образцу `ListStreamsUcDef`: `v.optional(entries.<поле>)`); story берёт первый элемент ответа |

`StreamAr` — вопросы `canActivate()`, `canComplete()`, `canArchive()`, `isEnrolling()`: допустимость берётся из `StreamArDef.transitions.<op>.from` (без дублирования списка статусов); `isEnrolling()` — «поток в наборе», сейчас совпадает с `canActivate()` и может переиспользовать его реализацию, но имя отдельное: смысл разный (запись студента против запуска). Эти вопросы понадобятся и F-4C (порция 4).

Видимое поведение бота не меняется (кроме F-40). Оговорка «до миграции UI» в `conductor/architecture/rules.md:15` уже снята.

### Шаги

1. `dmg-test-designer` (Sonnet): red —
   - F-40: unit `create-ui-app.test.ts:114-122` → резолвер возвращает `null`; unit `ui-app` (раннер и `platform/core`) на `null`; e2e: `/help`, `/cancel`, неизвестная команда от человека без записи — ответ «Наберите /start» (как получить «есть сессия, нет записи» в харнесе — найди; нужен новый хелпер — эскалация).
   - F-43: unit `StreamAr` (четыре вопроса по каждому статусу), unit UC `getStream` (признаки × `canManage`), unit UC `getQuestionnairesByUser` (фильтры). e2e stories уже есть (P3-*, P4-*, P7-*) — проверь, что они ловят кнопки lifecycle, «Записаться», группы каталога и «продолжить анкету»; пробел — допиши, зелёным на текущем коде.
2. `dmg-domain-author` (Sonnet): Def и `StreamAr` по red-тестам.
3. `dmg-api-author` (Sonnet): UC `modules/*`, резолвер и `ui-app` (F-40), stories (F-43).
4. Гейт, `dmg-reviewer` (Opus).

### Применимые ID

DOM-01, DOM-18 (D-72), ARC-08, API-02, ERR-01, TST-08; `node_modules/dmg-core/docs/reference/rules.md`.

### Приёмка

- grep `\.status ===\|\.status !==` по `runners/u7-bot/src/controllers/{mentor,streams,questionnaire}/stories/` — только `view-stream-mentor.ts:219-220` (статус студента в списке — отдельно, не в этой порции) и рендер меток (`statusLabels[stream.status]`).
- `bun run test:bot`, `bun run check` — зелёные; тестов не меньше, чем до среза.

## Отчёты

### Порция 1 · шаг 1 — `dmg-test-designer` (Sonnet)

- Red: F-40 — `create-ui-app.test.ts:114` (правка на `null`), `core/ui-app.test.ts` (5 `it`), `platform/core/src/ui/bot/ui-app.test.ts` (3), `transport.e2e.test.ts` (3: `/help`, `/cancel`, неизвестная команда); F-43 — `stream.ar.can.test.ts` (16), `get-stream.flags.uc.test.ts` (20), `get-questionnaires-by-user.filters.uc.test.ts` (7, 5 red).
- Характеризация: порядок групп каталога — `curious-showcase.e2e.test.ts:361`; прочие пять мест уже покрыты (P4-09/10/13, P3-64, P3-55, P3-40/41, P4-05/06, `wish-questionnaire.e2e:501`).
- Для автора: `TestBotTransport` (`tests/helpers/test-bot-transport.ts:244`) — тип `actorResolver` до `Promise<U7BotActor | null>`; `isEnrolling` в UC не зависит от `canManage`; `courseId`-фильтр отсеивает likert. `/cancel` при `null` — только notify, диалог не трогать (решение orchestrator).
- Итог: `test:bot` 1182 pass / 9 fail (все — новые red F-40); tsc — 6 ожидаемых ошибок red-тестов.

### Порция 1 · шаги 2–3 — `dmg-domain-author`, `dmg-api-author` (Sonnet)

- Домен: `StreamAr.canActivate/canComplete/canArchive/isEnrolling` (приватный `allows(op)` по `StreamArDef.transitions`), output `GetStreamUcDef`, фильтры input `GetQuestionnairesByUserUcDef` (`courseId` — `F.uuid`: у `ownerInfo` в state нет схемы поля).
- Прикладной слой и бот: UC `getStream`, `getQuestionnairesByUser`; F-40 — `actorResolver: Promise<TActor | null>`, `noActorResponse()` в `platform/core`; F-43 — шесть мест stories; `canEdit` убран (совпадал с `canManage`).
- Эскалация: два старых unit-теста `FillStory` фиксировали фильтр в story — правка разрешена Нурболатом (2026-11-14). Порядок групп в «Моих потоках» (набор → идёт) принят Нурболатом.

### Порция 1 · ревью — `dmg-reviewer` (Opus)

- error API-01: фильтр анкет в `execute` → в репозиторий (`findByRespondent(userId, filter)`), по образцу `ListStreams`.
- warn: лишняя проверка `'ownerInfo' in view`; двойной резолв на `/cancel`; нет теста «`/cancel` при `null` не трогает диалог»; литерал «Наберите /start» в двух местах; дубли тестов среза (`fill.dialog.test.ts:536`, матрица `get-stream.flags.uc.test.ts`) — чистятся в срезе.
- info, принято orchestrator: четыре `listStreams` в каталоге (D-72 «Гибкость»; при издержках — фильтр по набору статусов в Def); `stream-dmg.test-kit.ts` выводит признаки из `status`; e2e F-40 — резолвер-заглушка (путь `null` — unit `create-ui-app.test.ts:114`).
- Кандидат в машинную проверку: DOM-18 — grep `\.status ===|!==` в `runners/*/src/controllers/**/stories/` с белым списком (→ задача «Оставить» Ф5).

### Порция 1 · повторное ревью и итог

- API-01 закрыто: фильтр в `findByRespondent(userId, filter)`, unit `questionnaire.json-repo.test.ts:186`; UC-тест фильтров сокращён до 2 сценариев, `get-stream.flags.uc.test.ts` — до 3, дубль `fill.dialog.test.ts` удалён (TST-08, в срезе). Двойной резолв на `/cancel` принят: `super.handleCommand` резолвит сам, иначе — правка контракта `platform/core`.
- `dmg-data-keeper` не вызывался: формат записей не меняется — в репозитории только фильтр чтения, в state — текст описания `ownerInfo`.
- `bun run check`: 3191 pass, 4 skip, 0 fail.

## Порция 2: F-41, F-42, F-91

Выполнена в текущей сессии orchestrator (§4.0 навыка: инфраструктура транспорта и проводка `main.ts`, размер S) — без субагентов и без брифа ролей; отклонение от плана («F-41, F-42 — flash»): постановка для исполнителя дороже самой правки.

- F-41: `BotTransport.handleCallback` — `answerCallbackQuery` сразу после валидации (alert-отказы — как прежде), ожидание в `finally`: нажатие подтверждается и при сбое uiApp. `#render` — снятие кнопок чужого экрана параллельно с отправкой нового (`Promise.all`; edit вызывается первым — порядок вызовов API прежний); ранний retire «крошек» — только для ответа без `screen`. Red → green: 3 unit в `bot-transport.test.ts` («скорость ответа на нажатие»).
- F-42: `bot.on('chat_member' | 'my_chat_member')` в `main.ts` (на `bot`, не `privateBot`). e2e нет по C-14 (g-25): обработчики покрыты `group-events.e2e` через `TestBotTransport`.
- F-91: закрыто без кода (Нурболат, 2026-11-14) — `telegramId` в `UserState` обязателен, сценарий P8-05 не воспроизводится; skip-заглушка в `inactivity.e2e` удалена.
- `dmg-reviewer` не вызывался: diff вне домена и модулей. `dmg-data-keeper` — не нужен.
- `bun run check`: 3194 pass, 3 skip, 0 fail.

## Порция 3: F-44…F-47

Выполнена в текущей сессии orchestrator (размер S, бот-раннер), как порция 2.

- F-44: алиасы `EnvelopeOf<typeof QuestionnaireEvents.*>` — локальными типами в `fill.story.ts` (4) и `invite.story.ts` (1), `questionnaire-events.ts` удалён. TR-50 (9) проверено — подтверждено: подписки зовут `dispatchUc` вне `BotRequestContext`, след не из конверта (`correlationId` есть, `Trace.fromEvent` в `dmg-core` есть) → строка F-4E, порция 4.
- F-45: `ScopeReviewsStory` — `STREAM_NOT_FOUND` → `warn` «Поток не найден» через `emptyScreen` (признак `streamMissing` в payload кеша); прочие отказы — как прежде. Red → green: unit «штатные отказы».
- F-46: `DEFAULT_GUEST_NAME = 'друг'` в `ensure-registered.ts`: `first_name.trim()` пуст → имя по умолчанию; `ui-app` берёт ту же константу. Red → green: unit «имя из одних пробелов».
- F-47: `courses/ui-spec.md` — таблица «Число этапов курса» (0 / 1 / ≥2) по `course-nav-resolver.ts`.
- `dmg-reviewer` не вызывался: diff вне домена и модулей. `dmg-data-keeper` — не нужен (имя «друг» — допустимое значение схемы).
- `bun run check`: 3196 pass, 3 skip, 0 fail.

## Порция 4: F-48, F-49, F-4A…F-4E

F-48, F-49, F-4A, F-4D, F-4E — в сессии orchestrator (S, бот-раннер и `platform/core`). F-4C (домен) — `dmg-domain-author`, ниже. F-4B — решение Нурболата (тип `handleMessage` в `platform/core`).

### F-4C: зачисление только в наборе

**Границы:** `domain/src/stream/student/{student.rules.ts, student.errors.ts, uc/enroll-student.uc.ts}` и их тесты; при нужде — `modules/stream/src/student/uc/enroll-student.uc.ts` (контекст правил уже несёт `stream`); снять `test.skip` P3-63 в `runners/u7-bot/tests/e2e/stream-enroll.e2e.test.ts` (комментарий «находка» — заменить строкой «P3-63 (F-4C): …»). Нельзя: `conductor/`, `data/`, `node_modules/`, `dmg-core`, `StreamErrors`, прочие модули; коммиты.

**Было → станет.** Было: `enrollStudent` статус потока не проверяет (шапка Def: «Статус потока не проверяется») — устаревшая кнопка или адрес вручную зачисляют в поток в обучении / завершённый / в архиве. Станет:
- правило `StudentRules.rules.streamEnrolling` — `stream.isEnrolling()` (вопрос `StreamAr` из порции 1), **первым** в `rules` UC (до кодового слова: закрытому набору слово не важно);
- ошибка `StudentErrors.ENROLLMENT_CLOSED`, `kind: 'conflict'`, `label` «Набор на поток закрыт.» (`StreamErrors.NOT_ENROLLING` не годится: его текст — о запуске); добавить в `errors` UC; шапку Def поправить;
- бот: отказ — `warn` через имеющийся путь отказа UC в `view-stream.story` (проверь, что текст ошибки доходит до пользователя; иначе — эскалация, не правь story сверх нужного).

**Шаги (одним вызовом, TDD):** red — unit правила (по статусам потока: `enrollment` — ok, `active`/`completed`/`archived` — `ENROLLMENT_CLOSED`), unit UC (порядок: закрытый набор раньше кодового слова), снятый `skip` P3-63; запуск, убедиться в падении → green → `bun run scripts/agent-gate.ts`.

**ID:** DOM-01, DOM-18, ERR-01, TST-08.

**Приёмка:** P3-63 зелёный без `skip`; `bun test domain/src/stream` и e2e `stream-enroll` — зелёные.

### Порция 4 · отчёты

- F-48: `progress.ts` — `now()` вместо `Date.now()`. Red → green: unit «дни в обучении от `now()`».
- F-49: `#logLevelResponse` — реплика о неизвестном уровне целиком в интерполяции `md` (экранирование); `skip` P1-26 снят.
- F-4A: unit `controller.stream-group.test.ts` — сбой `findStreamByTelegramGroup` / `getStreamMembers` / `getUser` (исключение и отказ UC) → один `warn`, `stop`, ментору ничего; прежний тест «исключение при обработке» поглощён (TST-08, в срезе). Попутно: обработчик событий группы в unit — вне `BotRequestContext`, `warn` ERR-07 на каждый вызов (в проде транспорт ставит контекст).
- F-4B (Нурболат, 2026-11-14): вход `handleMessage` — `MessageUpdate = TextMessage | DocumentMessage | PhotoMessage | VoiceMessage` (`platform/core/src/ui/bot/types.ts`), без команд и кнопок; дискриминатор текста `'message'` → `'text'`. Проверки «ждём текст» в `view-stream`, `create-stream`, `fill` — по контракту (транспорт пока отдаёт только текст). Ветки «ввод без контекста» (P3-61, P7-41) — страховка от битой/старой сессии, оставлены; `scenarios.md` поправлен. Тест wizard на нетекстовый ввод — на `document` (было `callback`, вне контракта).
- F-4C — `dmg-domain-author` (Sonnet): правило `StudentRules.rules.streamEnrolling` (`stream.isEnrolling()`) первым в `enrollStudent`, ошибка `StudentErrors.ENROLLMENT_CLOSED`; `skip` P3-63 снят; удалён unit «статус active зачислению не мешает» (закреплял дефект). Вне границ: `platform/app/tests/u7-app.student.test.ts` — зачисление перенесено на поток в наборе (принято orchestrator).
- F-4D: `BotController.handleCommand` — ответ `handleError` через `#withNotices`; `skip` P8-32 снят.
- F-4E: `UiEventContext` (`platform/core/src/ui/ui-event-context.ts`, `AsyncLocalStorage`) — `UiApp.subscribeEvents` исполняет обработчик в контексте события; `requestTrace` в нём — `Trace.fromEvent` (приоритетнее апдейта). Отсев повторов D-56 следа события не касается (только `cause: request`). TR-50 (9) закрыто; `UiEventContext` — в «Место» DEBT-41 (тот же долг неявного контекста).
- Ревью F-4C — `dmg-reviewer` (Opus): блокеров нет; minor исправлены автором — дубль матрицы статусов в unit UC (TST-08, в срезе: один сквозной отказ + тест порядка), комментарии «порядок как в legacy» (набор — новое правило), в P3-63 проверка текста «Набор на поток закрыт». Вопрос принят orchestrator как есть: у закрытого потока с кодовым словом бот сначала спрашивает слово, отказ — после ввода (кнопки на такой поток нет).
- Прочие пункты порции (`platform/core`, бот-раннер) — без `dmg-reviewer`: вне домена и модулей. `dmg-data-keeper` — не нужен: форматы записей не менялись (`BotUpdate` не хранится).
- `bun run check`: 3213 pass, 0 skip, 0 fail.
