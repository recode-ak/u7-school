# Бриф среза: `questionnaire` / UI (Ф2)

Черновик — `dmg-tech-lead` (Sonnet), Ф2; проверка и решения — orchestrator (раздел «Решения orchestrator», TR-50). Читать с `../spec.md`, `../plan.md` (Ф2), `slices/questionnaire.md` (разделы «Событийный контракт», «Вне пакета», «Job … D-63», «Сохраняемое поведение», «Красная зона», Т15–Т17, «Ответы Нурболата»), `debt.md` TR-43 (С2) и TR-49 (1, 2, 6). Образец — трек stream: `runners/u7-bot/src/controllers/streams/stories/inactivity.story.ts` (подписки на Def-события, legacy `get-user`, `dispatchUc`) и `stream-dmg.test-kit.ts` / `peer-review-dmg.test-kit.ts`.

## Решения orchestrator (TR-50)

- Бриф принят без переписывания. Выборочно проверено: `dispatchUc`/`ucErrorNotify` в `u7-bot-ui-story.ts:157-181`, многострочные `execute(` в `fill.story.ts`, в `courses/*` вызовов UC анкет нет (только `Routes.questionnaire.*`).
- Стратегических вопросов нет: видимое поведение сохраняется (Д5 (A), Д6 — тексты без префикса «Ошибка валидации»).
- Т1–Т6 приняты по рекомендациям. Порядок задач Ф2 в `plan.md` изменён (Т5): red-тесты (test-designer) → механический перевод остальных тестов (flash) → реализация UI (Sonnet). Критерии приёмки Ф2 в `plan.md` заменены grep-критериями этого брифа.

## Расхождения plan/spec с кодом (6)

1. **План Ф2: «типы `render.ts` из контракта»** — уже сделано в Ф1 (Т16): `render.ts:10-13` импортирует `Question`, `QuestionnaireActionResponse` из `@u7-scl/domain/questionnaire/contract`. Остаётся удалить `stories/legacy-events.ts` (`fill.story.ts:14-19`, `invite.story.ts:10` на нём).
2. **План Ф2: «`course-catalog.story` и `course-nav-resolver` — проверить вызовы анкет».** Вызовов UC анкет и подписок там нет: `course-nav-resolver.ts:56-57` и `course-catalog.story.ts:547-552` — только `Routes.questionnaire.resume(courseId)`, `course-catalog.story.ts:533` читает `outcome` UC `wish`. **Правок нет**, шаг — grep-проверка.
3. **Критерии приёмки плана Ф2 ненадёжны.**
   - `grep "appApi.execute('<uc>'"` пропускает многострочные вызовы (`fill.story.ts:179-181, 203-205, 256-258, 292-294, 352-356, 363-367`, `invite.story.ts:86-89, 124-128, 166-170, 188-192, 215-219`), `app.apiApp.execute(` в `wish-questionnaire.e2e.test.ts:144` и `executeMock` в тестах stories.
   - `grep "'questionnaire:" runners` совпадает с маршрутами в тестах (`course-nav-resolver.test.ts:286`, `course-catalog.story.test.ts:846,1017`, `fill.dialog.test.ts` и др.).
   - Заменены grep-критериями из раздела «Критерии приёмки».
4. **План Ф2 и «Риски»: «адрес через `GetTelegramAddressesUcDef`»** устарел: С2 = (b), TR-49 (6) — адрес через legacy `get-user`, как `InactivityStory`.
5. **Порядок задач плана Ф2 нарушал TDD**: flash-правка тестов стояла после UI. Тесты событий меняют payload (без `telegramId`/`response`), добавляют `get-user` и `dispatch`-мок. Разрез — в «Шагах».
6. **«`get-current` даёт экран» верно только для `invited`.** Из 5 событий экран (`inviteText`, `whyText`; в legacy — `payload.response`) нужен лишь `invited` (InviteStory). Остальным четырём — адрес и `ownerInfo.courseId`. `started` в legacy нёс `response`, но `fill.story.ts:68-87` его не читал.

## Границы

**Трогаем** (`runners/u7-bot`):
- `src/controllers/questionnaire/controller.ts` — без правок, если не меняется состав stories;
- `stories/{fill.story,invite.story,render}.ts`; `stories/legacy-events.ts` — **удалить**;
- тесты рядом: `fill.dialog.test`, `fill.story.warning.test`, `fill.story.continue-invite.test`, `invite.dialog.test`, `inventory.test`; новый `stories/questionnaire-dmg.test-kit.ts`;
- `ui-spec.md` — раздел S08 и упоминания событий (строка 266), если формулировки привязаны к legacy-именам;
- `tests/e2e/{questionnaire-ux,wish-questionnaire}.e2e.test.ts`; новый `tests/e2e/questionnaire-events.e2e.test.ts`.

**Не трогаем:** `domain/**`, `modules/**`, `platform/**`, `core/**`; `runners/u7-bot/src/core/u7-bot-ui-story.ts`; `courses/*` (расхождение 2); оболочку Т15 (`platform/app/src/u7-app-meta.ts:4,15`) и legacy-удаление — Ф3; `conductor/`, `data/`.

## Решения брифа

- **Д1. Вызов UC.** `this.dispatchUc(QuestionnaireModuleDef, <X>UcDef.command(input), actor)` (D-49, `u7-bot-ui-story.ts:166`) вместо `appApi.execute`. Результат — `Result`, не исключение. Импорты — из `@u7-scl/domain/questionnaire/contract` (ARC-08, D-45).
- **Д2. Подписки.** `eventSubscription<Event>(QuestionnaireEvents.<x>.name, handler)`; тип события — `DomainEvent & { eventName; payload: v.InferOutput<…> }`, как `StudentEventOf` в `inactivity.story.ts:27-42`, в файле `stories/questionnaire-events.ts` (вместо `legacy-events.ts`). Порядок подписок FillStory: `started`, `abandonWarning`, `continueInvite`, `abandoned`.
- **Д3. Адрес и actor.**
  - `get-user` по `payload.respondentId` через `this.appApi.execute('get-user', { uuid })`; ошибка/`null` → `undefined`.
  - Нет профиля или `telegramId` → `logger.warn` и выход без отправки (как `InactivityStory.#notify`, `inactivity.story.ts:215-230`; наблюдаемо как в v0.2.6).
  - Профиль — полный `User`, годится как `actor` для `dispatchUc` (нужно для `invited`).
  - Общий приём — метод story или функция в `stories/`, не в `core`.
- **Д4. `ownerInfo.courseId`** — из `event.payload.ownerInfo` (`Record<string, unknown>`), проверка `typeof courseId === 'string'` сохраняется.
- **Д5. Экран ошибки (A).** Legacy `handleError` даёт `screen("⚠️ <текст>")` с кнопкой «⬅️ Меню» (`#handleResume`, `#showCurrent`, `#handleCancelConfirmed`, `#handleWhy`, `#handleInvite`, `#handleDeclineConfirm`, `#handleDeclineConfirmed`, `start:`; тест `invite.dialog.test.ts:74-90`). Result-аналога в базовой story нет. Локальная функция `ucErrorScreen(error: DomainError)` в `stories/render.ts` с ветками `handleError`: `validation` → issues или `label`; `access` → `denyMessage ?? label`; `not_found`/`conflict` → `label`; `internal`/`unauthorized` → общий текст и лог; клавиатура «⬅️ Меню» (`app:main-menu`). Для `errorNotify`-веток (`answer`, `next`, `handleMessage`) — `ucErrorNotify`, кроме Д6.
- **Д6. `CHOICE_EXPECTED` / `EMPTY_ANSWER_CODE`** (`kind: 'validation'`): `ucErrorNotify` показал бы «*Ошибка валидации*\n\n<label>», legacy — только сообщение. Story ветвится по `error.code`: для этих двух кодов — `this.warn(md\`${error.label}\`)`. Текст «Ожидался ответ с выбором (нажатием кнопки)» — `fill.dialog.test.ts:320-338`.
- **Д7. UC:**

| Было (`execute`) | Станет (`dispatchUc`) | Заметки |
|---|---|---|
| `'handle-action'` `{questionnaireId, type:'callback'\|'text', value}` (`fill.story.ts` `answer:`, `next:`, `handleMessage`) | `HandleActionUcDef.command({...})`, `ok → #renderUc(value, …)`, `err → Д5/Д6` | вход тот же; вывод — `QuestionnaireActionResponse` |
| `'get-current'` (`#showCurrent`, `#cancelConfirmScreen`, `invite#handleWhy/#handleInvite/#handleDeclineConfirm`) | `GetCurrentUcDef.command({questionnaireId})` | `/cancel`: отказ ветвится в тот же «Отменено. Наберите /start» (`fill.dialog.test.ts:698`) |
| `'abandon'` | `AbandonUcDef.command({questionnaireId})` | |
| `'get-questionnaires-by-user'` `{userId: actor.uuid}` | `GetQuestionnairesByUserUcDef.command({userId})` | фильтр `kind==='standard' && status==='in_progress' && ownerInfo.courseId===courseId`; тип `QuestionnaireView` вместо `as Array<…>` |
| `'start-by-invite'` | `StartByInviteUcDef.command({questionnaireId})` | результат игнорируется, как в v0.2.6; далее `go(fill:current:qId)` |
| `'decline-invite'` | `DeclineInviteUcDef.command({questionnaireId})` | |

Бот не вызывает: `start-questionnaire` (из `wish`), `send-likert-invite`, `get-questionnaire`.

- **Д8. Подписки:**

| Legacy (`legacy-events.ts`) | Def (`QuestionnaireEvents.<x>.name`) | Обработчик | Данные |
|---|---|---|---|
| `questionnaire:start` | `started` | Fill `#handleStartEvent` | адрес — `get-user(respondentId)`; `courseId` — `payload.ownerInfo` |
| `questionnaire:invite` | `invited` | Invite `#handleInviteEvent` | адрес — `get-user`; `inviteText`/`whyText` — `GetCurrentUcDef` от профиля респондента, `type==='invited'`; иначе fallback (Т2) |
| `questionnaire:abandon-warning` | `abandonWarning` | Fill `#handleWarningEvent` | как `started` |
| `questionnaire:continue-invite` | `continueInvite` | Fill `#handleContinueInviteEvent` | как `started` |
| `questionnaire:abandon` | `abandoned` | Fill `#handleAbandonEvent` | только `payload.reason === 'timeout'` (`by_user`, `declined` — игнор) + адрес |

`completed` бот не слушает (его читает ER `wish`). `GetCurrentUcDef` — `callers: ['user']`, policy «респондент/админ»: профиль респондента проходит.

- **Д9. Тестовый стенд stories.** Новый `stories/questionnaire-dmg.test-kit.ts`: реэкспорт `dmgDispatch`, `refuse`, `Refusal` из `../../streams/stories/stream-dmg.test-kit` с `modules=[QuestionnaireModuleDef]`, view-билдеры ответов `getCurrent`/`handleAction`, `testCallers` из `peer-review-dmg.test-kit`.
- **Д10. e2e на 5 событий** (`tests/e2e/questionnaire-events.e2e.test.ts` + существующие):
  - `started` — через apply в `wish` (существующие сценарии после перевода) + явное утверждение в новом файле;
  - `invited` — реально: `app.apiApp.dispatch(QuestionnaireModuleDef, SendLikertInviteUcDef.command({pool, ownerInfo}), new SystemCaller(...), trace)`; проверка «📋 Анкета», кнопки `questionnaire:invite:start|why|decline:<id>`; likert-пул (`LikertQuestionPoolSchema`), респондент — фикстурный пользователь;
  - `abandonWarning`, `continueInvite`, `abandoned(timeout)` — публикация в `app.eventBus` под FQN с payload через `v.parse(QuestionnaireEvents.<x>.payload, …)` (паттерн `publishContinueInvite`, `questionnaire-ux.e2e.test.ts:321-335`, без `telegramId`). Часами `createTestApp` не управляет; Job покрыт в Ф1 (Т3);
  - отрицательные: `abandoned` с `by_user`/`declined` — сообщения нет (`await Bun.sleep(200)`, как `student-dmg.e2e`); профиль без `telegramId` — warn без падения.

## Было → станет (по файлам)

| Файл | Было | Станет |
|---|---|---|
| `stories/legacy-events.ts` | 5 временных legacy-типов | удалить; типы — `stories/questionnaire-events.ts` (Д2) |
| `stories/fill.story.ts` | `eventSubscription('questionnaire:*')`, `telegramId`/`ownerInfo` из legacy-события; `appApi.execute` ×6 | Д2/Д3/Д4/Д7/Д8; `try/catch → errorNotify/handleError` → ветвление по `Result`; `#renderUc` принимает `value` |
| `stories/invite.story.ts` | подписка `questionnaire:invite` с `payload.response`; `execute` ×5 | Д7/Д8, экран приглашения через `GetCurrentUcDef` |
| `stories/render.ts` | типы из контракта | + `ucErrorScreen` (Д5) |
| `controller.ts` | список stories | без изменений |
| тесты stories | `executeMock` по legacy-именам, события `questionnaire:*` с `telegramId`/`response`/`ownerInfo` | `dmgDispatch` + `testCallers`, события по FQN с `payload.ownerInfo`, `get-user` в моке `appApi.execute` |
| `wish-questionnaire.e2e` | `app.apiApp.execute('get-questionnaires-by-user')` (`:144`), `QuestionnaireState` из `@u7-scl/questionnaire/domain` (`:12`) | `app.apiApp.dispatch(QuestionnaireModuleDef, GetQuestionnairesByUserUcDef.command(...), new UserCaller(user), trace)`, `QuestionnaireView` из контракта |
| `questionnaire-ux.e2e` | `publishContinueInvite` на `questionnaire:continue-invite` с `telegramId` | FQN Def, payload без `telegramId` (адрес — `get-user` по `respondentId: fillGuest.uuid`) |

## Сохраняемое поведение

Тексты, кнопки и порядок сообщений не меняются. Закрепляют `ui-spec.md` и тесты: `fill.dialog.test` (finalize, awaitInput, stale_answer, «Вопрос N из M», «Далее», resume-фильтр, `/cancel`), `fill.story.warning.test` (S07/S08), `fill.story.continue-invite.test` (S09), `invite.dialog.test` (S01/S06, MarkdownV2), `inventory.test` (коды кнопок).

- «📋 Анкета… Для вас подготовлена анкета — откройте её через /start»; без `courseId` — notify-подсказка, с `courseId` — «▶️ Заполнить анкету» (`questionnaire:fill:resume:<courseId>`);
- S07 «⏳ Анкета приостановлена…» («▶️ Продолжить» только с `courseId`, «⏭️ Прервать»), S09 «Вы начали заполнять анкету — продолжим?» («▶️ Продолжить анкету», «⏭️ Прервать»), S08 «⏱ Анкета была закрыта из-за длительной неактивности» (только `timeout`);
- канал `proactiveSender.invite`/`notify`, полные коды кнопок в проактивах;
- отказы: «Анкета не найдена», «Анкета уже завершена», «Ожидался ответ с выбором (нажатием кнопки)», «Код ответа не может быть пустым», «Нет доступа к анкете» — те же тексты (`label`/`denyMessage`);
- нет профиля/`telegramId` — тишина и warn.

Видимых пользователю изменений нет. Тесты состава подписок: `fill.dialog.test.ts:535-548`, `fill.story.warning.test.ts:43-48`, `fill.story.continue-invite.test.ts:27`, `inventory.test.ts:296-300`.

## Шаги (по ролям)

1. **`dmg-test-designer` (Sonnet).**
   - Кит `questionnaire-dmg.test-kit.ts`; типы `questionnaire-events.ts`, если нужны тестам.
   - Red-тесты событий (подписки по FQN, payload без `telegramId`):
     - `started`: с `courseId` → invite с кнопкой-мостом; без → notify с `/start`; нет профиля → тишина, warn; профиль без `telegramId` → тишина;
     - `abandonWarning`: с/без `courseId`, тексты, коды «Прервать» (`questionnaire:fill:cancel:<id>`); нет адреса → тишина;
     - `continueInvite`: с/без `courseId`, «продолжим?», нет адреса → тишина;
     - `abandoned`: `timeout` → notify; `by_user`/`declined` → ничего; нет адреса → ничего;
     - `invited`: `inviteText`/`whyText` из `getCurrent` (actor — профиль респондента, MarkdownV2 `unsafeText`); без `whyText` → нет «Зачем»; без `inviteText` → fallback; `getCurrent` не `invited` или отказ → fallback + warn (Т2); нет адреса → тишина;
     - состав подписок: Fill — `[started, abandonWarning, continueInvite, abandoned].map(.name)`, Invite — `[invited.name]`.
   - Тесты вызовов: `HandleActionUcDef`, `GetCurrentUcDef`, `AbandonUcDef`, `GetQuestionnairesByUserUcDef`, `StartByInviteUcDef`, `DeclineInviteUcDef` — `command.uc` и `input`; отказы: `CHOICE_EXPECTED` → warn без «Ошибка валидации» (Д6); `NOT_FOUND`/`NOT_IN_PROGRESS`/`NOT_INVITED` → `ucErrorScreen` с «⬅️ Меню»; internal → общий текст без утечки; `/cancel` при отказе `getCurrent` → «Отменено…».
   - `ucErrorScreen` — юнит-тесты по веткам.
   - e2e `tests/e2e/questionnaire-events.e2e.test.ts` (Д10).
   - Отчёт: сценарии и соответствие «старый тест → новый».
2. **`migrator` (flash).** Механический перевод **остальных** тестов: `fill.dialog.test` и `invite.dialog.test` (кроме блоков подписок), `inventory.test` — `executeMock` → `dmgDispatch`/`testCallers`, `badRequest` → `refuse(...)`; e2e `wish-questionnaire` и `questionnaire-ux` (`app.apiApp.execute`, `publishContinueInvite`). Число тестов не сокращать.
3. **Автор UI (Sonnet, `migrator`).** `fill.story`, `invite.story`, `render.ts` (`ucErrorScreen`), удаление `legacy-events.ts`; прогон до зелёного; `ui-spec.md` (S08, имена событий).
4. Гейт, `git diff --numstat`, grep — после каждого шага; затем `dmg-reviewer` (Opus). Записи TR-49 (1), (2) снимает orchestrator.

**Критерии для flash (шаг 2):**
- `grep -rn "badRequest\|errBadRequest\|executeMock" runners/u7-bot/src/controllers/questionnaire runners/u7-bot/tests/e2e/{questionnaire-ux,wish-questionnaire}.e2e.test.ts` — пусто, кроме строк с `'get-user'`.
- `grep -rnE "['\"](get-current|handle-action|abandon|start-by-invite|decline-invite|get-questionnaires-by-user)['\"]" runners/u7-bot/src/controllers/questionnaire runners/u7-bot/tests/e2e` — пусто в тестах (в stories — до шага 3).
- `grep -rn "@u7-scl/questionnaire" runners/u7-bot/tests/e2e runners/u7-bot/src/controllers/questionnaire` — пусто.
- По каждому тест-файлу число `test(`/`it(` не меньше исходного; нет `.skip`/`.todo`/закомментированных `expect`.
- Тесты шага 2 красные только из-за нереализованных stories (до шага 3); `tsc` зелёный.

## Внешние зависимости

- `user`: legacy `get-user` (`appApi.execute`, `uuid` → `User | null`) — до перевода `user` (TR-49 (6)).
- `wish`: `started` порождает `StartQuestionnaireUcDef` в `create-course-wish`; контракт `wish` не меняется.
- `peer-review` (будущий клиент): `SendLikertInviteUcDef` → `invited` → `InviteStory`; e2e это фиксирует.
- Шина: Def-события доходят до подписок через `legacyEventBus` под FQN (прецедент — `InactivityStory`).
- Тестовая инфраструктура: `app.apiApp.dispatch`, `UserCaller`/`SystemCaller` (`dmg-core`), `Trace` из `dmg-core/app`, `expectOk` (`dmg-core/testing`) — как в `student-dmg.e2e.test.ts`.

## Тактические решения (TR-50)

- **Т1.** Экран ошибки — (A) локальный `ucErrorScreen` в `stories/render.ts`. Метод в `U7BotUiStory` — вне среза, кандидат в долг.
- **Т2.** `invited`: отказ или не-`invited` ответ `getCurrent` → приглашение с fallback «Заполните, пожалуйста, анкету.», без «Зачем», `warn`.
- **Т3.** e2e `abandonWarning`/`continueInvite`/`abandoned(timeout)` — публикацией Def-события; прогон Job по часам требует управления часами в `createTestApp` (вне среза).
- **Т4.** Кит тестов — реэкспорт из `stream-dmg.test-kit`; общий кит — отдельный долг.
- **Т5.** Порядок: red (test-designer) → перевод остальных тестов (flash) → UI.
- **Т6.** Типы событий — `stories/questionnaire-events.ts`, в контракт не реэкспортируются.

## Правила (ID `rules.md`)

ARC-08, D-45, D-49 (UI видит контракт и вызывает через `dispatch`); ERR-01…07 (ветвление по `code`/`kind`, не по строкам; след без контекста — `warn` внутри `dispatchUc`); CODE-02, CODE-04 (без ID `Т\d+`, `Р\d+`, `Д\d+` в комментариях кода); TST-01…07; D-63 (события без адреса, адрес — в UI).

## Документы

`dmg-core` не затрагивается. `ui-spec.md` (S08, имена событий) — автор UI; `debt.md` (снять TR-49 (1), (2)) — orchestrator; `migration.md` — Ф4.

## Критерии приёмки

- `grep -rnE "['\"]questionnaire:(start|invite|abandon-warning|continue-invite|abandon)['\"]" runners` — пусто; `legacy-events.ts` удалён; `grep -rn "legacy-events" runners` — пусто.
- `grep -rnE "['\"](get-current|handle-action|abandon|start-by-invite|decline-invite|get-questionnaires-by-user)['\"]" runners` — пусто (включая многострочные вызовы и тесты).
- `grep -rn "appApi.execute\|apiApp.execute" runners/u7-bot/src/controllers/questionnaire runners/u7-bot/tests/e2e/{questionnaire-ux,wish-questionnaire,questionnaire-events}.e2e.test.ts` — только `'get-user'`.
- Подписки: Fill — 4 имени Def, Invite — `invited`; на каждое — e2e, включая отрицательные (`by_user`, `declined`, нет адреса).
- 12 e2e красной зоны TR-49 (1) зелёные; `test:bot` не ниже базовой линии Ф0; число тестов в переписанных файлах не меньше исходного.
- `bun run check` полностью зелёный; записи красной зоны в `debt.md` нет; `git status data/` чист.
- `git diff --stat` не содержит `domain/`, `modules/`, `platform/`, `core/`, `courses/`.
