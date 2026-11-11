# Таблица удаления тестов: бот `peer-review` (отзывы)

Трек `tst-cleanup_20261105`, фаза 2 (срез `peer-review`, уровень бота). Основание — инвентаризация [`peer-review-bot.md`](./peer-review-bot.md) (кандидаты, Б-1…Б-13, Н1, «Полезные тесты», открытые вопросы), закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-14), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), [`bot-test.md` §2 п. 5](../../../architecture/ui/bot-test.md) («уровни не повторяют друг друга»), решения трека [`spec.md`](../spec.md) «Решения» и решения по открытым вопросам инвентаризации (приняты перед таблицей):

1. `E/peer-review-smoke.e2e.test.ts` — вариант (а): файл остаётся с одним тестом «событие судьбы → кампания видна субъекту через `get-my-campaigns`». Правки в файле — в порядке: удалить `:143`, затем править `:99` (`:143` опирается на кампанию, созданную `:99`, — состояние стенда, а не своё).
2. `renderSchoolReviewCard` — `review-render.test.ts:89` `удалить`, канон — `school/stories/school-reviews.story.test.ts:137` (срез `school` в этом треке не чистится).
3. Четыре «запасные подписи» (`scope-reviews:334`, `reviews-for-me:221`, `invite:296`, `my-reviews:392`) — оставить все четыре (разные ветки `??`).
4. «💬 Отзывы» в карточке потока — `view.e2e:180` `удалить`: unit-канон `streams` по текущему коду — `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:776` (строка сдвинулась относительно инвентаризации, проверено; таблица среза `stream` её не удаляет).
5. `E/peer-review-campaign.e2e.test.ts:74` — не трогать (в таблицу не входит).
6. `campaign.story.test.ts:436` (Н1) — `переписать`: одна проверка «экран открывается и содержит ключевой маркер», без фраз текста.
7. Б-13 (`authorLine`, `review-render.ts:56`) — тест не трогаем: `отложить: удалить с кодом`.

**Область:** `runners/u7-bot/src/controllers/peer-review/**/*.test.ts` (8 файлов) и `runners/u7-bot/tests/e2e/peer-review-*.e2e.test.ts` (6 файлов). База: **127 объявлений / 127 кейсов** (`test.each`/`.skip`/`.todo` в области нет), прогон `cd runners/u7-bot && CI=true bun test src/controllers/peer-review tests/e2e/peer-review` → **127 pass, 0 fail, 822 expect()**. Красных из-за `course-dmg` (TR-57) в области нет — строк «отложить до course-dmg» нет.

Действия: `удалить` / `слить в <файл>:<строка>` / `переписать` / `перенести в <файл>` / `отложить до course-dmg` / `отложить: удалить с кодом`. Тесты, оставленные без изменений, в таблицу не входят (перечень — «Итог»).

Ссылки «где покрыто» проверены скриптом (27 адресов) и чтением: файл существует, строка начинается с `it(`/`test(`, тест проверяет то же и **не удаляется, не переписывается и не является целью слияния этой же таблицей** (цепочек «A покрыт B, B удалён» нет). Ссылки в другие уровни ведут только на тесты, которые инвентаризации уровней считают полезными: домен — [`peer-review-domain.md` §4](./peer-review-domain.md), модуль — [`peer-review-app.md` §4](./peer-review-app.md), `streams` — [`stream-bot-delete.md`](./stream-bot-delete.md) (удаляемых там из используемых нет). Номера строк — по текущему коду worktree; путь из инвентаризации `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:96` исправлен на `:93`/`:60` (в `:96` нет начала `it`), ссылка на `review-campaign/er/create-student-campaign.er.test.ts:12` снята: доменная инвентаризация считает все объявления этого файла кандидатами, владелец вертикали — `modules/peer-review/src/peer-review.module.test.ts:123`.

## Таблица

| файл | строка | имя теста | Б-ID | действие | где покрыто |
|---|---|---|---|---|---|
| `runners/u7-bot/src/controllers/peer-review/controller.test.ts` | 20 | подписка приглашений S01 доставляется через контроллер | Б-9 | удалить | `runners/u7-bot/tests/e2e/peer-review-campaign.e2e.test.ts:74` (агрегация подписок контроллером на реальной шине), `runners/u7-bot/src/controllers/peer-review/stories/invite.story.test.ts:149` (обработчик достаётся по имени события) |
| `runners/u7-bot/src/controllers/peer-review/stories/invite.story.test.ts` | 143 | подписана на `peer-review.review-campaign.created` | Б-3 | удалить | `runners/u7-bot/src/controllers/peer-review/stories/invite.story.test.ts:149` (тот же поиск подписки в хелпере `campaignCreatedHandler`) |
| `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.test.ts` | 93 | подписана на `peer-review.review.created` | Б-3 | удалить | `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.test.ts:100` (тот же поиск подписки в хелпере `handler`) |
| `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.test.ts` | 173 | автор не найден — предупреждение, сообщение не отправляется | Б-6 | слить в `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.test.ts:161` | — (одна ветка `if (!author \|\| telegramId === undefined)`, `review-notify.story.ts:57`; кейс «нет автора» — второй вход `test.each` у `:161`) |
| `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.test.ts` | 182 | адресат не найден — предупреждение, сообщение не отправляется | Б-6 | слить в `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.test.ts:161` | — (та же ветка; третий вход `test.each`: адресата нет в выдаче `get-users-by-ids`) |
| `runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.test.ts` | 357 | есть входящие отзывы → в хабе ряд «📥 Отзывы мне» перед меню (S08) | Б-4 | удалить | `runners/u7-bot/tests/e2e/peer-review-reviews-for-me.e2e.test.ts:115` (кнопка в хабе с живой кампанией: `pressedCode` без неё бросает); код `reviews-for-me:view` остаётся под `my-reviews.story.test.ts:389` |
| `runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.test.ts` | 195 | автор-ментор (`mentor_student`) — без лейбла исхода | Б-1 | удалить | `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts:40` (правило `authorLabel` — владелец) |
| `runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.test.ts` | 226 | группировка по адресатам: отзывы одного адресата идут подряд | Б-1 | удалить | `domain/src/peer-review/review/scope-reviews.dqs.test.ts:34` (группы в порядке первого появления, отзывы по `createdAt`; стори делает один `flatMap`, `scope-reviews.story.ts:97`) |
| `runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.test.ts` | 435 | навигация одним рядом; коды кнопок содержат номер страницы | Б-9 | удалить | `runners/u7-bot/tests/e2e/peer-review-view.e2e.test.ts:316` (листание по кодам из кнопок: неверный номер страницы ломает порядок `Стр. N/M`), `platform/core/src/ui/bot/page-nav.test.ts:48` (ряд строит `BotPaginator.navRows`) |
| `runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.test.ts` | 465 | листание не перечитывает домен: `list-scope-reviews` один раз (кеш) | Б-4 | удалить | `runners/u7-bot/tests/e2e/peer-review-view.e2e.test.ts:316` (`count(ListScopeReviewsUcDef.name) = 1` до и после полного цикла листания) |
| `runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.test.ts` | 489 | вызывает `list-scope-reviews` с `scopeIds: [scopeId]` | Б-6 | удалить | `runners/u7-bot/tests/e2e/peer-review-view.e2e.test.ts:316` (страницы S07 из фикстурного скоупа: неверный `scopeIds` → пустая выдача и заглушка) |
| `runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.test.ts` | 503 | одна страница коротких отзывов — без индикатора и навигации | Б-3 | удалить | `runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.test.ts:518` (тот же хелпер `pagedScreen`, `runners/u7-bot/src/core/u7-bot-ui-story.ts:222`), `platform/core/src/ui/bot/page-nav.test.ts:85` |
| `runners/u7-bot/src/controllers/peer-review/stories/reviews-for-me.story.test.ts` | 161 | автор-ментор (`mentor_student`) — без лейбла исхода | Б-1 | удалить | `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts:40` |
| `runners/u7-bot/src/controllers/peer-review/stories/reviews-for-me.story.test.ts` | 287 | неизвестная команда — экран `unknownCommand` | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` |
| `runners/u7-bot/src/controllers/peer-review/stories/campaign.story.test.ts` | 234 | list: UC-вызовы — адресаты, поток по `scopeId`, имена адресатов | Б-6 | удалить | `runners/u7-bot/src/controllers/peer-review/stories/campaign.story.test.ts:163` (тот же вход, проверка по эффекту: заголовок потока из `scopeId`, имена в кнопках, метрики) |
| `runners/u7-bot/src/controllers/peer-review/stories/campaign.story.test.ts` | 436 | how: справка «Как писать отзыв» — инфо-сообщение без кнопок, экран не трогается | Н1-bot | переписать | — (фразы текста — не ветвь кода; поведение держат `notify` + `screen`/`awaitInput` = `undefined`) |
| `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts` | 14 | обычный момент → `dd.mm.yyyy` | Б-6 | слить в `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts:18` | — (та же строка формата; у `reviewDate` других ветвей нет) |
| `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts` | 59 | `authorLine`: имя, роль, исход и дата | Б-13 | отложить: удалить с кодом | — (мёртвый экспорт `review-render.ts:56`: вне своего теста не импортируется ни в `runners/`, ни в `modules/`, ни в `domain/`) |
| `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts` | 89 | `renderSchoolReviewCard`: ментор, автор-ментор без лейбла исхода | Б-2 | удалить | `runners/u7-bot/src/controllers/school/stories/school-reviews.story.test.ts:137` (та же карточка строже: ментор, автор, роль, дата, поток, текст), `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts:40` (лейбл) |
| `runners/u7-bot/tests/e2e/peer-review-smoke.e2e.test.ts` | 83 | модуль `peer-review` зарегистрирован — `get-my-campaigns` отвечает | Б-10 | удалить | `runners/u7-bot/tests/e2e/peer-review-campaign.e2e.test.ts:74` (без регистрации модуля не создаётся кампания и не работает стори) |
| `runners/u7-bot/tests/e2e/peer-review-smoke.e2e.test.ts` | 99 | `student.completed` → ER создаёт кампанию (репозиторий + UC) | Б-1 | переписать | — (остаётся «событие судьбы → кампания в репозитории и видна субъекту через `get-my-campaigns`»; `participants` — `domain/src/peer-review/review-campaign/review-campaign.ar.test.ts:93`, `mentorId`/`subjectOutcome` — `:60`, вертикаль ER → шина — `modules/peer-review/src/peer-review.module.test.ts:123`) |
| `runners/u7-bot/tests/e2e/peer-review-smoke.e2e.test.ts` | 143 | `review-campaign.created` → приглашения субъекту и ментору на реальной шине | Б-4 | удалить | `runners/u7-bot/tests/e2e/peer-review-campaign.e2e.test.ts:74` (те же два приглашения и полные коды кнопок), `runners/u7-bot/src/controllers/peer-review/stories/invite.story.test.ts:149` |
| `runners/u7-bot/tests/e2e/peer-review-hub.e2e.test.ts` | 67 | menuButtons: без кампаний кнопки «💬 Отзывы» нет | Б-4 | удалить | `runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.test.ts:84` |
| `runners/u7-bot/tests/e2e/peer-review-hub.e2e.test.ts` | 75 | живая кампания → кнопка меню видна (`kind` callback, приоритет 25) | Б-4 | удалить | `runners/u7-bot/tests/e2e/peer-review-hub.e2e.test.ts:97` (нажимает эту кнопку — без неё падает), `runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.test.ts:69` (`kind`/`priority`/`action`) |
| `runners/u7-bot/tests/e2e/peer-review-hub.e2e.test.ts` | 191 | окно истекло во время ввода → экран-заглушка «возможность закрыта» | Б-4 | удалить | `runners/u7-bot/src/controllers/peer-review/stories/campaign.story.test.ts:733` (та же ветка `WINDOW_CLOSED`, `campaign.story.ts:117-127`), код ошибки — `domain/src/peer-review/review/review.rules.test.ts:42` |
| `runners/u7-bot/tests/e2e/peer-review-view.e2e.test.ts` | 180 | карточка без отзывов — кнопки «💬 Отзывы» нет | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:776` (unit-канон ветви; кнопку строит `streams`) |
| `runners/u7-bot/tests/e2e/peer-review-view.e2e.test.ts` | 187 | карточка с отзывами — кнопка открывает S07: группы, роли, лейблы | Б-4 | переписать | — (остаётся «из карточки потока открывается S07 на реальных данных» + код моста; группы/роли/лейблы — `runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.test.ts:129` и `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts:25`) |
| `runners/u7-bot/tests/e2e/peer-review-reviews-for-me.e2e.test.ts` | 106 | отзывов нет → в хабе нет кнопки «📥 Отзывы мне» | Б-4 | удалить | `runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.test.ts:373` |

## Переписать (3)

1. `runners/u7-bot/src/controllers/peer-review/stories/campaign.story.test.ts:436` — оставить: `response.notify` с одним ключевым маркером («Как писать отзыв» — заголовок справки), `assertDialogResponseMarkdownSafe(response)`, `response.screen` и `response.awaitInput` = `undefined` (инфо-сообщение не перерисовывает экран и не сбрасывает ввод, `campaign.story.ts:65-68`); снять фразы «Сначала — сильные стороны», «Пиши своё», «Пиши о навыках и фактах», «Ярлык и переход на личности», «Как превратить ярлык в полезный отзыв», «Экран ввода остаётся активным».
2. `runners/u7-bot/tests/e2e/peer-review-smoke.e2e.test.ts:99` — оставить «`completeStudent` → кампания в репозитории и видна субъекту через `get-my-campaigns`»; снять `subjectOutcome`, `mentorId`, `participants` и проверку менторской выдачи; убрать ставший ненужным `transport` (`createTestBotTransport`, `transport.reset()`) и импорты `TestBotTransport`, `PeerReviewController`; шапку файла свести к одному сценарию. **Порядок:** строку `:143` удалить раньше этой правки.
3. `runners/u7-bot/tests/e2e/peer-review-view.e2e.test.ts:187` — оставить «карточка потока → кнопка «💬 Отзывы» → экран S07 с заголовком потока и кнопкой «⬅️ Назад к потоку»» (мост между контроллерами через настоящий `callback_data`); снять группы/роли/лейблы блоков; открытие S07 сохранить — на этом экране живёт следующий тест `:224`.

## Слить (3)

1. `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.test.ts:173` → `:161` — `test.each` по трём причинам молчания: «нет автора», «нет `telegramId` у адресата», «адресата нет в выдаче» (одна ветка `review-notify.story.ts:57`, ассерты во всех трёх одинаковые — `sent` пуст, `warns` длиной 1).
2. `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.test.ts:182` → `:161` — тот же `test.each` (третий кейс).
3. `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts:14` → `:18` — добавить к граничному тесту строку обычного момента (`Date.UTC(2026, 8, 21, 10, 0)` → `21.09.2026`).

## Перенести (0)

Переносов нет: файлов-двойников (Б-5) и подлежащих слиянию файлов в области нет.

## Остающиеся проверки `label`

**Нет.** В области бота `peer-review` нет ни одного `expect` на `.label`/`denyMessage` ошибки (grep по `src/controllers/peer-review`, `tests/e2e/peer-review-*` — 0 вхождений). Тексты отказов, которые проверяют полезные тесты, — собственные тексты экранов стори, а не подписи Def: «Кампания не найдена» (`campaign.story.ts:175`, `:409`; проверки `campaign.story.test.ts:274`, `e2e/peer-review-hub.e2e.test.ts:187`) и «Возможность написать отзыв уже закрыта» (`campaign.story.ts:127`; `campaign.story.test.ts:757`, `e2e/peer-review-hub.e2e.test.ts:236`). Подписи доменных ошибок (`Кампания отзывов не найдена`, `Возможность оставлять отзывы закрыта: срок кампании истёк`) в тестах области не встречаются — снимать нечего.

## Б-7 и состав модуля

Паспортов Def (Б-7) и тестов схем платформы (Б-8) в области бота нет: `normalize(`, `ArchChecker`, `Object.keys(...Def`, `safeParse`/`v.parse` в тестах отзывов — 0 вхождений. Тест состава модуля остаётся один и доменный — `domain/src/peer-review/peer-review.module.test.ts:8` (7 UC, ER, `dependsOn`), этой таблицей не затрагивается.

В боте роль «состава» держит реестр стори — `runners/u7-bot/src/controllers/peer-review/controller.test.ts:5`. После удаления `:20` это единственный тест контроллера: он держит список шести стори (новый файл-паспорт экранов не заводится).

## Подготовка стенда при удалениях

1. `runners/u7-bot/tests/e2e/peer-review-hub.e2e.test.ts:75` — удаляя строку, перенести создание живой кампании (`completeStudent` + `waitUntil`) из тела теста в `beforeAll` описания, иначе без живых кампаний останутся `:97` и `:129`; после удаления `:67` убрать неиспользуемую константу `NO_CAMPAIGNS_TG` (строка 35).
2. `runners/u7-bot/src/controllers/peer-review/stories/review-render.test.ts:89` — после удаления убрать `renderSchoolReviewCard` из импорта файла (`noUnusedImports`); `authorLine` остаётся до удаления экспорта вместе с кодом (`:59`).

## Итог

**Всего строк в таблице: 28.**

| действие | сколько |
|---|---|
| удалить | 21 |
| слить | 3 |
| переписать | 3 |
| перенести | 0 |
| отложить: удалить с кодом | 1 |
| отложить до course-dmg | 0 |

**Ожидаемое состояние области: 103 объявления / 105 кейсов** (было 127 / 127), прогон `cd runners/u7-bot && CI=true bun test src/controllers/peer-review tests/e2e/peer-review` — **105 pass, 0 fail**. Арифметика:

- −21 кейс и −21 объявление: удаления (все — по одному кейсу на объявление);
- −2 объявления, ±0 кейсов: слияние `review-notify:173`/`:182` в `:161` — три объявления и три кейса становятся одним объявлением `test.each` с тремя кейсами;
- −1 объявление и −1 кейс: слияние `review-render:14` в `:18` (добавляются ассерты в существующий кейс);
- переписывания (`campaign:436`, `smoke:99`, `view:187`) число объявлений и кейсов не меняют; `отложить: удалить с кодом` — без изменений сейчас.

По файлам (объявлений / кейсов):

| файл | было | станет |
|---|---|---|
| `controller.test.ts` | 2/2 | 1/1 |
| `stories/campaign.story.test.ts` | 30/30 | 29/29 |
| `stories/invite.story.test.ts` | 15/15 | 14/14 |
| `stories/my-reviews.story.test.ts` | 19/19 | 18/18 |
| `stories/review-notify.story.test.ts` | 8/8 | 5/7 |
| `stories/review-render.test.ts` | 7/7 | 5/5 |
| `stories/reviews-for-me.story.test.ts` | 12/12 | 10/10 |
| `stories/scope-reviews.story.test.ts` | 14/14 | 8/8 |
| `tests/e2e/peer-review-campaign.e2e.test.ts` | 3/3 | 3/3 |
| `tests/e2e/peer-review-hub.e2e.test.ts` | 6/6 | 3/3 |
| `tests/e2e/peer-review-notify.e2e.test.ts` | 1/1 | 1/1 |
| `tests/e2e/peer-review-reviews-for-me.e2e.test.ts` | 3/3 | 2/2 |
| `tests/e2e/peer-review-smoke.e2e.test.ts` | 3/3 | 1/1 |
| `tests/e2e/peer-review-view.e2e.test.ts` | 4/4 | 3/3 |

Файлы не исчезают: `peer-review-smoke.e2e.test.ts` остаётся с одним тестом (решение 1а).

**Кандидатов инвентаризации не вошло — 0**: все 27 строк §3 инвентаризации в таблице. Строк добавлено сверх кандидатов — 1: `review-notify.story.test.ts:173` (та же ветка и те же ассерты, что у `:161`, — см. «Спорные строки»).

**Оставлено без изменений, хотя похоже на дубль** (для протокола, §2 инвентаризации): четыре «запасные подписи» (решение 3), два clamp-теста (`scope-reviews:518`, `reviews-for-me:375` — разные реализации), два кеш-теста (`my-reviews:505`, `reviews-for-me:358` — каждая стори передаёт свой `session`), тексты приглашений (`invite:163`/`:194`/`:210`/`:225`/`:239` — ветви маппинга ролей исхода, не косметика), экранирование (`invite:328`, `review-render:72`), `E/peer-review-campaign.e2e.test.ts:74` (решение 5), `E/peer-review-view.e2e.test.ts:224` и `:316` (рабочие мосты и пагинация S07 на реальных данных), `E/peer-review-hub.e2e.test.ts:174` (единственный сторож ветви `if (!card)`), `E/peer-review-notify.e2e.test.ts:58` (единственная проверка «`review.created` — только на первой записи» на шине), `E/peer-review-reviews-for-me.e2e.test.ts:176`.

**Спорные строки:**

1. `runners/u7-bot/src/controllers/peer-review/stories/my-reviews.story.test.ts:357` — удаляется unit в пользу e2e (`peer-review-reviews-for-me.e2e.test.ts:115`), то есть обратное направление Б-4; код `reviews-for-me:view` остаётся под `:389`, но порядок «ряд перед главным меню» в хабе с живыми карточками после удаления не проверяется нигде (в e2e проверено только наличие кнопки). Если симметричный сторож порядка нужен — строку не удалять.
2. `runners/u7-bot/src/controllers/peer-review/stories/review-notify.story.test.ts:173` — инвентаризация держала как полезный; удаляю в `test.each` у `:161`, потому что ветка одна (`review-notify.story.ts:57`) и ассерты идентичны; «нет автора» как вход остаётся, поэтому мутация «убрать `!author` из условия» по-прежнему падает.
3. `runners/u7-bot/tests/e2e/peer-review-hub.e2e.test.ts:75` — удаление требует переноса подготовки стенда в `beforeAll` (см. «Подготовка стенда»); удалять строку без переноса нельзя — упадут `:97` и `:129`.
4. `runners/u7-bot/tests/e2e/peer-review-smoke.e2e.test.ts:99`/`:143` — «покрыто» опирается на доменные `review-campaign.ar.test.ts:60`/`:93` и модульную вертикаль `modules/peer-review/src/peer-review.module.test.ts:123`; доменная таблица пишется параллельно — если она снимет `:60`/`:93`, снятие `participants`/`mentorId`/`subjectOutcome` в `:99` потеряет канон (вертикаль `:123` остаётся, но без полей). Правку `:99` делать после приёмки доменной таблицы.
5. `runners/u7-bot/src/controllers/peer-review/stories/scope-reviews.story.test.ts:503` — удаляется единственная проверка «одна страница без навигации» для S07; остаётся `my-reviews:518` на том же хелпере `pagedScreen` (`u7-bot-ui-story.ts:222`), но каждая стори передаёт своё `session`/`cbPage`. Если нужен свой сторож для S07 — строку не удалять.
