# Таблица удаления тестов: бот `questionnaire` (анкеты)

Трек `tst-cleanup_20261105`, фаза 2 (срез `questionnaire`, уровень бота). Основание — инвентаризация [`questionnaire-bot.md`](./questionnaire-bot.md) (кандидаты, Б-1…Б-13, Н1, «Полезные тесты», открытые вопросы), закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-13), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), [`bot-test.md` §2 п. 5](../../../architecture/ui/bot-test.md) («уровни не повторяют друг друга»), решения трека [`spec.md`](../spec.md) «Решения» и решения по открытым вопросам инвентаризации (приняты перед таблицей):

1. Файлы-двойники (Б-5) — вариант (а): `invite.dialog.test.ts` → `invite.story.dmg.test.ts`; `fill.story.warning.test.ts` + `fill.story.continue-invite.test.ts` → один новый `fill.story.events.test.ts`. Уцелевшие тесты этих файлов в таблице — `перенести в <файл>`.
2. `inventory.test.ts` (Н1) — вариант (а): переписать в реестр кодов (только `callback_data` и состав подписок, без проверок подписей кнопок); тексты — поведенческим тестам.
3. `questionnaire-ux.e2e.test.ts` — весь файл `отложить до course-dmg` (TR-57, `conductor/architecture/debt.md`), не трогать.
4. `questionnaire-events.e2e.test.ts` — достаточно `started` из реального UC (переписать) + `invited` (оставить) + «без профиля» (оставить); ветки, тексты и отрицательные — только unit.
5. Канон `resolveRespondent` — `invite.story.dmg.test.ts:337/354/371`; отдельный файл не заводим, копии удаляем. `inviteKeyboard` (`render.ts:46`) — мёртвый экспорт (Б-13), теста нет, в таблицу не входит.

**Область:** `runners/u7-bot/src/controllers/questionnaire/**/*.test.ts` (8 файлов) и `runners/u7-bot/tests/e2e/{questionnaire-ux,questionnaire-events}.e2e.test.ts`. База: **131 объявление / 134 кейса** (инвентаризация указывала 129 объявлений — сводка не поймала два `test.each`: `Q/invite.story.dmg.test.ts:162` и `Q/render.error-screen.test.ts:91`, кейсов там 3 + 2), прогон — 129 pass / 5 fail (все 5 — `E/questionnaire-ux.e2e.test.ts`, TR-57).

**Сокращения путей** (как в `questionnaire-bot.md`; при проверке ссылок раскрывались скриптом):

- `Q/` = `runners/u7-bot/src/controllers/questionnaire/stories/`
- `E/` = `runners/u7-bot/tests/e2e/`
- `T/` = `runners/u7-bot/src/infra/`
- `C/` = `runners/u7-bot/src/core/`
- `P/` = `platform/core/src/ui/bot/`

Действия: `удалить` / `слить в <файл>:<строка>` / `переписать` / `перенести в <файл>` / `отложить до course-dmg` / `отложить: удалить с кодом`. Тесты, оставленные без изменений, в таблицу не входят (перечень — «Итог»).

Ссылки «где покрыто» проверены скриптом (60 ссылок, 43 уникальных) и чтением: файл существует, строка начинается с `it(`/`test(`/`test.each(`, тест проверяет то же и **не удаляется и не переносится этой таблицей** (цепочек «A покрыт B, B удалён» нет). Для тестов, переезжающих в новый файл, адрес указан как `<файл назначения> ← <старый файл>:<строка>`: номер строки в новом файле определяется порядком переноса (раздел «Перенести»). Номера строк — по текущему коду worktree.

## Таблица

| файл | строка | имя теста | Б-ID | действие | где покрыто |
|---|---|---|---|---|---|
| `Q/fill.dialog.test.ts` | 153 | текстовый ответ: finalize предыдущего вопроса + screen следующего | Б-5 | слить в `Q/fill.story.dmg.test.ts:84` | — (в `:84` добавляются проверки `finalize` и `screen`) |
| `Q/fill.dialog.test.ts` | 215 | completed без предыдущего вопроса: только screen + release, без finalize | Б-12 | слить в `Q/fill.dialog.test.ts:189` | — (второй кейс `test.each` у `:189`) |
| `Q/fill.dialog.test.ts` | 332 | текст при choice-вопросе (CHOICE_EXPECTED): warn «Ошибка валидации», экран не трогаем | Б-9 | слить в `Q/fill.story.dmg.test.ts:192` | — (в `:192` добавляются `finalize`/`awaitInput` = `undefined`) |
| `Q/fill.dialog.test.ts` | 361 | internal-ошибка UC: общая реплика без утечки деталей, ввод живёт | Б-9 | удалить | `Q/fill.story.dmg.test.ts:292` (та же ветка, строже: ещё `logger.error`) |
| `Q/fill.dialog.test.ts` | 482 | wait_next: прогресс тоже показывается | Б-6 | слить в `Q/fill.dialog.test.ts:464` | — (второй кейс `test.each` у `:464`) |
| `Q/fill.dialog.test.ts` | 525 | выбран хотя бы один вариант — «Далее» присутствует | Б-6 | удалить | `Q/inventory.test.ts:108` (ряд «Далее» с кодом `fill:next:{qId}:{qCode}`); отсутствие — `Q/fill.dialog.test.ts:548` |
| `Q/fill.dialog.test.ts` | 640 | started: профиля нет — тишина и warn | Б-3 | удалить | `Q/invite.story.dmg.test.ts:337` (канон `resolveRespondent`) |
| `Q/fill.dialog.test.ts` | 654 | started: профиль без telegramId — тишина и warn | Б-3 | удалить | `Q/invite.story.dmg.test.ts:354` |
| `Q/fill.dialog.test.ts` | 671 | started: сбой get-user — тишина и warn, без падения | Б-3 | удалить | `Q/invite.story.dmg.test.ts:371` |
| `Q/fill.dialog.test.ts` | 793 | неактивная fill: pass без побочных действий | Б-9 | удалить | `C/u7-bot-ui-story.test.ts:478` |
| `Q/fill.dialog.test.ts` | 806 | прочая команда (/help): pass — дефолт контракта U7BotUiStory | Б-9 | удалить | `C/u7-bot-ui-story.test.ts:432` |
| `Q/fill.story.dmg.test.ts` | 220 | EMPTY_ANSWER_CODE: warn «Ошибка валидации» с текстом отказа | Б-9 | удалить | `Q/fill.story.dmg.test.ts:192` (та же ветка `!ok` → `ucErrorNotify`; различие только в коде ошибки — это домен) |
| `Q/fill.story.dmg.test.ts` | 246 | NOT_IN_PROGRESS: warn с label, экран не трогаем | Б-9 | удалить | `Q/fill.story.dmg.test.ts:192` (та же ветка; текст `label` — TST-09) |
| `Q/fill.story.dmg.test.ts` | 270 | access: warn с denyMessage правила | Б-9 | удалить | `P/bot-ui-story.test.ts:521` |
| `Q/fill.story.dmg.test.ts` | 400 | internal: общий текст без утечки label, кнопка меню | Б-6 | удалить | `Q/fill.story.dmg.test.ts:314` (та же ветка `#showCurrent` → `ucErrorScreen`), `Q/render.error-screen.test.ts:91` (ветка `internal`) |
| `Q/fill.story.dmg.test.ts` | 416 | активная fill: getCurrent → confirm-экран, abandon не вызывается | Б-5 | удалить | `Q/fill.dialog.test.ts:731` (тот же `/cancel` и те же коды кнопок) |
| `Q/fill.story.dmg.test.ts` | 437 | getCurrent отказал → «Отменено. Наберите /start» без экрана | Б-5 | удалить | `Q/fill.dialog.test.ts:768` |
| `Q/fill.story.dmg.test.ts` | 462 | неактивная fill: pass, UC не вызываются | Б-9 | удалить | `C/u7-bot-ui-story.test.ts:478` |
| `Q/fill.story.warning.test.ts` | 29 | подписки включают abandonWarning и abandoned | Б-3 | удалить | `Q/fill.dialog.test.ts:578` (точный список четырёх подписок `FillStory`) |
| `Q/fill.story.warning.test.ts` | 36 | с courseId: кнопки «Продолжить» (мост resume) и «Прервать» (confirm), подсказка /start | — | перенести в `Q/fill.story.events.test.ts` | — (единственный сторож кодов кнопок `abandonWarning`) |
| `Q/fill.story.warning.test.ts` | 61 | без courseId — кнопка только «Прервать» | — | перенести в `Q/fill.story.events.test.ts` | — (единственный сторож ветки «моста нет») |
| `Q/fill.story.warning.test.ts` | 77 | нет адреса (профиля нет) — тишина и warn | Б-3 | удалить | `Q/invite.story.dmg.test.ts:337` |
| `Q/fill.story.warning.test.ts` | 93 | reason=timeout — notify без кнопок | — | перенести в `Q/fill.story.events.test.ts` | — (единственный сторож текста S08 и «кнопок нет») |
| `Q/fill.story.warning.test.ts` | 111 | reason=by_user (ручное прерывание) — дубля нет, ничего не шлём | — | перенести в `Q/fill.story.events.test.ts` | — (после слияния с `:122` — `test.each(['by_user','declined'])`) |
| `Q/fill.story.warning.test.ts` | 122 | reason=declined (отказ от приглашения) — ничего не шлём | Б-6 | слить в `Q/fill.story.warning.test.ts:111` (→ перенесённый в `Q/fill.story.events.test.ts`) | — (второй кейс `test.each` у `:111`) |
| `Q/fill.story.warning.test.ts` | 133 | timeout без адреса (профиля нет) — слать некому, warn | Б-3 | удалить | `Q/invite.story.dmg.test.ts:337` |
| `Q/fill.story.continue-invite.test.ts` | 26 | подписка зарегистрирована | Б-3 | удалить | `Q/fill.dialog.test.ts:578` |
| `Q/fill.story.continue-invite.test.ts` | 32 | сообщение «продолжим?» с кнопками «Продолжить анкету» и «Прервать» | — | перенести в `Q/fill.story.events.test.ts` | — (единственный сторож кодов кнопок `continueInvite`) |
| `Q/fill.story.continue-invite.test.ts` | 55 | без courseId — кнопки-моста нет, только «Прервать» | — | перенести в `Q/fill.story.events.test.ts` | — (единственный сторож ветки «моста нет») |
| `Q/fill.story.continue-invite.test.ts` | 71 | нет адреса (профиля нет) — тишина и warn | Б-3 | удалить | `Q/invite.story.dmg.test.ts:337` |
| `Q/invite.dialog.test.ts` | 44 | start:q → start-by-invite + delegate fill:current:{qId} — ввод адресуется fill-диалогу | Б-5 | удалить | `Q/invite.story.dmg.test.ts:43` |
| `Q/invite.dialog.test.ts` | 65 | start:q при недоступной анкете: экран ошибки с выходом в меню | Б-5 | удалить | `Q/invite.story.dmg.test.ts:73` |
| `Q/invite.dialog.test.ts` | 91 | подписка invited: текст с спецсимволами безопасен | Б-5 | удалить | `Q/invite.story.dmg.test.ts:230` (тот же `escapeMarkdown` + коды кнопок) |
| `Q/invite.dialog.test.ts` | 110 | invite:why: whyText с спецсимволами безопасен | — | перенести в `Q/invite.story.dmg.test.ts` | — (единственная проверка эскейпинга `whyText` в `#handleWhy`) |
| `Q/invite.dialog.test.ts` | 127 | invite:invite: повторный S01 с небезопасным inviteText | Б-5 | удалить | `Q/invite.story.dmg.test.ts:230` (тот же `renderActionResponse` и эскейпинг) |
| `Q/invite.dialog.test.ts` | 143 | cancelWarning в confirm-экране пропуска (decline) безопасен | — | слить в `Q/invite.dialog.test.ts:110` (→ перенесённый в `Q/invite.story.dmg.test.ts`) | — (второй кейс `test.each`: `cancelWarning`) |
| `Q/invite.dialog.test.ts` | 164 | подписка: без inviteText — «Заполните, пожалуйста, анкету.» | Б-5 | удалить | `Q/invite.story.dmg.test.ts:276` |
| `Q/invite.dialog.test.ts` | 181 | invite:why: без whyText — «Нет дополнительной информации.» | Б-5 | удалить | `Q/invite.story.dmg.test.ts:106` (тот же `?? 'Нет дополнительной информации.'`) |
| `Q/invite.story.dmg.test.ts` | 63 | start:{qId}: результат startByInvite (ok) игнорируется — делегат в fill | Б-6 | удалить | `Q/invite.story.dmg.test.ts:43` (тот же делегат, строже: ещё `callers` и `input` UC) |
| `Q/inventory.test.ts` | 158 | S04 completed: кнопка «↩️ Главное меню» (app:main-menu) + release | Б-3 | удалить | `Q/fill.dialog.test.ts:189` (текст завершения + `release`), `Q/fill.story.dmg.test.ts:359` (общий `buttons.mainMenu()`) |
| `Q/inventory.test.ts` | 182 | S05a cancel: confirm-кнопки «Да, прервать» / «Нет, продолжить» с qId | Б-6 | удалить | `Q/fill.dialog.test.ts:731` (те же тексты и коды) |
| `Q/inventory.test.ts` | 206 | S05b cancel-confirm: «Анкета прервана.» + главное меню + release | Б-3 | удалить | `Q/fill.story.dmg.test.ts:157` (текст + `release`), `:359` (`buttons.mainMenu()`) |
| `Q/inventory.test.ts` | 222 | fill:resume:{courseId}: экран вопроса + awaitInput с questionnaireId | Б-6 | удалить | `Q/fill.story.dmg.test.ts:121` (то же, строже: ещё вызовы UC) |
| `Q/inventory.test.ts` | 251 | fill:resume — анкета не найдена: экран с главным меню | Б-3 | удалить | `Q/fill.story.dmg.test.ts:359` |
| `Q/inventory.test.ts` | 266 | fill:current:{qId}: экран вопроса + awaitInput (восстановление флоу) | Б-6 | удалить | `Q/fill.story.dmg.test.ts:107` (то же, строже: ещё `getCurrent` в `dispatch`) |
| `Q/inventory.test.ts` | 285 | неизвестный action: экран «⚠️ Неизвестная команда» без кнопок | Б-9 | удалить | `P/bot-ui-story.test.ts:638` |
| `Q/inventory.test.ts` | 298 | S01 (подписка invited): invite-канал, ПОЛНЫЕ коды кнопок | Б-6 | переписать | — (остаётся только `getEventSubscriptions()` = `['invited']`; коды — `Q/invite.story.dmg.test.ts:371`, `:230`) |
| `Q/inventory.test.ts` | 337 | S01 без whyText: кнопка «Зачем это нужно?» не показывается | Б-6 | удалить | `Q/invite.story.dmg.test.ts:256` (дословный дубль: тот же вход, тот же список подписей) |
| `Q/inventory.test.ts` | 357 | invite:why:{qId}: экран whyText + кнопка «✅ Хорошо» → invite:invite | Б-6 | переписать | — (остаётся код `invite:invite:{qId}`; текст `whyText` — `Q/invite.story.dmg.test.ts:93`) |
| `Q/inventory.test.ts` | 371 | invite:invite:{qId}: повторный S01, кнопки start/why/decline | Б-6 | переписать | — (остаются три кода `invite:start:{qId}` / `invite:why:{qId}` / `invite:decline:{qId}`; текст `inviteText` — `Q/invite.story.dmg.test.ts:116`) |
| `Q/inventory.test.ts` | 393 | invite:decline:{qId} (S06a): confirm-кнопки с cancelWarning | Б-6 | переписать | — (остаются коды `invite:decline-confirm` / `invite:invite`; тексты — `Q/invite.story.dmg.test.ts:130`, эскейпинг `cancelWarning` — перенесённый `:110`) |
| `Q/inventory.test.ts` | 416 | invite:decline-confirm:{qId} (S06b): «Анкета пропущена.» + меню + release | Б-3 | удалить | `Q/invite.story.dmg.test.ts:142` (текст + `release`), `Q/fill.story.dmg.test.ts:359` (`buttons.mainMenu()`) |
| `Q/inventory.test.ts` | 432 | invite:start:{qId}: delegate в fill:current:{qId} (диалог fill, не invite) | Б-6 | удалить | `Q/invite.story.dmg.test.ts:43` |
| `Q/inventory.test.ts` | 450 | invited: экран приглашения с кнопками invite-стори | Б-2 | удалить | `Q/inventory.test.ts:371` (дословный дубль: те же подписи и коды `invite:start`/`invite:why`/`invite:decline`, но через `invite:{qId}`, с составом подписок и `getCurrent`) |
| `Q/render.error-screen.test.ts` | 36 | conflict: «⚠️ label» и кнопка меню | Б-6 | слить в `Q/render.error-screen.test.ts:29` | — (второй кейс `test.each(['not_found','conflict'])`: `render.ts:252-254` — одна ветка) |
| `E/questionnaire-events.e2e.test.ts` | 193 | started с courseId: приглашение «заполнить анкету» с кнопкой-мостом resume | Б-4 | переписать | — (оставить факт доставки и действие кнопки `questionnaire:fill:resume:`; текст приглашения — `Q/fill.dialog.test.ts:592`) |
| `E/questionnaire-events.e2e.test.ts` | 216 | started без courseId: подсказка входа через /start, без кнопок | Б-4 | удалить | `Q/fill.dialog.test.ts:612` |
| `E/questionnaire-events.e2e.test.ts` | 265 | invited без профиля респондента: сообщения нет, бот не падает, следующее событие доходит | Б-6 | слить в `E/questionnaire-events.e2e.test.ts:338` | — (добавить `invited` из реального UC в перечень «без профиля — тишина») |
| `E/questionnaire-events.e2e.test.ts` | 289 | abandonWarning: «Анкета приостановлена» с кнопками «Продолжить» и «Прервать» | Б-4 | удалить | `Q/fill.story.events.test.ts` ← `Q/fill.story.warning.test.ts:36` |
| `E/questionnaire-events.e2e.test.ts` | 303 | continueInvite: «продолжим?» с кнопками «Продолжить анкету» и «Прервать» | Б-4 | удалить | `Q/fill.story.events.test.ts` ← `Q/fill.story.continue-invite.test.ts:32` |
| `E/questionnaire-events.e2e.test.ts` | 314 | abandoned(timeout): уведомление о закрытии из-за неактивности | Б-4 | удалить | `Q/fill.story.events.test.ts` ← `Q/fill.story.warning.test.ts:93` |
| `E/questionnaire-events.e2e.test.ts` | 326 | abandoned(by_user): сообщения нет | Б-9 | удалить | `Q/fill.story.events.test.ts` ← `Q/fill.story.warning.test.ts:111` |
| `E/questionnaire-events.e2e.test.ts` | 332 | abandoned(declined): сообщения нет | Б-6 | удалить | `Q/fill.story.events.test.ts` ← `Q/fill.story.warning.test.ts:111` (после слияния с `:122`) |
| `E/questionnaire-ux.e2e.test.ts` | 200 | radio: выбор → финализация Q1 с маркером (x) и БЕЗ клавиатуры | Б-4 | отложить до course-dmg | `Q/fill.dialog.test.ts:76`, `T/bot-transport.test.ts:663` |
| `E/questionnaire-ux.e2e.test.ts` | 228 | multiple: тоггл редактирует на месте, «Далее» появляется/исчезает | Б-4 | отложить до course-dmg | `Q/fill.dialog.test.ts:249`, `T/bot-transport.test.ts:663` |
| `E/questionnaire-ux.e2e.test.ts` | 276 | «Далее» → финализация Q3 + completed новым сообщением | Б-4 | отложить до course-dmg | `Q/fill.dialog.test.ts:189`, `T/bot-transport.test.ts:663` |
| `E/questionnaire-ux.e2e.test.ts` | 339 | при чужом активном флоу: приглашение без предупреждения → «Продолжить анкету» переключает диалог | — | отложить до course-dmg | — (единственная проверка «мост открывает анкету поверх чужого флоу» на уровне транспорта; после `course-dmg` остаётся) |
| `E/questionnaire-ux.e2e.test.ts` | 420 | без сессии (якорь app/invite): приглашение живо, кнопка открывает анкету | Б-4 | отложить до course-dmg | `T/bot-transport.test.ts:1376`, `E/questionnaire-ux.e2e.test.ts:339` |

## Переписать (5)

1. `Q/inventory.test.ts:298` — оставить только состав подписок `InviteStory` (`getEventSubscriptions()` → `['questionnaire.invited']`); подписи и коды кнопок S01 снять: код диалога — `Q/invite.story.dmg.test.ts:371`, полные коды проактива — `:230`.
2. `Q/inventory.test.ts:357` — снять проверку текста `whyText` (дубль `Q/invite.story.dmg.test.ts:93`), оставить код кнопки `invite:invite:{qId}`; подпись кнопки остаётся здесь — поведенческого дубля нет.
3. `Q/inventory.test.ts:371` — снять проверку текста `inviteText` (дубль `Q/invite.story.dmg.test.ts:116`), оставить три кода (`invite:start:{qId}`, `invite:why:{qId}`, `invite:decline:{qId}`) — единственный unit-сторож этой формы.
4. `Q/inventory.test.ts:393` — снять тексты подтверждения (дубли `Q/invite.story.dmg.test.ts:130` и перенесённого `:110`), оставить коды `invite:decline-confirm:{qId}` и `invite:invite:{qId}`.
5. `E/questionnaire-events.e2e.test.ts:193` — оставить «`started` из реального `startQuestionnaire` → сообщение доставлено, кнопка несёт действие `questionnaire:fill:resume:`»; тексты приглашения снять (unit — `Q/fill.dialog.test.ts:592`).

## Слить (8)

1. `Q/fill.dialog.test.ts:153` → `Q/fill.story.dmg.test.ts:84` — добавить проверки `finalize` (предыдущий вопрос) и `screen` (следующий вопрос) к тесту текстового входа.
2. `Q/fill.dialog.test.ts:215` → `Q/fill.dialog.test.ts:189` — второй кейс `test.each`: `completed` без `previousQuestion` → `finalize` нет, `release` есть.
3. `Q/fill.dialog.test.ts:332` → `Q/fill.story.dmg.test.ts:192` — в `:192` добавить `finalize`/`awaitInput` = `undefined` (переспрос не перерисовывает экран и не отпускает ввод).
4. `Q/fill.dialog.test.ts:482` → `Q/fill.dialog.test.ts:464` — второй кейс `test.each`: шапка «Вопрос N из M» строится и из `wait_next`.
5. `Q/fill.story.warning.test.ts:122` → `Q/fill.story.warning.test.ts:111` (после переноса — `Q/fill.story.events.test.ts`) — `test.each(['by_user','declined'])`: обе причины молчат.
6. `Q/invite.dialog.test.ts:143` → `Q/invite.dialog.test.ts:110` (после переноса — `Q/invite.story.dmg.test.ts`) — второй вход `test.each`: `cancelWarning` в confirm-экране пропуска тоже MarkdownV2-безопасен.
7. `Q/render.error-screen.test.ts:36` → `Q/render.error-screen.test.ts:29` — `test.each(['not_found','conflict'])`: обе `kind` дают «⚠️ label» + меню (`render.ts:252-254`).
8. `E/questionnaire-events.e2e.test.ts:265` → `E/questionnaire-events.e2e.test.ts:338` — добавить `invited` (реальный `SendLikertInvite` с неизвестным `respondentId`) в перечень событий «без профиля молчат, следующее доходит».

## Перенести (7)

Порядок переноса — он же порядок строк в новом файле.

1. `Q/fill.story.warning.test.ts:36` → `Q/fill.story.events.test.ts` — `abandonWarning` с `courseId`: канал invite, тексты, полные коды кнопок-мостов.
2. `…/fill.story.warning.test.ts:61` → там же — `abandonWarning` без `courseId`: моста нет, только «Прервать».
3. `…/fill.story.warning.test.ts:93` → там же — `abandoned(timeout)`: `notify` без кнопок, текст о неактивности, MarkdownV2.
4. `…/fill.story.warning.test.ts:111` → там же — `abandoned` с `reason ≠ timeout`: тишина (`test.each` вместе со слитым `:122`).
5. `Q/fill.story.continue-invite.test.ts:32` → там же — `continueInvite`: «продолжим?» + полные коды кнопок.
6. `…/fill.story.continue-invite.test.ts:55` → там же — `continueInvite` без `courseId`: только «Прервать».
7. `Q/invite.dialog.test.ts:110` → `Q/invite.story.dmg.test.ts` — MarkdownV2-безопасность `whyText` (плюс кейс `cancelWarning` из `:143`).

После переносов файлы `Q/fill.story.warning.test.ts`, `Q/fill.story.continue-invite.test.ts`, `Q/invite.dialog.test.ts` удаляются; появляется `Q/fill.story.events.test.ts`.

## Остающиеся проверки `label`

Пять одиночных `expect` внутри полезных тестов читают текст `label`/`denyMessage` отказа; снимаются этим же срезом (остальные проверки строки сохраняются):

| файл:строка `expect` | что снимается | что остаётся |
|---|---|---|
| `Q/fill.dialog.test.ts:837` | `toContain('Анкета не найдена')` — `QuestionnaireErrors.NOT_FOUND.label` | `:838` кнопка «⬅️ Меню» |
| `Q/fill.story.dmg.test.ts:212` (до `:214`) | `toContain('Ожидался ответ с выбором \\(нажатием кнопки\\)')` — `label` отказа `handleAction` | `:211` `notify.kind = 'warn'`, `:215` префикс платформы «Ошибка валидации» |
| `Q/fill.story.dmg.test.ts:329` | `toContain('Анкета не найдена')` | `:330` `buttonsOf`, `:331` `awaitInput` = `undefined` |
| `Q/fill.story.dmg.test.ts:353` (до `:355`) | `toContain('Нет доступа к списку анкет пользователя')` — `denyMessage` Policy | `:356` `buttonsOf` = «⬅️ Меню» |
| `Q/fill.story.dmg.test.ts:395` | `toContain('Анкета не активна')` | `:396` `buttonsOf`, `:397` `release` = `undefined` |

Отдельно: `Q/render.error-screen.test.ts` (`:29`, `:43`, `:55`, `:79`, `:106`) — не проверки `label` Def, а тесты собственной логики `ucErrorScreen` (ветвление по `kind`, приоритет `denyMessage`, перечень `issues`, эскейпинг). Подписи там — локальные фикстуры, от правки `QuestionnaireErrors.*.label` не падают; файл остаётся. `.label` в остальных тестах области встречается только как вход `refuse(...)`.

## Б-7 и состав модуля

Паспортов Def (Б-7) в области бота нет: `normalize(`/`ArchChecker` в тестах анкеты не встречаются (0 случаев). Тест состава модуля — один, доменный: `domain/src/questionnaire/questionnaire.module.test.ts:49` (`dependsOn: ['user']`, агрегат, 9 UC, Job); этой таблицей не затрагивается, при нехватке `dependsOn` его правит доменная таблица.

В боте роль «состава» держат не паспорта, а сторожа подписок стори, их остаётся по одному на стори:

- `FillStory` — `Q/fill.dialog.test.ts:578` (точный список `started`, `abandonWarning`, `continueInvite`, `abandoned`); дубли `Q/fill.story.warning.test.ts:29`, `Q/fill.story.continue-invite.test.ts:26` удаляются.
- `InviteStory` — `Q/inventory.test.ts:298` после переписывания (список из одной подписки `invited`).

## Итог

**Всего строк в таблице: 68.**

| действие | сколько |
|---|---|
| удалить | 43 |
| слить | 8 |
| переписать | 5 |
| перенести | 7 |
| отложить до course-dmg | 5 |

**Ожидаемое состояние области: 80 объявлений / 88 кейсов** (было 131 / 134), прогон — **83 pass, 5 fail** (те же 5 красных в `E/questionnaire-ux.e2e.test.ts`, TR-57). Арифметика:

- −43 кейса и −43 объявления: удаления (все — по одному кейсу на объявление);
- −8 объявлений, +5 кейсов: слияния; пять из них дают новый кейс таблицы (`:215`, `:482`, `:122`, `:143`, `render:36`), три (`:153`, `:332`, `events:265`) добавляют только ассерты в существующий кейс;
- переписывания и переносы число кейсов не меняют.

По файлам: `Q/fill.dialog.test.ts` 20/22, `Q/fill.story.dmg.test.ts` 13/13, `Q/fill.story.events.test.ts` 6/7 (новый), `Q/inventory.test.ts` 7/7, `Q/invite.story.dmg.test.ts` 19/22, `Q/render.error-screen.test.ts` 7/9, `E/questionnaire-events.e2e.test.ts` 3/3, `E/questionnaire-ux.e2e.test.ts` 5/5. Исчезают 3 файла: `Q/fill.story.warning.test.ts`, `Q/fill.story.continue-invite.test.ts`, `Q/invite.dialog.test.ts`.

**Кандидатов инвентаризации не вошло — 5** (пересмотрено по правилам проверки ссылок):

- `Q/fill.story.dmg.test.ts:292` — оставлен: на него ссылается `Q/fill.dialog.test.ts:361` как на канон внутреннего отказа в ветке ввода (он строже дубля: ещё `logger.error`); удаление обоих размазало бы покрытие между `P/bot-ui-story.test.ts:547` (текст) и `:192` (ветка).
- `Q/invite.story.dmg.test.ts:93`, `:116`, `:130` — оставлены: их «покрытие» в инвентаризации указывало на `Q/inventory.test.ts:357`/`:371`/`:393`, а те по решению 2 переписываются в реестр кодов и теряют проверки текстов и `dispatch`; после переписывания эти три теста — единственные поведенческие входы `why:`, `invite:`, `decline:`.
- `Q/invite.story.dmg.test.ts:256` — оставлен, а его дубль `Q/inventory.test.ts:337` удалён вместо него (решение 2: тексты — поведенческим тестам, а не паспорту).

**Строки, добавленные сверх кандидатов инвентаризации:** `Q/invite.dialog.test.ts:127` (Б-5, дубль `Q/invite.story.dmg.test.ts:230`); `Q/inventory.test.ts:337` (см. выше); `E/questionnaire-ux.e2e.test.ts:339` (решение 3 — весь файл отложен); `Q/inventory.test.ts:357`/`:371`/`:393` (переписаны по решению 2); семь строк «перенести» и одна «слить» — следствие слияния файлов по решению 1. `Q/inventory.test.ts:85` и `:108` остаются без изменений: они держат коды `fill:answer:`/`fill:next:` и нумерацию кнопок, поведенческого дубля у них нет.

**Спорные строки:**

1. `Q/inventory.test.ts:357`/`:371`/`:393` — решение 2 требует снять проверки подписей кнопок; снимаю только тексты тела, подписи оставляю: после чистки `❔ Зачем это нужно?` и `✅ Хорошо` / `✅ Да, пропустить` не держит ни один поведенческий тест, а единственный уровень кодов (e2e) красный до `course-dmg`. Подписи снимаются при закрытии `course-dmg`.
2. `Q/fill.dialog.test.ts:525` — удаляется с покрытием `Q/inventory.test.ts:108`, но там останется код `fill:next:` без текста «Далее -->»; положительное присутствие держит код, отрицательное — `Q/fill.dialog.test.ts:548` (по тексту). Если нужен симметричный текстовый сторож, строку `:525` не удалять.
3. `Q/fill.story.dmg.test.ts:220`/`:246`/`:400` — инвентаризация предлагала «слить», оставляю `удалить`: ветка `!ok → ucErrorNotify` одна, различия только в `kind`/коде ошибки, а ветвление по `kind` держит `P/bot-ui-story.test.ts:521`/`:547` и `Q/render.error-screen.test.ts:91`.
4. `E/questionnaire-events.e2e.test.ts:193` — оставлен как «переписать», хотя тексты уходят: без него `started` (единственное событие с реальным UC и мостом `resume`) не проверяется на шине вообще.
5. `Q/fill.dialog.test.ts:153` — сливается в `Q/fill.story.dmg.test.ts:84`, то есть проверка `finalize` для текстового входа переезжает на уровень «вызовы UC»; альтернатива — оставить `:153` и слить туда `:84` (тогда наоборот теряется проверка `input` UC).

**После `course-dmg` (для плана, не сейчас):** в `E/questionnaire-ux.e2e.test.ts` дублями станут `:200` (покрыт `Q/fill.dialog.test.ts:76` + `T/bot-transport.test.ts:663`), `:228` (`Q/fill.dialog.test.ts:249` + `T/bot-transport.test.ts:663`), `:276` (`Q/fill.dialog.test.ts:189` + `T/bot-transport.test.ts:663`), `:420` (`T/bot-transport.test.ts:1376` + `:339`); остаётся `:339`. Тогда же: снять подписи кнопок из `Q/inventory.test.ts:357`/`:371`/`:393`, решить вопрос orchestrator о слиянии `E/questionnaire-ux.e2e.test.ts` с `E/wish-questionnaire.e2e.test.ts` (пересечение — `:253`, `:334`, `:399`, см. `questionnaire-bot.md` §5 п. 3) и удалить `inviteKeyboard` (`render.ts:46`) вместе с экспортом (Б-13).
