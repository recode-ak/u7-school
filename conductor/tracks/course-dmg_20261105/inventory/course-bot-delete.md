# Таблица удаления тестов: бот `course` (Ф8, трек `course-dmg_20261105`)

Основание — инвентаризация [`course-bot.md`](./course-bot.md) (кандидаты, Б-1…Б-16, Н1), закономерности [`test-bloat.md` §2, §6](../../../roadmap/test-bloat.md), правила `node_modules/dmg-core/docs/reference/testing.md` §3, §5, §5.1 (TST-08, TST-09). Образец формата и уровня решений — [`tst-cleanup`/stream-bot-delete.md](../../tst-cleanup_20261105/inventory/stream-bot-delete.md). Решения среза — раздел «Общие решения» и «Решения по открытым вопросам» постановки Ф8.

Номера строк — по текущему коду `main` (2026-11-11). Базовая линия области — **104 кейса** (5 + 26 + 48 + 2 + 20 + 3), прогон `bun test` по шести файлам: **104 pass, 0 fail**.

Действия: `удалить` / `слить в <файл>:<строка>` / `переписать` / `перенести в <файл>` / `удалить с кодом`. Тесты-кандидаты, оставленные без изменений, и полезные тесты вне кандидатов в таблицу не входят (см. «Итог»).

Ссылки «где покрыто» проверены: файл существует, на указанной строке начинается `test(`/`it(`, тест проверяет тот же класс входа и **сам этой таблицей не удаляется** (цепочек «A удалён → опора на удалённый B» нет). Допустимые слои — `domain` ↔ `modules` ↔ бот, платформа (вне области чистки), e2e вне области (`main-menu`), модуль `stream` (чистка `tst-cleanup` уже применена). Первая ссылка в ячейке — полный путь от корня; `:N` — та же строка того же файла.

## Таблица

| файл | строка | имя теста | Б-ID | действие | где покрыто |
|---|---|---|---|---|---|
| `runners/u7-bot/src/controllers/courses/controller.test.ts` | 34 | имя контроллера — course | Б-11 | удалить | нигде: `readonly name = 'course'` — литерал в литерале (Б-11); маршрут держит `runners/u7-bot/tests/e2e/main-menu.e2e.test.ts:93` (action `course:course-catalog:list`) |
| `runners/u7-bot/src/controllers/courses/controller.test.ts` | 39 | содержит 3 story (каталог + приглашение + уведомление менторам) | Б-11 | переписать | — (число заменяется списком имён стори, см. «Переписать») |
| `runners/u7-bot/src/controllers/courses/controller.test.ts` | 45 | menuButtons агрегирует кнопки от stories с префиксом контроллера | Б-9 | удалить | `runners/u7-bot/src/core/u7-bot-controller.test.ts:83` (сбор от стори + префиксация кодов) + `runners/u7-bot/tests/e2e/main-menu.e2e.test.ts:93` |
| `runners/u7-bot/src/controllers/courses/controller.test.ts` | 60 | handleCallback форвардит по префиксу story | Б-9 | удалить | `platform/core/src/ui/bot/bot-controller.test.ts:355` (снятие префикса стори, коды ответа с префиксом контроллера) + `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts:477` (реальное нажатие «Курсы» через контроллер) |
| `runners/u7-bot/src/controllers/courses/controller.test.ts` | 73 | handleCallback — неизвестный префикс | Б-9 | удалить | `platform/core/src/ui/bot/bot-controller.test.ts:397` (неизвестный префикс → экран неизвестной команды — та же ветка) |
| `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts` | 263 | presentNavLevel корректно рендерит клавиатуру с разными wish-кнопками | Н1 | удалить | `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:123` (тексты и коды wish-кнопок по статусу) + `platform/core/src/ui/content-nav/presenter.test.ts:314` (место `extraRows` после навигации) |
| `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts` | 293 | presentNavLevel корректно рендерит текст и клавиатуру уровня курса | Н1 | переписать | — (остаётся единственный smoke «резолвер → `presentNavLevel`»; данные уровня — `:57`, разметку держит `platform/core/src/ui/content-nav/presenter.test.ts:25`) |
| `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts` | 323 | presentNavLevel корректно рендерит текст и клавиатуру уровня этапа | Н1 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:251` (те же кнопки-модули и «Назад к курсу» через презентер) + `platform/core/src/ui/content-nav/presenter.test.ts:25` |
| `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts` | 549 | presentNavLevel корректно рендерит текст и клавиатуру уровня модуля | Н1 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:319` (те же кнопки-проекты и «Назад к курсу») + `platform/core/src/ui/content-nav/presenter.test.ts:210` |
| `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts` | 581 | presentNavLevel корректно рендерит текст и клавиатуру уровня проекта | Н1 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:379` (кнопки-уроки и «Назад к модулю») + `platform/core/src/ui/content-nav/presenter.test.ts:210` |
| `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts` | 706 | presentNavLevel корректно рендерит карточку урока без кнопок шагов | Н1 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:454` (на клавиатуре нет кнопок шагов) + `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:617` (`enterable: false`, адреса нет) |
| `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts` | 996 | уровень курса: этапы со склонением «1 модуль» и «2 модуля» | Б-14 | слить в `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:57` | — (строка «1 модуль» рядом с проверкой «2 модуля» на `:57`) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 162 | menuButtons содержит описание для help | Б-4 | удалить | `runners/u7-bot/tests/e2e/main-menu.e2e.test.ts:171` (/help собирается из `menuButtons[].description`; точная фраза описания — косметика help-текста) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 233 | list: заголовок «📖 *Курсы*» | Б-14 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:172` (`toContain('Курсы')` в том же экране) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 792 | неизвестная команда | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:638` (unknownCommand: экран + warn) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 802 | handleMessage — дефолт ядра (ввод без ожидания до стори не доходит) | Б-9 | удалить | `platform/core/src/ui/bot/bot-ui-story.test.ts:246` (дефолт `handleMessage`: warn + реплика-отказ + `release`) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 960 | list: confirmed-желание → кнопка «🗑️ Отменить желание» | Б-1 | слить в `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:934` | — (кейс `confirmed` в `test.each` на `:934`: текст + код `course-catalog:cancel:…`) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 979 | list: pending-желание → кнопка «📝 Продолжить анкету» | Б-1 | удалить | `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:123` (пункт 2: текст и код `questionnaire:fill:resume:course-1`) + `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:1144` (тот же код кнопки) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 1000 | list: fulfilled-желание (обучение) → обычная кнопка «Хочу пройти курс» | Б-1 | удалить | `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:123` (пункт 4: fulfilled → «Хочу пройти курс» и код W04) + `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:918` |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 1019 | list: желание другого пользователя не влияет на кнопки | Б-10 | удалить | `modules/wish/src/wish/uc/list-user-wishes.uc.test.ts:64` (фильтр «чужие желания не попадают в выдачу» — правило UC; в стори-тесте фильтр повторял мок `:99`, стори `userId` не читает) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 1116 | apply конфликт %s: текст ветвится | Б-6 | слить в `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:1082` | — (проверки текста ветки — строками той же таблицы `test.each` на `:1082`) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 1275 | cancel-mod: рендерит подтверждение W05-M с кнопками Да/Отмена | Б-3 | слить в `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:1200` | — (`test.each` по `kind`: course / module — один `confirm`, разные тексты и `cancel-confirm`-коды) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 1341 | листание курсов: ◀️ Пред. курс / След. курс ▶️ | Б-1 | удалить | `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:89` (адреса и границы `prev`/`next`) |
| `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts` | 1383 | листание этапов: ◀️ Пред. этап / След. этап ▶️ | Б-1 | удалить | `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:231` |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 136 | содержит «🏫 Школа» и «📖 Курсы» | Б-4 | удалить | `runners/u7-bot/tests/e2e/main-menu.e2e.test.ts:93` (состав меню гостя: приоритеты, точные action, отсутствие лишних пунктов) |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 150 | уровень 0: карточка курса с этапами подуровнем | Б-4 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:172` |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 169 | уровень 1: клик на этап → карточка этапа с модулями подуровнем | Б-4 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:251` + `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:196` |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 192 | уровень 2: клик на модуль → карточка модуля с проектами подуровнем | Б-4 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:319` |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 220 | уровень 3: клик на проект → карточка проекта с уроками подуровнем | Б-4 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:379` |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 254 | уровень 4: клик на урок → карточка урока (шаги только заголовками, закрытый уровень) | Б-4 | удалить | `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:454` |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 295 | хлебные крошки и пояснения на всех уровнях drill-down (FR-3) | Б-4 | удалить | `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:57` (крошки курса; `:196`, `:394`, `:468`, `:617` — крошки этапа, модуля, проекта, урока) + `platform/core/src/ui/content-nav/presenter.test.ts:25` |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 337 | горизонтальное листание соседей ◀️/▶️ на уровнях каталога (FR-4) | Б-4 | удалить | `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:89` (границы `prev`/`next` курса; `:231`, `:509`, `:666` — этапа, проекта, урока) |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 380 | гость открывает каталог потоков (S01) | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/stream-catalog.story.test.ts:31` (enrollment + active, легенда статусов) + `:194` («Назад в школу» — последняя строка) + `runners/u7-bot/tests/e2e/main-menu.e2e.test.ts:200` (маршрут «школа → потоки») |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 401 | гость → enrollment-поток: карточка без менторских кнопок (S02) | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:211` (публичные кнопки: Программа/Детали/Студенты/Назад) + `:556` (кнопка студента → `student-detail`, кросс-стори колбэк) |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 450 | гость → active-поток: Программа и Детали видны (S02) | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:211` + `:166` (active-поток: набор публичных кнопок) |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 515 | drill-down → назад → другой путь | Б-4 | удалить | `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts:477` (тот же маршрут плюс drill-up) + `runners/u7-bot/src/controllers/courses/stories/course-catalog.story.test.ts:172` (кнопка любого этапа ведёт на `phase:`) |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 537 | c карточки курса — Главное меню | Б-4 | удалить | `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:89` (`back` уровня курса = Главное меню) + `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts:477` (последний шаг — «Главное меню») |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 556 | каталог → карточка → программа → назад → детали → назад → каталог | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:256` (программа) + `:300` (детали) + `:325` («Назад к потоку») + `:211` (`catalog:list`) |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 590 | каталог → active-поток → программа → назад → каталог | Б-4 | удалить | `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:256` + `:211` |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 613 | каталог → Главное меню | Б-4 | удалить | `runners/u7-bot/tests/e2e/main-menu.e2e.test.ts:200` (тот же маршрут: школа → потоки → назад в школу → Главное меню) |
| `runners/u7-bot/tests/e2e/curious-showcase.e2e.test.ts` | 675 | handleHelp показывает описания курсов и потоков (notify, ФР-5) | Б-4 | удалить | `runners/u7-bot/tests/e2e/main-menu.e2e.test.ts:171` (те же строки того же /help, notify без экрана) |
| `runners/u7-bot/tests/e2e/pagination.e2e.test.ts` | 222 | S03: длинная программа — drill-down навигация по проектам | Б-16 | переписать | — (добавляется полный цикл `pageThroughCycle` + `collectProjects` без дублей) |
| `runners/u7-bot/tests/e2e/pagination.e2e.test.ts` | 276 | Каталог: длинный модуль — drill-down навигация по проектам, edit на месте | Б-16 | переписать | — (сквозной проход до последнего проекта и назад, без дублей — см. «Переписать») |
| `runners/u7-bot/tests/e2e/pagination.e2e.test.ts` | 311 | Каталог: сквозное листание проектов в пределах модуля | Б-16 | слить в `runners/u7-bot/tests/e2e/pagination.e2e.test.ts:276` | — (полный проход входит в `:276`) |

## Переписать (4)

1. `runners/u7-bot/src/controllers/courses/controller.test.ts:39` — состав реестра по именам: `stories.map(s => s.dialogPath)` = `['course/course-catalog', 'course/wish-invite', 'course/wish-confirmed']` (сейчас `length === 3`, падает/зеленеет от любого набора из трёх стори).
2. `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:293` — свести к smoke: уровень курса из `resolveCourseNavLevel` → `presentNavLevel` возвращает `{ text, keyboard }`, `text` содержит заголовок уровня, в `keyboard.rows` есть ряд навигации; убрать точную MarkdownV2-разметку, индексы рядов и `toHaveLength` (разметка — `presentNavLevel`, данные — `:57`, `:89`).
3. `runners/u7-bot/tests/e2e/pagination.e2e.test.ts:222` — включить полный цикл `pageThroughCycle` на программе потока (вперёд до последней страницы и назад, `pageOf`, `edit` на месте) и `collectProjects` без дублей: имя «длинная программа / пагинация» перестаёт быть шире проверки (`pageOf` и `pageThroughCycle` остаются используемыми).
4. `runners/u7-bot/tests/e2e/pagination.e2e.test.ts:276` — сквозной проход проектов модуля до последнего и назад по «◀️ Пред. проект»: каждый номер проекта ровно один раз (`collectProjects` — без дублей и разрывов), `edit` на месте на каждом шаге, возврат к модулю.

## Слить (5)

1. `…/course-nav-resolver.test.ts:996` → `:57` — второй кейс «один модуль в этапе» (`meta: '(1 модуль)'`) рядом с «2 модуля».
2. `…/course-catalog.story.test.ts:960` → `:934` — `confirmed` вторым кейсом `test.each(['expressed','confirmed'])`: текст «Отменить желание» + код `course-catalog:cancel:<id>`.
3. `…/course-catalog.story.test.ts:1116` → `:1082` — в таблицу `test.each(['expressed','confirmed'])` на `:1082` добавить проверку текста ветки (`обучаешься` для `confirmed`, `выразил желание` для `expressed`).
4. `…/course-catalog.story.test.ts:1275` → `:1200` — `test.each` по `kind` (`course` / `module`): текст подтверждения, коды `course-catalog:cancel-confirm:<id>` и `course-catalog:cancel-mod-confirm:<moduleId>`, кнопка «Отмена».
5. `runners/u7-bot/tests/e2e/pagination.e2e.test.ts:311` → `:276` — полный проход (`:276`) делает отдельное «сквозное листание» избыточным.

## Перенести

Нет: переносов из этой таблицы нет. Кандидаты инвентаризации «в модуль `stream`/`learning`» (`E:380`, `E:401`, `E:450`, `E:556`, `E:590`, `E:613`, `P:222`) закрыты решениями 1 и 5 постановки: сценарии покрыты полезными тестами `controllers/streams/**` (ссылки — в таблице), `P:222` переписывается на месте.

## Остающиеся проверки `label`

Нет: в области (6 файлов) ни одного `expect(...label)` на ошибку Def — ни отдельным `it`, ни одиночным ассертом внутри полезного теста (TST-09). Проверено `grep -n "label"`:

- `course-nav-resolver.test.ts:100,104,117,226,242,255,427,445,460,504,524,541,661,682,700,798,900,904` — `label` навигационной кнопки внутри `expect(prev/next/back).toEqual({ label, address })`: это текст кнопки пользователю (поведение резолвера), а не `label` ошибки;
- `course-catalog.story.test.ts:56-57` — `label` ошибки только пробрасывается в мок (`refuse(code, kind, payload, label)`), не проверяется.

## Состав модуля / реестра

- Единственный «состав» в боте по курсу — реестр стори контроллера `runners/u7-bot/src/controllers/courses/controller.test.ts:39`: **остаётся**, но переписывается на список имён (единственная защита от выпадения стори из контроллера).
- Паспортов Def в области нет (Б-7 — 0 случаев: `grep "normalize(\|ArchChecker\|safeParse\|v\.parse\|expectTypeOf"` по 6 файлам пуст; Б-8, Б-13, Б-15, Б-17 — тоже 0). Тесты состава домена/модуля (`domain/src/course/course.module.test.ts:31`, `modules/course/src/course.module.serves.test.ts`) этой таблицей не затрагиваются — они в срезах домена и модуля.

## Итог

**Всего строк в таблице: 44** — 42 кандидата инвентаризации + 2 строки пересмотра (`C:39`, `P:276`).

| действие | сколько |
|---|---|
| удалить | 35 |
| слить | 5 |
| переписать | 4 |
| перенести | 0 |
| удалить с кодом (Б-13) | 0 |

**Ожидаемое состояние области: 65 кейсов** (было 104). Арифметика по файлам:

| файл | было | станет | как |
|---|---:|---:|---|
| `controller.test.ts` | 5 | 1 | −4 удаления, `:39` переписан |
| `course-nav-resolver.test.ts` | 26 | 20 | −5 Н1, −1 слияние (`:996` → `:57`), `:293` — smoke |
| `course-catalog.story.test.ts` | 48 | 37 | −9 удалений, −2 кейса слияния `:1116` → `:1082` (слияния `:960`, `:1275` число кейсов не меняют) |
| `course-catalog.integration.test.ts` | 2 | 2 | не затронут (связка контроллер → стори → UC на `ApiApp`) |
| `curious-showcase.e2e.test.ts` | 20 | 3 | −17 удалений; остаются `:477`, `:630`, `:647` |
| `pagination.e2e.test.ts` | 3 | 2 | `:311` слито в `:276`, `:222`/`:276` переписаны |
| **итого** | **104** | **65** | ожидаемый прогон шести файлов: **65 pass, 0 fail** |

**Кандидаты инвентаризации, не вошедшие в таблицу — 1:**

- `runners/u7-bot/src/controllers/courses/course-nav-resolver.test.ts:803` («уровень этапа (колбэк старых сообщений): прежний экран этапа», Б-1) — **оставлено**: по решению 4 постановки алиасы старых сообщений в чистке не трогаются; тест — единственная проверка ветки `phase:` для курса из одного этапа (старые сообщения в чатах), и `test-bloat.md` §6 запрещает трогать тесты этапов-меток. Инвентаризация предлагала удалить или свести в `it.each` с `:196` — при отдельном решении orchestrator это −1 кейс (итог 64).

**Оценка пересмотрена по 9 строкам** (инвентаризация предлагала иное):

- `E:380`, `E:401`, `E:450`, `E:556`, `E:590`, `E:613`, `P:222` — предлагался перенос в инвентари `stream`/`learning`; по решению 1/5 — удаление с опорой на полезные тесты `controllers/streams/**` (6 строк) и переписывание на месте (`P:222`).
- `R:293` — предлагалось «слить» (в таблице кандидат значился как слияние); по решению 2 остаётся единственным smoke и переписывается.
- `C:39`, `P:276` — не кандидаты инвентаризации, попали в таблицу по решениям 6 и 5.

**Оставлено (§6):** строгое чтение `courses.json` в репозитории (инвариант программы при чтении, отказ старого формата), legacy ISO / даты без секунд, тесты этапов-меток (курс без этапов / один / несколько: `R:751`, `:780`, `:803`, `:848`, `:882`, `:923`, `:968`, `:1010`, `S:524`, `S:566-644`) — ни одна строка таблицы этих тестов не удаляет; в классе «два этапа» слияние `:996` → `:57` сохраняет саму проверку склонения.

**Спорные строки:**

1. `course-catalog.story.test.ts:162` — опора `main-menu.e2e.test.ts:171` проверяет наличие «Курсы» в /help, но не точную фразу описания: строка описания останется без проверки (косметика help-текста; если нужна — ассерт в `:171`).
2. `curious-showcase.e2e.test.ts:401` — строка «Всего: N студент(ов)» (`src/controllers/streams/stories/view-stream.story.ts:610`, склонение счёта) не проверяется ни одним тестом: при применении добавить ассерт в `runners/u7-bot/src/controllers/streams/stories/view-stream.story.test.ts:360` (вне области чистки курса).
3. `pagination.e2e.test.ts:222` — переписывание на полный цикл `pageThroughCycle` выходит за решение 5 (там назван только `:276`); альтернатива — оставить `:222` как есть, тогда `pageOf`/`pageThroughCycle` удаляются вместе с `:311` как неиспользуемые.
4. `course-nav-resolver.test.ts:803` — оставлен по решению 4 и §6; если orchestrator считает его обычным Б-1 (а не алиасом старых сообщений), удаляется, итог — 64.
5. `course-catalog.story.test.ts:1275` — слияние в `:1200` через `test.each` по `kind` даёт один `it` с двумя кейсами: объявлений −1, кейсов столько же, но тексты `W05`/`W05-M` проверяются в одном тесте (альтернатива — оставить отдельный `it` и снять Б-3).
