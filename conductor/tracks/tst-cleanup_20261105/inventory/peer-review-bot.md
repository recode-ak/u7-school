# Инвентаризация тестов: бот `peer-review` (отзывы)

Трек `tst-cleanup_20261105`, фаза 2 (срез `peer-review`, уровень бота). Правила: `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09), [`bot-test.md` §2 п. 5](../../../architecture/ui/bot-test.md) («уровни не повторяют друг друга»), решения трека [`spec.md`](../spec.md) «Решения», закономерности [`test-bloat.md` §2](../../../roadmap/test-bloat.md) (Б-1…Б-14). Кандидаты отнесены к Б-ID; новых закономерностей — одна (Н1).

**Область:** `runners/u7-bot/src/controllers/peer-review/**/*.test.ts` (7 файлов + `controller.test.ts`) и `runners/u7-bot/tests/e2e/peer-review-*.e2e.test.ts` (6 файлов). Фактическая база — **127 объявлений / 127 кейсов** (`test.each`/`.skip`/`.todo` в области нет): 107 unit + 20 e2e. Прогон `CI=true bun test src/controllers/peer-review tests/e2e/peer-review`: **127 pass, 0 fail, 822 expect(), 14 файлов, 911 ms**. Заявленная в вызове база 131 = 127 + 4 теста `src/controllers/school/stories/school-reviews.story.test.ts` (файл вне области, прочитан только для поиска повторов).

**Сокращения путей в таблицах:**

- `PR/` = `runners/u7-bot/src/controllers/peer-review/`
- `S/` = `runners/u7-bot/src/controllers/peer-review/stories/`
- `E/` = `runners/u7-bot/tests/e2e/`
- `V/` = `runners/u7-bot/src/controllers/streams/stories/` (чужой модуль, используется только в ссылках «где покрыто»)
- `SC/` = `runners/u7-bot/src/controllers/school/stories/` (чужой модуль, то же)
- `P/` = `platform/core/src/ui/bot/`
- `D/` = `domain/src/peer-review/`

**Что есть сейчас.** Тонкий контроллер-реестр `PR/controller.ts:22-34` (шесть стори, хаб `MyReviewsStory` передаётся в `CampaignStory` конструктором) и шесть стори: `S/invite.story.ts` (проактив S01 — два приглашения по `review-campaign.created`), `S/my-reviews.story.ts` (кнопка меню + хаб S02, пагинация `pagedScreen`), `S/campaign.story.ts` (S03→S05/S06, перезапись S04, возврат в родителя-хаб/список, `singleTargetOf`/`#backAction`/`#afterSaveResponse`), `S/scope-reviews.story.ts` (S07 по `view:<scopeId>[:page]`), `S/reviews-for-me.story.ts` (S08 по `view:<page>`, `cardPagedScreen`), `S/review-notify.story.ts` (проактив по `review.created`). Общий рендер — `S/review-render.ts` (7 экспортов, один из них мёртвый), тексты пар «роль-судьба» — `S/campaign-profiles.ts`, моки DMG — `S/peer-review-dmg.test-kit.ts` (`peerReviewDispatch`, `refuse`, `testCallers`). Файлов-двойников (Б-5), паспортов Def/схем (Б-7, Б-8) и файла-паспорта экранов (Б-14) в области нет. Интеграционного уровня по модулю нет: его роль берут 6 e2e-файлов на реальном `BotTransport`.

## 1. Сводка

| файл | объявлений | полезен | сомнителен | пуст |
|---|---:|---:|---:|---:|
| `PR/controller.test.ts` | 2 | 1 | 1 | 0 |
| `S/campaign.story.test.ts` | 30 | 28 | 2 | 0 |
| `S/invite.story.test.ts` | 15 | 14 | 1 | 0 |
| `S/my-reviews.story.test.ts` | 19 | 18 | 1 | 0 |
| `S/review-notify.story.test.ts` | 8 | 6 | 2 | 0 |
| `S/review-render.test.ts` | 7 | 4 | 3 | 0 |
| `S/reviews-for-me.story.test.ts` | 12 | 10 | 2 | 0 |
| `S/scope-reviews.story.test.ts` | 14 | 8 | 6 | 0 |
| `E/peer-review-campaign.e2e.test.ts` | 3 | 3 | 0 | 0 |
| `E/peer-review-hub.e2e.test.ts` | 6 | 3 | 3 | 0 |
| `E/peer-review-notify.e2e.test.ts` | 1 | 1 | 0 | 0 |
| `E/peer-review-reviews-for-me.e2e.test.ts` | 3 | 2 | 1 | 0 |
| `E/peer-review-smoke.e2e.test.ts` | 3 | 0 | 3 | 0 |
| `E/peer-review-view.e2e.test.ts` | 4 | 2 | 2 | 0 |
| **Итого** | **127** | **100** | **27** | **0** |

Кандидатов **27 из 127 (21 %)** — меньше диапазона 31–62 %, зафиксированного для слоёв `wish`/`stream`/`questionnaire`: бот `peer-review` писался сразу на DMG (стори тонкие, домен проверен ниже), поэтому доля дублей ниже. «Пустых» тестов (не могут упасть вовсе) нет — каждая строка §3 падает при хотя бы одной реальной ошибке, просто ту же ошибку уже ловит другая строка, другой уровень или платформа.

Красной зоны нет: все 127 зелёные.

## 2. Закономерности

Встречены 8 из 14 Б-ID (Б-1, Б-2, Б-3, Б-4, Б-6, Б-9, Б-10, Б-13). Числа — кандидаты §3.

Не встречены: Б-5 (файлов-двойников в области нет), Б-7 и Б-8 (ручных паспортов Def и схем нет — модуль на DMG с `arch:check`), Б-12 (пустые входы в области — это ветви `emptyScreen` хелперов, а не `filter`/`map`: `S/scope-reviews.story.test.ts:377`, `S/reviews-for-me.story.test.ts:276`), Б-14 (файла-паспорта экранов нет, явление встретилось в минимуме — Н1). Б-11 в чистом виде нет: тавтологии — только внутри полезных строк (`S/invite.story.test.ts:149` — `new Set(invites.map(...)).size === 2`; `S/review-notify.story.test.ts:100` — `payload.kind ?? 'notify'`; `S/review-render.test.ts:40` — ожидание собрано из `OUTCOME_LABELS`).

| ID | случаев | примеры (2–3) |
|---|---:|---|
| Б-1 | 4 | Правило проверено уровнем ниже и повторено выше: `S/scope-reviews.story.test.ts:195` и `S/reviews-for-me.story.test.ts:161` повторяют «лейбл исхода — только у автора-студента» (`S/review-render.ts:33-42`, канон `S/review-render.test.ts:40`); `S/scope-reviews.story.test.ts:226` закрепляет порядок блоков, который целиком задаёт DS (`D/review/scope-reviews.dqs.ts:13-30`, канон `D/review/scope-reviews.dqs.test.ts:34`), стори делает один `flatMap`; `E/peer-review-smoke.e2e.test.ts:99` проверяет `participants`/`mentorId` кампании — правила Ar (`D/review-campaign/review-campaign.ar.test.ts:96`). |
| Б-2 | 1 | `S/review-render.test.ts:89` — `renderSchoolReviewCard` дёргается напрямую, хотя у неё единственный потребитель (`SC/school-reviews.story.ts:14`, `:105`), а его тест `SC/school-reviews.story.test.ts:137` проверяет ту же карточку строже (ментор, автор, роль, дата, поток, текст). Имя теста при этом неверно: «автор-ментор без лейбла исхода» передаёт `direction: 'student_mentor'`, т.е. автор — студент, и ожидает лейбл `'студент · не начал'`. |
| Б-3 | 3 | Одинаковое тело `it` в нескольких файлах: подписка стори на событие отдельным тестом — `S/invite.story.test.ts:143`, `S/review-notify.story.test.ts:93`, `PR/controller.test.ts:20` (сам факт подписки доказывает любой соседний тест: обработчик достаётся по имени события и без подписки `handler()` бросает); правило `pagedScreen` «одна страница — без индикатора и навигации» — `S/my-reviews.story.test.ts:518` и `S/scope-reviews.story.test.ts:503` (общий хелпер `runners/u7-bot/src/core/u7-bot-ui-story.ts:222`). |
| Б-4 | 9 | E2E повторяет unit: `E/peer-review-hub.e2e.test.ts:67` ↔ `S/my-reviews.story.test.ts:84`, `E/peer-review-hub.e2e.test.ts:75` ↔ `S/my-reviews.story.test.ts:69` (и `:97` того же файла — кнопка обязана быть, иначе `pressedCode` бросает), `E/peer-review-hub.e2e.test.ts:191` ↔ `S/campaign.story.test.ts:733`, `E/peer-review-reviews-for-me.e2e.test.ts:106` ↔ `S/my-reviews.story.test.ts:373`, `E/peer-review-smoke.e2e.test.ts:143` ↔ `E/peer-review-campaign.e2e.test.ts:74`. Обратное направление (unit повторяет e2e) — `S/my-reviews.story.test.ts:357` ↔ `E/peer-review-reviews-for-me.e2e.test.ts:115`, `S/scope-reviews.story.test.ts:435`/`:465`/`:489` ↔ `E/peer-review-view.e2e.test.ts:316`. |
| Б-6 | 4 | Копия соседнего теста без нового класса входа: `S/review-notify.story.test.ts:182` (адресат не найден) — тот же `if` и тот же warn, что `:161` (нет `telegramId`); `S/review-render.test.ts:14` ⊂ `:18` (та же строка формата, других ветвей у `reviewDate` нет); `S/campaign.story.test.ts:234` и `S/scope-reviews.story.test.ts:489` — «проверка UC-вызовов» дублирует то, что доказывает эффект (`:163` — заголовок потока и имена кнопок; `E/peer-review-view.e2e.test.ts:316` — страницы S07 из реального UC). |
| Б-9 | 3 | Поведение платформы/ядра: агрегация подписок стори контроллером (`PR/controller.test.ts:20`, `platform/core/src/ui/ui-controller.ts:21-22`) и объединение их в приложении (`platform/core/src/ui/ui-app.ts:45-47`); ряд навигации и коды страниц строит `BotPaginator.navRows` (`P/page-nav.ts`, канон `P/page-nav.test.ts:48`), стори только передаёт `cbPage` → `S/scope-reviews.story.test.ts:435`; «Неизвестная команда» — `S/reviews-for-me.story.test.ts:287` (канон `P/bot-ui-story.test.ts:638`). |
| Б-10 | 1 | Тест собранности стенда, а не кода модуля: `E/peer-review-smoke.e2e.test.ts:83` («модуль зарегистрирован — `get-my-campaigns` отвечает») — при незарегистрированном модуле падает любой сквозной сценарий (`E/peer-review-campaign.e2e.test.ts:74`), а сам тест проверяет только отсутствие `NO_COMMAND_FOUND`. |
| Б-13 | 1 | `S/review-render.test.ts:59` — тест мёртвого экспорта `authorLine` (`S/review-render.ts:56`): вне своего теста не импортируется нигде ни в `runners/`, ни в `modules/`, ни в `domain/`. |
| Н1 | 1 | **Тест статического текста по фразам (паспорт одного экрана).** Признак: `it` проверяет 5–7 подстрок неизменяемого текста-справки, ни одна из которых не является ветвью кода; падает от любой перефразировки и потому требует правки теста на каждую косметику. Отличие от Б-14: там паспорт — отдельный файл на все экраны фичи, здесь — один `it` в поведенческом файле. Пример: `S/campaign.story.test.ts:436` (`how:` — «Сначала — сильные стороны», «Пиши своё», «Ярлык и переход на личности»…). Ценно в нём только поведение (`notify` есть, `screen`/`awaitInput` не тронуты, текст MarkdownV2-безопасен) — тексты принадлежат unit-тестам пар «роль-судьба»/проактивов, а не отдельному сторожу фраз. |

**Оставлено как полезное, хотя похоже на дубль** (для протокола):

- Четыре теста «имя не найдено → запасная подпись» — `S/scope-reviews.story.test.ts:334` («неизвестно»), `S/reviews-for-me.story.test.ts:221` («неизвестно»), `S/invite.story.test.ts:296` («для студента»), `S/my-reviews.story.test.ts:392` («студент»). Тело похоже (Б-3), но это четыре разных `??` в четырёх рендерах с разными текстами — каждый сторож свою строку.
- Два теста «clamp за пределами страниц» — `S/scope-reviews.story.test.ts:518` (`BotPaginator.page`) и `S/reviews-for-me.story.test.ts:375` (`Math.min` в `cardPagedScreen`, `runners/u7-bot/src/core/u7-bot-ui-story.ts:293`): одна закономерность, но разные реализации.
- Три теста кеша «листание не перечитывает домен» — `S/my-reviews.story.test.ts:505`, `S/reviews-for-me.story.test.ts:358`, покойный `S/scope-reviews.story.test.ts:465`: тело одинаковое, но каждая стори передаёт `session` в свой вызов хелпера — забытый `session` у одной стори не поймает тест другой.
- Тексты приглашений `S/invite.story.test.ts:163`/`:194`/`:210`/`:225`/`:239` — длинные строки целиком, но каждая — своя ветвь отображения `subjectOutcome`/роли, т.е. проверяется маппинг, а не косметика.
- Экранирование динамики — `S/invite.story.test.ts:328` (название потока с точками) и `S/review-render.test.ts:72` (имя/поток/текст): та же проверка `md`-тега платформы, но в области нет другой ветви, где в шаблон подставляются значения со спецсимволами (`assertMarkdownV2Safe` в прочих тестах проходит и без экранирования — в фикстурах нет точек/скобок).

## 3. Кандидаты

Действия: `удалить` / `слить в <адрес>` / `переписать`. Ссылки «где покрыто» — начало конкретного `it`/`test`, который сам в этой таблице не удаляется и не переписывается.

| путь:строка | имя теста | Б-ID | где покрыто | что делать |
|---|---|---|---|---|
| `PR/controller.test.ts:20` | подписка приглашений S01 доставляется через контроллер | Б-9 | `PR/controller.test.ts:5` (состав), `S/invite.story.test.ts:149` (работа подписки) | удалить |
| `S/invite.story.test.ts:143` | подписана на `peer-review.review-campaign.created` | Б-3 | `S/invite.story.test.ts:149` | удалить |
| `S/review-notify.story.test.ts:93` | подписана на `peer-review.review.created` | Б-3 | `S/review-notify.story.test.ts:100` | удалить |
| `S/review-notify.story.test.ts:182` | адресат не найден — предупреждение, сообщение не отправляется | Б-6 | `S/review-notify.story.test.ts:161` | слить в `S/review-notify.story.test.ts:161` |
| `S/my-reviews.story.test.ts:357` | есть входящие отзывы → ряд «📥 Отзывы мне» перед меню | Б-4 | `E/peer-review-reviews-for-me.e2e.test.ts:115` | удалить |
| `S/scope-reviews.story.test.ts:195` | автор-ментор (`mentor_student`) — без лейбла исхода | Б-1 | `S/review-render.test.ts:40` | удалить |
| `S/scope-reviews.story.test.ts:226` | группировка по адресатам: отзывы одного адресата идут подряд | Б-1 | `D/review/scope-reviews.dqs.test.ts:34` | удалить |
| `S/scope-reviews.story.test.ts:435` | навигация одним рядом; коды кнопок содержат номер страницы | Б-9 | `E/peer-review-view.e2e.test.ts:316` (коды нажимаются и ведут на нужные страницы) | удалить |
| `S/scope-reviews.story.test.ts:465` | листание не перечитывает домен: `list-scope-reviews` один раз (кеш) | Б-4 | `E/peer-review-view.e2e.test.ts:316` (счётчик `counter.count(ListScopeReviewsUcDef.name)` = 1 до и после цикла) | удалить |
| `S/scope-reviews.story.test.ts:489` | вызывает `list-scope-reviews` с `scopeIds: [scopeId]` | Б-6 | `E/peer-review-view.e2e.test.ts:316` (страницы S07 из фикстурного скоупа; неверный `scopeIds` → заглушка и `total` не набирается) | удалить |
| `S/scope-reviews.story.test.ts:503` | одна страница коротких отзывов — без индикатора и навигации | Б-3 | `S/my-reviews.story.test.ts:518` (тот же хелпер `pagedScreen`) | удалить |
| `S/reviews-for-me.story.test.ts:161` | автор-ментор (`mentor_student`) — без лейбла исхода | Б-1 | `S/review-render.test.ts:40` | удалить |
| `S/reviews-for-me.story.test.ts:287` | неизвестная команда — экран `unknownCommand` | Б-9 | `P/bot-ui-story.test.ts:638` | удалить |
| `S/campaign.story.test.ts:234` | list: UC-вызовы — адресаты, поток по `scopeId`, имена адресатов | Б-6 | `S/campaign.story.test.ts:163` | удалить |
| `S/campaign.story.test.ts:436` | how: справка «Как писать отзыв» — инфо без кнопок, экран не трогается | Н1 | `—` (фразы текста не проверяет никто другой: тексты — не ветвь кода) | переписать: оставить `notify` + `assertDialogResponseMarkdownSafe` + `screen`/`awaitInput` = `undefined` |
| `S/review-render.test.ts:14` | обычный момент → `dd.mm.yyyy` | Б-6 | `S/review-render.test.ts:18` (та же строка формата, ещё и граница суток) | слить в `S/review-render.test.ts:18` |
| `S/review-render.test.ts:59` | `authorLine`: имя, роль, исход и дата | Б-13 | `—` (тест мёртвого экспорта `S/review-render.ts:56`) | удалить тест и экспорт |
| `S/review-render.test.ts:89` | `renderSchoolReviewCard`: ментор, автор-ментор без лейбла исхода | Б-2 | `SC/school-reviews.story.test.ts:137` (+ `S/review-render.test.ts:40` для лейбла) | удалить |
| `E/peer-review-smoke.e2e.test.ts:83` | модуль `peer-review` зарегистрирован — `get-my-campaigns` отвечает | Б-10 | `E/peer-review-campaign.e2e.test.ts:74` | удалить |
| `E/peer-review-smoke.e2e.test.ts:99` | `student.completed` → ER создаёт кампанию (репозиторий + UC) | Б-1 | `D/review-campaign/review-campaign.ar.test.ts:96` (участники и `subjectOutcome`), `D/review-campaign/er/create-student-campaign.er.test.ts:12` (события ER) | переписать: оставить «событие судьбы → кампания видна субъекту через `get-my-campaigns`»; `participants`/`mentorId`/`subjectOutcome` снять |
| `E/peer-review-smoke.e2e.test.ts:143` | `review-campaign.created` → приглашения субъекту и ментору на реальной шине | Б-4 | `E/peer-review-campaign.e2e.test.ts:74` | удалить |
| `E/peer-review-hub.e2e.test.ts:67` | `menuButtons`: без кампаний кнопки «💬 Отзывы» нет | Б-4 | `S/my-reviews.story.test.ts:84` | удалить |
| `E/peer-review-hub.e2e.test.ts:75` | живая кампания → кнопка меню видна (`kind` callback, приоритет 25) | Б-4 | `E/peer-review-hub.e2e.test.ts:97` (нажимает эту кнопку), `S/my-reviews.story.test.ts:69` (поля кнопки) | удалить |
| `E/peer-review-hub.e2e.test.ts:191` | окно истекло во время ввода → экран-заглушка «возможность закрыта» | Б-4 | `S/campaign.story.test.ts:733` (та же ветвь `WINDOW_CLOSED`; код ошибки — домен, `D/review/review.rules.test.ts:32`) | удалить |
| `E/peer-review-view.e2e.test.ts:180` | карточка без отзывов — кнопки «💬 Отзывы» нет | Б-4 | `V/view-stream.story.test.ts:776` (unit-канон той же ветви, кнопку строит `streams`: `V/view-stream.story.ts:459`) | удалить |
| `E/peer-review-view.e2e.test.ts:187` | карточка с отзывами — кнопка открывает S07: группы, роли, лейблы | Б-4 | `S/scope-reviews.story.test.ts:129` (блок и роли), `S/review-render.test.ts:25` (порядок ролей по `direction`) | переписать: оставить «из карточки потока открывается S07 на реальных данных» + код моста; группы/роли/лейблы — unit |
| `E/peer-review-reviews-for-me.e2e.test.ts:106` | отзывов нет → в хабе нет кнопки «📥 Отзывы мне» | Б-4 | `S/my-reviews.story.test.ts:373` | удалить |

## 4. Полезные тесты

- `PR/controller.test.ts` — 1 тест полезен: состав реестра стори (тест состава модуля, `testing.md` §3) — `:5`.
- `S/campaign.story.test.ts` — 28 тестов полезны: S03-список — заголовок/вопрос/дни/последний ряд (`:163`), роли в кнопках и ✅ (`:197`), полный код `open` (`:217`), «Кампания не найдена» (`:259`), автор-ментор (`:279`), единственный адресат сразу в ввод (`:302`, `:327`); S05-подсказки по паре «роль-судьба» (`:353`, `:386`, `:403`, `:422`, `:464`, `:488`, `:511`, `:536`); ввод — короткий/длинный/валидный текст (`:560`, `:590`, `:619`), возврат в родителя-хаб/список (`:678`, `:896`, `:927`), отказ UC (`:707`), истёкшее окно (`:733`); S04-перезапись (`:763`, `:796`, `:841`); страницы возврата (`:858`, `:877`).
- `S/invite.story.test.ts` — 14 тестов полезны: состав приглашений «по одному каждому» (`:149`), пять текстов по исходу/роли (`:163`, `:179`, `:194`, `:210`, `:225`, `:239`), полный код кнопки в проактивном канале (ФР-6, `:253`), один batch профилей (`:266`), отсутствие `telegramId` у субъекта/ментора (`:276`, `:287`), запасной лейбл имени (`:296`), недоступный поток — молчание (`:320`), экранирование названия потока (`:328`).
- `S/my-reviews.story.test.ts` — 18 тестов полезны: кнопка меню — поля и `onlyLives` (`:69`, `:92`), негатив кнопки (`:84`), кнопка только по входящим отзывам (`:103`); S02 — тексты пар «роль-судьба» (`:231`, `:249`, `:271`, `:298`), нумерация и главное меню последним (`:309`), ✅ при `done === total` (`:325`), заглушки (`:346`, `:381`), негатив «📥 Отзывы мне» (`:373`), запасное имя субъекта (`:392`); пагинация — бюджет Telegram (`:461`), сквозная нумерация и предел (`:480`), кеш по эпохе диалога (`:505`), единственная страница (`:518`).
- `S/review-notify.story.test.ts` — 6 тестов полезны: три роли автора (`:100`, `:119`, `:133`), один batch (`:147`), нет `telegramId` (`:161`), автор не найден (`:173`).
- `S/review-render.test.ts` — 4 теста полезны: дата по UTC у полуночи (`:18`), `rolesOf` по направлению (`:25`), лейбл только у автора-студента (`:40`), карточка S08 с экранированием динамики (`:72`).
- `S/reviews-for-me.story.test.ts` — 10 тестов полезны: карточка + вход UC (`:129`), batch с уникальными id (`:181`), два запасных «неизвестно» (`:221`, `:243`), кнопки возврата (`:265`), заглушка гонки (`:276`), пагинация — одна карточка (`:298`), две карточки и «новые наверху» (`:309`), кеш (`:358`), clamp (`:375`).
- `S/scope-reviews.story.test.ts` — 8 тестов полезны: блок «адресат + роль + лейбл» (`:129`), лейбл «не начал» (`:163` — единственный сторож этого значения `OUTCOME_LABELS`), batch `адресаты + авторы` (`:282`), запасное «неизвестно» (`:334`), мост «⬅️ Назад к потоку» (`:364`), заглушка гонки (`:377`), ≥3 страниц из целых отзывов (`:394`), clamp (`:518`).
- `E/peer-review-campaign.e2e.test.ts` — 3 теста полезны: сквозной сценарий «судьба → приглашения → S03 → переспрос → ввод → S06 → перезапись S04» (`:74`), несколько адресатов и метрики 1/3 → 2/3 (`:266`), `dropped`: автопровал единственного адресата → ввод → сохранение → хаб (`:323`).
- `E/peer-review-hub.e2e.test.ts` — 3 теста полезны: хаб субъекта с прогрессом и мостом в S03 (`:97`), S02 ментору (`:129`), истёкшая кампания по старому приглашению — «Кампания не найдена» (`:174`): единственный сторож ветви `if (!card)` в `#recipients` (`S/campaign.story.ts:171`, экран — `:175`): unit-тест `S/campaign.story.test.ts:259` проверяет только отказ UC, а не отсутствие карточки в `get-my-campaigns`.
- `E/peer-review-notify.e2e.test.ts` — 1 тест полезен: первая запись пары → одно уведомление, перезапись → ни одного (`:58`) — единственная проверка «`review.created` публикуется только на первой записи» на уровне шины.
- `E/peer-review-reviews-for-me.e2e.test.ts` — 2 теста полезны: отзыв появился → кнопка → S08 карточки 1/2 и 2/2, листание, возврат (`:115`), меню по одним входящим отзывам без живых кампаний на реальных репозиториях (`:176`).
- `E/peer-review-view.e2e.test.ts` — 2 теста полезны: «⬅️ Назад к потоку» — работающий межсториевый мост (`:224`), пагинация ≥3 страниц с целыми блоками, edit на месте и `DialogCache` (`:316`).
- `E/peer-review-smoke.e2e.test.ts` — полезных нет: после чистки в файле остаётся один переписанный тест (`:99`) как сторож связки «шина → ER → репозиторий» (см. §5 п. 1).

## 5. Открытые вопросы

1. **Судьба `E/peer-review-smoke.e2e.test.ts`.** После чистки: `:83` и `:143` удаляются, `:99` переписывается. Варианты: (а) оставить файл с одним тестом «событие судьбы → кампания видна через `get-my-campaigns`» — дешёвая диагностика связки «шина → ER → репозиторий»; (б) удалить файл целиком, признав связку покрытой `E/peer-review-campaign.e2e.test.ts:74`. Рекомендация: (а). Важно для порядка правок: `:143` опирается на кампанию, созданную в `:99` (состояние стенда, а не своё) — при удалении `:99` первым упадёт `:143`, поэтому `:143` удаляется раньше.
2. **Канон `renderSchoolReviewCard`.** После удаления `S/review-render.test.ts:89` единственный сторож карточки школы — `SC/school-reviews.story.test.ts:137` (файл вне области, срез `school`). Подтвердить, что срез `school` не удалит `:137` в этой же чистке (иначе рендер останется без теста). Альтернатива: оставить `:89` как канон уровня хелпера, а `:137` в срезе школы свести к «карточка открывается» — по `bot-test.md` §2 п. 5 рендер-правило принадлежит модулю `review-render`, а не потребителю. Рекомендация: удалить `:89`, `:137` не трогать.
3. **Четыре копии «запасной подписи» (Б-3 или нет).** `S/scope-reviews.story.test.ts:334`, `S/reviews-for-me.story.test.ts:221`, `S/invite.story.test.ts:296`, `S/my-reviews.story.test.ts:392` оставлены: четыре разных `??` с разными текстами. Если orchestrator считает это Б-3, канон — `S/scope-reviews.story.test.ts:334`, остальные три удаляются. Рекомендация: оставить все четыре.
4. **Кнопка «💬 Отзывы» в карточке потока принадлежит чужому модулю.** Удаление `E/peer-review-view.e2e.test.ts:180` опирается на unit-канон `streams` (`V/view-stream.story.test.ts:776`, код кнопки — `V/view-stream.story.ts:459`); тот же unit-канон для положительной ветви — `V/view-stream.story.test.ts:757`. Если срез `streams` в этой чистке удалит свой unit, e2e-проверку кнопки удалять нельзя. Решение — за срезом `streams`.
5. **`E/peer-review-campaign.e2e.test.ts:74` в таблицу не включён.** Тест на 190 строк дословно повторяет unit-тексты приглашений (`:86-110` ↔ `S/invite.story.test.ts:163`/`:225`/`:253`), S03-экран и подсказки S05, но при этом остаётся единственным сквозным сценарием S03→S06→S04, поэтому по `bot-test.md` §2 п. 5 («e2e — пользовательская история, без фанатизма») он полезен. Вопрос: снимать ли текстовые дубли внутри него в этом срезе или оставить как есть. Рекомендация: оставить — тексты и ветви уже проверены unit-тестами, а трогать сквозной сценарий ради косметики рискованно.
