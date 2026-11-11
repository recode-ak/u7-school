# Инвентаризация тестов: бот `questionnaire` (анкеты)

Трек `tst-cleanup_20261105`, фаза 2 (срез `questionnaire`, уровень бота). Правила: `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), [`bot-test.md` §2 п. 5](../../../architecture/ui/bot-test.md) («уровни не повторяют друг друга»), решения трека [`spec.md`](../spec.md) «Решения», закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-13). Кандидатов относим к Б-ID, новых закономерностей — одна (Н1, уровень файла, см. §2).

**Область:** `runners/u7-bot/src/controllers/questionnaire/**/*.test.ts` (8 файлов) и `runners/u7-bot/tests/e2e/{questionnaire-ux,questionnaire-events}.e2e.test.ts`. Базовая линия области — **129 объявлений / 134 кейса** (`test.each` разворачивается). Прогон `CI=true bun test <10 файлов>`: **129 pass, 5 fail** — все 5 красных в `questionnaire-ux.e2e.test.ts` (TR-57, незавершённый `course-dmg`, `conductor/architecture/debt.md`). `tests/e2e/wish-questionnaire.e2e.test.ts` прочитан только для поиска повторов (в область не входит).

**Сокращения путей в таблицах** (проверены скриптом в развёрнутом виде):

- `Q/` = `runners/u7-bot/src/controllers/questionnaire/stories/`
- `E/` = `runners/u7-bot/tests/e2e/`
- `T/` = `runners/u7-bot/src/infra/`
- `C/` = `runners/u7-bot/src/core/`
- `P/` = `platform/core/src/ui/bot/`

**Что есть сейчас.** Две стори — `FillStory` (`fill.story.ts`: подписки, `answer:`/`next:`/`current:`/`resume:`/`cancel:`/`cancel-confirm:`, текст, `/cancel`, `#cancelConfirmScreen`, `#handleCancelConfirmed`, `#renderUc`) и `InviteStory` (`invite.story.ts`: подписка `invited`, `start:`/`why:`/`invite:`/`decline:`/`decline-confirm:`, делегат в fill), общий рендер `render.ts` (`renderActionResponse`, `formatQuestionMd`, `getKeyboard`, `progressOf`, `ucErrorScreen`) и общий хелпер адреса `QuestionnaireStory.resolveRespondent` (`questionnaire-story.ts:17`). Тесты разложены **восемью** файлами на две стори — по «теме» (`*.dialog`, `*.story.dmg`, `*.story.warning`, `*.story.continue-invite`, `inventory`, `*.error-screen`); интеграционного уровня по анкете нет совсем, его роль берут e2e.

## 1. Сводка

| файл | объявлений | кейсов | полезен | сомнителен | пуст |
|---|---:|---:|---:|---:|---:|
| `Q/fill.dialog.test.ts` | 31 | 31 | 20 | 11 | 0 |
| `Q/fill.story.dmg.test.ts` | 20 | 20 | 12 | 8 | 0 |
| `Q/fill.story.warning.test.ts` | 8 | 8 | 4 | 4 | 0 |
| `Q/fill.story.continue-invite.test.ts` | 4 | 4 | 2 | 2 | 0 |
| `Q/invite.dialog.test.ts` | 8 | 8 | 3 | 5 | 0 |
| `Q/invite.story.dmg.test.ts` | 17 | 21 | 16 | 5 | 0 |
| `Q/inventory.test.ts` | 18 | 18 | 7 | 11 | 0 |
| `Q/render.error-screen.test.ts` | 8 | 9 | 8 | 1 | 0 |
| `E/questionnaire-ux.e2e.test.ts` | 5 | 5 | 1 | 4 | 0 |
| `E/questionnaire-events.e2e.test.ts` | 10 | 10 | 2 | 8 | 0 |
| **Итого** | **129** | **134** | **75** | **59** | **0** |

Кандидатов 59 из 134 (44%) — в диапазоне 31–62%, зафиксированном для слоёв `wish`/`stream`. «Пустых» тестов (не могут упасть вовсе) нет: каждая строка таблицы падает при хотя бы одной реальной ошибке, просто ту же ошибку уже ловит другая строка или платформа.

Красная зона: `E/questionnaire-ux.e2e.test.ts` — 5 из 5 красных (`«Хочу пройти курс» не найдена`: пустой каталог из legacy-чтения `courses.json`, TR-57). Это не признак бесполезности: файл — единственное место, где анкета проверяется на уровне Telegram-экранов. Вердикты по нему отложены (`отложить до course-dmg`).

## 2. Закономерности

Встречены 7 из 13 Б-ID. Числа — кандидаты §3.

| ID | случаев | примеры (2–3) |
|---|---:|---|
| Б-2 | 1 | `Q/inventory.test.ts:450` — `renderActionResponse({type:'invited'})` дёргается напрямую, хотя единственный потребитель покрыт: `Q/inventory.test.ts:371` (та же ветка через `invite:{qId}`). |
| Б-3 | 12 | `resolveRespondent` (`questionnaire-story.ts:17`, 3 ветки) проверен девятью тестами в четырёх файлах (6 копий + 3 канона): `Q/fill.dialog.test.ts:640`/`:654`/`:671`, `Q/fill.story.warning.test.ts:77`/`:133`, `Q/fill.story.continue-invite.test.ts:71` — те же «тишина + warn», что в `Q/invite.story.dmg.test.ts:337`/`:354`/`:371`. Плюс состав `getEventSubscriptions` (общий метод стори) повторён тремя файлами: `Q/fill.story.warning.test.ts:29`, `Q/fill.story.continue-invite.test.ts:26` ⊂ точный список `Q/fill.dialog.test.ts:578`. Плюс общий хелпер кнопки `buttons.mainMenu()` asserted в каждом экране инвентаря: `Q/inventory.test.ts:158`, `:206`, `:251`, `:416`. |
| Б-4 | 9 | E2E дословно повторяет unit: `E/questionnaire-events.e2e.test.ts:289` ↔ `Q/fill.story.warning.test.ts:36`, `:303` ↔ `Q/fill.story.continue-invite.test.ts:32`, `:216` ↔ `Q/fill.dialog.test.ts:612`; `E/questionnaire-ux.e2e.test.ts:200` — composite «finalize + edit без клавиатуры», оба слоя покрыты по отдельности (`Q/fill.dialog.test.ts:76`, `T/bot-transport.test.ts:663`). |
| Б-5 | 8 | Файлы-двойники одного переезда: `Q/invite.dialog.test.ts:44` ↔ `Q/invite.story.dmg.test.ts:43`, `:65` ↔ `:73`, `:164` ↔ `:276`; `Q/fill.dialog.test.ts:153` ↔ `Q/fill.story.dmg.test.ts:84`, `Q/fill.story.dmg.test.ts:416` ↔ `Q/fill.dialog.test.ts:731`. |
| Б-6 | 17 | Копия соседнего теста без нового класса входа: один и тот же `ucErrorScreen`/`renderActionResponse` по другому `kind`/входу — `Q/render.error-screen.test.ts:36` (`conflict` после `not_found`), `Q/fill.story.dmg.test.ts:400` (`internal` после `not_found` в `:314`), `Q/inventory.test.ts:222`/`:251`/`:266` (дубли `Q/fill.story.dmg.test.ts:121`/`:359`/`:107`), `Q/fill.story.warning.test.ts:122` (`declined` после `by_user`). |
| Б-9 | 11 | Поведение платформы/ядра: `ucErrorNotify` в `Q/fill.story.dmg.test.ts:270`/`:292` (покрыто `P/bot-ui-story.test.ts:521`/`:547`), дефолт `handleCommand` в `Q/fill.dialog.test.ts:793`/`:806` и `Q/fill.story.dmg.test.ts:462` (покрыто `C/u7-bot-ui-story.test.ts:478`/`:432`), «Неизвестная команда» в `Q/inventory.test.ts:285`, «событий нет» отдельным `it` — `E/questionnaire-events.e2e.test.ts:326`. |
| Б-12 | 1 | `Q/fill.dialog.test.ts:215` — «`previousQuestion` нет → `finalize` нет»: отрицательная ветка `if (response.previousQuestion)` (`render.ts:124`), положительная в `:189`, поле опционально по типу. |

**Новых закономерностей уровня отдельного `it` не выявлено** — все случаи легли в Б-2…Б-12.

**Н1. Файл-паспорт UI-экранов (уровень файла).** Признак: отдельный `*.test.ts`, чья задача — перечислить точные тексты и коды **всех** кнопок **всех** экранов одной фичи (`Q/inventory.test.ts`, имена `S01…S06b`, `flatButtons(res)` в каждом `it`). Почему плох: полный паспорт текстов падает от любой косметической правки (`render.ts`/`ui-spec.md`) и потому требует правки тестов на каждый перенос, а по существу дублирует ассерты поведенческих тестов и общих хелперов (`buttons.mainMenu()` — 4 копии, `Б-3`); полезны в нём только строки, держащие **формирование `callback_data`** (`fill:answer:`, `fill:next:`, `invite:*`) — на unit-уровне их больше не держит никто (`bot-test.md` §2 п. 3 отдаёт коды e2e, а e2e по анкете красные). Примеры: полезные `Q/inventory.test.ts:85`, `:108`, `:357`, `:371`, `:393`; дубли `:182`, `:206`, `:222`, `:251`, `:266`, `:416`, `:450`. Рекомендация: файл не удалять, а переписать в «реестр кодов» (только `callback_data` и состав подписок), тексты оставить поведенческим тестам. Строки `inventory.test.ts` в §3 помечены Б-ID/Б-3 как обычно — Н1 объясняет, почему таких строк там много.

## 3. Кандидаты

Действия: `удалить` / `слить в <адрес>` / `переписать` / `отложить до course-dmg`. Ссылки «где покрыто» — начало конкретного `it`/`test`, который сам в этой таблице не удаляется (проверено скриптом: файл существует, строка начинается с `it(`/`test(`/`test.each(`).

| путь:строка | имя теста | Б-ID | где покрыто | что делать |
|---|---|---|---|---|
| `Q/fill.dialog.test.ts:153` | текстовый ответ: finalize предыдущего вопроса + screen следующего | Б-5 | `Q/fill.dialog.test.ts:76`, `Q/fill.story.dmg.test.ts:84` | слить в `Q/fill.story.dmg.test.ts:84` |
| `Q/fill.dialog.test.ts:215` | completed без предыдущего вопроса: только screen + release, без finalize | Б-12 | `Q/fill.dialog.test.ts:189` | слить в `Q/fill.dialog.test.ts:189` |
| `Q/fill.dialog.test.ts:332` | текст при choice-вопросе (CHOICE_EXPECTED): warn «Ошибка валидации», экран не трогаем | Б-9 | `Q/fill.story.dmg.test.ts:192` | удалить |
| `Q/fill.dialog.test.ts:361` | internal-ошибка UC: общая реплика без утечки деталей, ввод живёт | Б-9 | `Q/fill.story.dmg.test.ts:192`, `P/bot-ui-story.test.ts:547` | удалить |
| `Q/fill.dialog.test.ts:482` | wait_next: прогресс тоже показывается | Б-6 | `Q/fill.dialog.test.ts:464` | слить в `Q/fill.dialog.test.ts:464` |
| `Q/fill.dialog.test.ts:525` | выбран хотя бы один вариант — «Далее» присутствует | Б-6 | `Q/inventory.test.ts:108` | удалить |
| `Q/fill.dialog.test.ts:640` | started: профиля нет — тишина и warn | Б-3 | `Q/invite.story.dmg.test.ts:337` | удалить |
| `Q/fill.dialog.test.ts:654` | started: профиль без telegramId — тишина и warn | Б-3 | `Q/invite.story.dmg.test.ts:354` | удалить |
| `Q/fill.dialog.test.ts:671` | started: сбой get-user — тишина и warn, без падения | Б-3 | `Q/invite.story.dmg.test.ts:371` | удалить |
| `Q/fill.dialog.test.ts:793` | неактивная fill: pass без побочных действий | Б-9 | `C/u7-bot-ui-story.test.ts:478` | удалить |
| `Q/fill.dialog.test.ts:806` | прочая команда (/help): pass — дефолт контракта U7BotUiStory | Б-9 | `C/u7-bot-ui-story.test.ts:432` | удалить |
| `Q/fill.story.dmg.test.ts:220` | EMPTY_ANSWER_CODE: warn «Ошибка валидации» с текстом отказа | Б-9 | `Q/fill.story.dmg.test.ts:192` | слить в `Q/fill.story.dmg.test.ts:192` |
| `Q/fill.story.dmg.test.ts:246` | NOT_IN_PROGRESS: warn с label, экран не трогаем | Б-9 | `Q/fill.story.dmg.test.ts:192` | слить в `Q/fill.story.dmg.test.ts:192` |
| `Q/fill.story.dmg.test.ts:270` | access: warn с denyMessage правила | Б-9 | `P/bot-ui-story.test.ts:521` | удалить |
| `Q/fill.story.dmg.test.ts:292` | internal: общая реплика без утечки деталей, ввод живёт | Б-9 | `P/bot-ui-story.test.ts:547` | удалить |
| `Q/fill.story.dmg.test.ts:400` | internal: общий текст без утечки label, кнопка меню | Б-6 | `Q/fill.story.dmg.test.ts:314` | слить в `Q/fill.story.dmg.test.ts:314` |
| `Q/fill.story.dmg.test.ts:416` | активная fill: getCurrent → confirm-экран, abandon не вызывается | Б-5 | `Q/fill.dialog.test.ts:731` | удалить |
| `Q/fill.story.dmg.test.ts:437` | getCurrent отказал → «Отменено. Наберите /start» без экрана | Б-5 | `Q/fill.dialog.test.ts:768` | удалить |
| `Q/fill.story.dmg.test.ts:462` | неактивная fill: pass, UC не вызываются | Б-9 | `C/u7-bot-ui-story.test.ts:478` | удалить |
| `Q/fill.story.warning.test.ts:29` | подписки включают abandonWarning и abandoned | Б-3 | `Q/fill.dialog.test.ts:578` | удалить |
| `Q/fill.story.warning.test.ts:77` | нет адреса (профиля нет) — тишина и warn | Б-3 | `Q/invite.story.dmg.test.ts:337` | удалить |
| `Q/fill.story.warning.test.ts:122` | reason=declined (отказ от приглашения) — ничего не шлём | Б-6 | `Q/fill.story.warning.test.ts:111` | слить в `Q/fill.story.warning.test.ts:111` |
| `Q/fill.story.warning.test.ts:133` | timeout без адреса (профиля нет) — слать некому, warn | Б-3 | `Q/invite.story.dmg.test.ts:337` | удалить |
| `Q/fill.story.continue-invite.test.ts:26` | подписка зарегистрирована | Б-3 | `Q/fill.dialog.test.ts:578` | удалить |
| `Q/fill.story.continue-invite.test.ts:71` | нет адреса (профиля нет) — тишина и warn | Б-3 | `Q/invite.story.dmg.test.ts:337` | удалить |
| `Q/invite.dialog.test.ts:44` | start:q → start-by-invite + delegate fill:current:{qId} | Б-5 | `Q/invite.story.dmg.test.ts:43` | удалить |
| `Q/invite.dialog.test.ts:65` | start:q при недоступной анкете: экран ошибки с выходом в меню | Б-5 | `Q/invite.story.dmg.test.ts:73` | удалить |
| `Q/invite.dialog.test.ts:91` | подписка invited: текст с спецсимволами безопасен | Б-5 | `Q/invite.story.dmg.test.ts:230` | удалить |
| `Q/invite.dialog.test.ts:164` | подписка: без inviteText — «Заполните, пожалуйста, анкету.» | Б-5 | `Q/invite.story.dmg.test.ts:276` | удалить |
| `Q/invite.dialog.test.ts:181` | invite:why: без whyText — «Нет дополнительной информации.» | Б-5 | `Q/invite.story.dmg.test.ts:106` | удалить |
| `Q/invite.story.dmg.test.ts:63` | start:{qId}: результат startByInvite (ok) игнорируется — делегат в fill | Б-6 | `Q/invite.story.dmg.test.ts:43` | удалить |
| `Q/invite.story.dmg.test.ts:93` | why:{qId} → getCurrent, whyText на экране | Б-6 | `Q/inventory.test.ts:357` | удалить |
| `Q/invite.story.dmg.test.ts:116` | invite:{qId} → getCurrent, повторный S01 | Б-6 | `Q/inventory.test.ts:371` | удалить |
| `Q/invite.story.dmg.test.ts:130` | decline:{qId} → getCurrent для confirm-экрана пропуска | Б-6 | `Q/inventory.test.ts:393` | удалить |
| `Q/invite.story.dmg.test.ts:256` | без whyText — кнопки «Зачем» нет | Б-6 | `Q/inventory.test.ts:337` | удалить |
| `Q/inventory.test.ts:158` | S04 completed: кнопка «↩️ Главное меню» (app:main-menu) + release | Б-3 | `Q/fill.dialog.test.ts:189`, `Q/fill.story.dmg.test.ts:359` | удалить |
| `Q/inventory.test.ts:182` | S05a cancel: confirm-кнопки «Да, прервать» / «Нет, продолжить» с qId | Б-6 | `Q/fill.dialog.test.ts:731` | удалить |
| `Q/inventory.test.ts:206` | S05b cancel-confirm: «Анкета прервана.» + главное меню + release | Б-3 | `Q/fill.story.dmg.test.ts:157` | удалить |
| `Q/inventory.test.ts:222` | fill:resume:{courseId}: экран вопроса + awaitInput с questionnaireId | Б-6 | `Q/fill.story.dmg.test.ts:121` | удалить |
| `Q/inventory.test.ts:251` | fill:resume — анкета не найдена: экран с главным меню | Б-3 | `Q/fill.story.dmg.test.ts:359` | удалить |
| `Q/inventory.test.ts:266` | fill:current:{qId}: экран вопроса + awaitInput (восстановление флоу) | Б-6 | `Q/fill.story.dmg.test.ts:107` | удалить |
| `Q/inventory.test.ts:285` | неизвестный action: экран «⚠️ Неизвестная команда» без кнопок | Б-9 | `P/bot-ui-story.test.ts:638` | удалить |
| `Q/inventory.test.ts:298` | S01 (подписка invited): invite-канал, ПОЛНЫЕ коды кнопок | Б-6 | `Q/invite.story.dmg.test.ts:230` | переписать (оставить состав подписок) |
| `Q/inventory.test.ts:416` | invite:decline-confirm:{qId} (S06b): «Анкета пропущена.» + меню + release | Б-3 | `Q/invite.story.dmg.test.ts:142` | удалить |
| `Q/inventory.test.ts:432` | invite:start:{qId}: delegate в fill:current:{qId} (диалог fill, не invite) | Б-6 | `Q/invite.story.dmg.test.ts:43` | удалить |
| `Q/inventory.test.ts:450` | invited: экран приглашения с кнопками invite-стори | Б-2 | `Q/inventory.test.ts:371` | удалить |
| `Q/render.error-screen.test.ts:36` | conflict: «⚠️ label» и кнопка меню | Б-6 | `Q/render.error-screen.test.ts:29` | слить в `Q/render.error-screen.test.ts:29` |
| `E/questionnaire-ux.e2e.test.ts:200` | radio: выбор → финализация Q1 с маркером (x) и БЕЗ клавиатуры | Б-4 | `Q/fill.dialog.test.ts:76`, `T/bot-transport.test.ts:663` | отложить до course-dmg |
| `E/questionnaire-ux.e2e.test.ts:228` | multiple: тоггл редактирует на месте, «Далее» появляется/исчезает | Б-4 | `Q/fill.dialog.test.ts:249`, `T/bot-transport.test.ts:663` | отложить до course-dmg |
| `E/questionnaire-ux.e2e.test.ts:276` | «Далее» → финализация Q3 + completed новым сообщением | Б-4 | `Q/fill.dialog.test.ts:189`, `T/bot-transport.test.ts:663` | отложить до course-dmg |
| `E/questionnaire-ux.e2e.test.ts:420` | без сессии (якорь app/invite): приглашение живо, кнопка открывает анкету | Б-4 | `T/bot-transport.test.ts:1376`, `E/questionnaire-ux.e2e.test.ts:339` | отложить до course-dmg |
| `E/questionnaire-events.e2e.test.ts:193` | started с courseId: приглашение с кнопкой-мостом resume | Б-4 | `Q/fill.dialog.test.ts:592` | переписать (факт доставки + код, тексты убрать) |
| `E/questionnaire-events.e2e.test.ts:216` | started без courseId: подсказка входа через /start, без кнопок | Б-4 | `Q/fill.dialog.test.ts:612` | удалить |
| `E/questionnaire-events.e2e.test.ts:265` | invited без профиля респондента: сообщения нет, бот не падает | Б-6 | `E/questionnaire-events.e2e.test.ts:338` | слить в `E/questionnaire-events.e2e.test.ts:338` |
| `E/questionnaire-events.e2e.test.ts:289` | abandonWarning: «Анкета приостановлена» с кнопками | Б-4 | `Q/fill.story.warning.test.ts:36` | удалить |
| `E/questionnaire-events.e2e.test.ts:303` | continueInvite: «продолжим?» с кнопками | Б-4 | `Q/fill.story.continue-invite.test.ts:32` | удалить |
| `E/questionnaire-events.e2e.test.ts:314` | abandoned(timeout): уведомление о закрытии из-за неактивности | Б-4 | `Q/fill.story.warning.test.ts:93` | удалить |
| `E/questionnaire-events.e2e.test.ts:326` | abandoned(by_user): сообщения нет | Б-9 | `Q/fill.story.warning.test.ts:111` | удалить |
| `E/questionnaire-events.e2e.test.ts:332` | abandoned(declined): сообщения нет | Б-6 | `Q/fill.story.warning.test.ts:111` | удалить |

## 4. Полезные тесты

- `Q/fill.dialog.test.ts` — 20 тестов, полезны: контракт «Диалог и Экран» в `DialogResponse` — finalize-маркеры radio/мультивыбора (`:76`, `:120`), `completed` + `completionText`/release (`:189`, `:233`), `wait_next` — edit-in-place без `finalize` (`:249`), `awaitInput` и подсказка `/cancel` на первом вопросе (`:289`, `:308`), реплики `stale_answer` и наблюдаемость (`:400`, `:418`, `:436`), шапка «Вопрос N из M» (`:464`), отсутствие «Далее» без выбора (`:548`), состав подписок `FillStory` (`:578`), проактив `started` (`:592`, `:612`, `:629`), фильтр активной standard-анкеты для `resume` (`:691`), `/cancel` → confirm-экран и два вида отказа (`:731`, `:768`, `:822`).
- `Q/fill.story.dmg.test.ts` — 12 тестов, полезны: вход команды UC — разбор `answer:`/`next:`/текст и субъект-актор (`:47`, `:69`, `:84`), `current`/`resume` → `getCurrent` + `awaitInput` (`:107`, `:121`), `cancel-confirm` → `abandon` + release (`:157`), `cancel:` не трогает анкету до подтверждения (`:175`), ветка ввода при отказе UC (`:192`), экранная ветка отказа `#showCurrent`/`#handleResume` (`:314`, `:334`), «нет подходящей анкеты» (`:359`), `cancel-confirm` при `NOT_ACTIVE` → экран ошибки с меню, без release (`:376`).
- `Q/fill.story.warning.test.ts` — 4 теста, полезны: проактив `abandonWarning` — канал invite, тексты и ПОЛНЫЕ коды кнопок (`:36`), вариант без `courseId` (`:61`), `abandoned(timeout)` → notify (`:93`), тишина при `reason !== 'timeout'` (`:111`).
- `Q/fill.story.continue-invite.test.ts` — 2 теста, полезны: проактив `continueInvite` — текст «продолжим?» и полные коды (`:32`), вариант без `courseId` (`:55`).
- `Q/invite.dialog.test.ts` — 3 теста, полезны: MarkdownV2-безопасность `whyText` (`:110`), ветки `renderActionResponse({type:'invited'})` с опасным `inviteText` (`:127`), `cancelWarning` в confirm-экране пропуска (`:143`).
- `Q/invite.story.dmg.test.ts` — 16 тестов (14 объявлений), полезны: `start` → `startByInvite` от актора + делегат в fill (`:43`), отказ старта → экран ошибки без делегата (`:73`), `why` при не-invited состоянии (`:106`), `decline-confirm` → `declineInvite` + release (`:142`), три входа на `ucErrorScreen` (`:162`), отказ `declineInvite` без release (`:177`), адресация подписки `invited` (`:205`), `inviteText` + полные коды кнопок (`:230`), fallback-текст приглашения (`:276`), не-invited и отказ `getCurrent` с warn (`:293`, `:316`), канон `resolveRespondent`: нет профиля / нет telegramId / сбой `get-user` (`:337`, `:354`, `:371`).
- `Q/inventory.test.ts` — 7 тестов, полезны: единственный unit-сторож формирования `callback_data` — `fill:answer:` и ряд «Далее -->» (`:85`, `:108`), экран текстового вопроса S03 без клавиатуры (`:139`), S01 без `whyText` (`:337`), экран «зачем» с кнопкой `invite:invite` (`:357`), повторный S01 через `renderActionResponse` (`:371`), confirm-экран отказа S06a (`:393`).
- `Q/render.error-screen.test.ts` — 8 тестов (7 объявлений), полезны: собственная логика `ucErrorScreen` (`render.ts:233`) — `label` для `not_found` (`:29`), `denyMessage` важнее `label` и fallback (`:43`, `:55`), `validation` с `issues` и без (`:61`, `:79`), `internal`/`unauthorized` без утечки + error-лог (`:91`), экранирование `label` в MarkdownV2 (`:106`).
- `E/questionnaire-ux.e2e.test.ts` — 1 тест полезен: переключение диалога из чужого флоу по кнопке-мосту «Продолжить анкету» (`:339`) — единственная проверка «мост открывает анкету поверх чужого ввода» на уровне транспорта (сейчас красный, TR-57).
- `E/questionnaire-events.e2e.test.ts` — 2 теста полезны: `invited` — сжатие uuid и три кнопки об одной анкете (`:236`, единственный уровень, ловящий `callback_data`), устойчивость шины — три события без профиля молчат и следующее доходит (`:338`).

## 5. Открытые вопросы

1. **Слияние файлов-двойников (Б-5, TST-08 «один сценарий — один файл»).** После чистки в `Q/invite.dialog.test.ts` остаётся 3 теста (`:110`, `:127`, `:143`), в `Q/fill.story.warning.test.ts` — 4, в `Q/fill.story.continue-invite.test.ts` — 2. Варианты: (а) слить `invite.dialog` в `invite.story.dmg` и оба «проактив»-файла в один `fill.story.events.test.ts` — остаётся 5 файлов: `fill.dialog` (20), `fill.story.dmg` (12), `fill.story.events` (6), `inventory` (7), `invite.story.dmg` (16); (б) только удалить дубли в этой чистке, мерж — отдельным шагом. Рекомендация: (а), но отдельным коммитом после удалений (переименование файлов даёт большой дифф).
2. **Судьба `Q/inventory.test.ts` (Н1).** Файл — единственное unit-место, где держатся коды `fill:answer:`/`fill:next:`/`invite:*`; по `bot-test.md` §2 п. 3 эту роль отдают e2e, а e2e анкеты красные. Варианты: (а) переписать в «реестр кодов» (11 строк-дублей убрать, тексты — поведенческим тестам) — 7 тестов; (б) разнести коды по поведенческим тестам и удалить файл. Рекомендация: (а).
3. **Красная зона `E/questionnaire-ux.e2e.test.ts` (TR-57).** Все 5 тестов красные; 4 из них после `course-dmg` станут дублями unit + `T/bot-transport.test.ts` (`:200`, `:228`, `:276`, `:420`), `:339` остаётся. Пересечение с `E/wish-questionnaire.e2e.test.ts`: `:253` (apply → приглашение → Q1), `:334` (/cancel), `:399` (полное прохождение) — возможно, после `course-dmg` слить оба файла в один e2e анкеты. Вопрос orchestrator: чистить файл сейчас (только удалять нельзя — нечего проверять, пока каталог пуст) или ждать `course-dmg` и решать вместе с мержем.
4. **`E/questionnaire-events.e2e.test.ts` после чистки — 2 теста + 1 переписанный.** Подтвердить, что «шина → стори → sender» достаточно одной пары событий (`started` из реального UC + `invited` со сжатием uuid), а ветки/тексты/отрицательные (`by_user`, `declined`) живут только в unit (`bot-test.md` §2 п. 5, TST-08). Альтернатива — оставить по одному e2e на каждое из 5 Def-событий (текущий вид, 10 тестов, 7 дублей).
5. **Где живёт канон `resolveRespondent`.** Три ветки общего хелпера (`questionnaire-story.ts:17`) сейчас канонично проверены в `Q/invite.story.dmg.test.ts:337/354/371`, шесть копий удаляются. Если orchestrator предпочтёт отдельный `questionnaire-story.test.ts` на базовый класс (он обслуживает обе стори), три канона переезжают туда. Побочно: экспорт `inviteKeyboard` (`render.ts:46`) нигде не импортируется вне `render.ts` — сигнал Б-13 (убрать экспорт), теста у него нет.
