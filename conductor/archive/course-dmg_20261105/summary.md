# Summary: course-dmg_20261105

## Базовая линия (2026-11-05)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`05bfbae3`) | `CI=true bun test` | 4216 pass, 0 fail (397 файлов) |
| u7-school (`05bfbae3`) | `bun run test:bot` (e2e-тесты бота) | 1107 pass, 0 fail (101 файл) |
| u7-school (`05bfbae3`) | `CI=true bun test domain/src/course` | 258 pass, 0 fail (26 файлов) |
| u7-school (`05bfbae3`) | `CI=true bun test modules/course` | 170 pass, 0 fail (29 файлов) |
| dmg-core (`6cfe5f2`) | `CI=true bun test` | 1397 pass, 0 fail (132 файла) |

Совпадает со spec (конец `questionnaire`). Замечание к разбору UC: `resolve-content-path` и `get-course-program` вызывают только тесты `modules/course` и интеграционные тесты бота (`runners/u7-bot/tests/courses/content-path.integration.test.ts`, `course-program.integration.test.ts`) — прод-вызывающих нет, удаление по spec в силе, тесты уходят вместе с UC.

## Пилот ролей

Строка на каждый вызов роли ([agent-roles.md](../../architecture/agent-roles.md) §5).

| # | Роль | Задача | Модель | Повлиял на решение | Принято замечаний | Промпт правился | Оценка orchestrator |
|---|---|---|---|---|---|---|---|
| 1 | `dmg-tech-lead` | Черновики брифов `module` (Ф1) и `lesson-step` (Ф2) | Sonnet | да — 7 расхождений: маркер DEBT-10 уходит только в Ф5, конфликт имён с legacy (шаг S0 `Legacy*`), снимок переезжает в агрегат `module` с `callers` user/guest/system, legacy-снимок падает на невидимом уроке, бот читает без актора, первый `save` пишет числовые даты; Policy без вызова `user` (TR-40); 4 стратегических, 24 тактических вопроса | проверены 4 утверждения о коде — верны; С1–С2 обоих брифов — Нурболат (3 по рекомендации, `listModules` → `ModuleSummary` в срезе вопреки рекомендации), Т — приняты (TR-53); брифы приняты без переписывания | нет | полезен; ~287k токенов, 16 мин, 91 вызов инструментов |

## Базовая линия после Ф4 (2026-11-11, `eee83a10`)

| Команда | Результат |
|---|---|
| `CI=true bun run check` | зелёный; `bun test` — 4910 pass, 0 fail |
| `CI=true bun test runners/u7-bot/` | 1097 pass, 0 fail (было 1107: удалены тесты удалённых UC и дубли, TR-59) |

Ф4 — первая фаза с включёнными расширениями pi (`pi-role.ts`, форк `pi-dcp`): 4 запуска flash, hitRate 97–99%, `misses` 0, $0.33 всего. Sonnet: бриф, red-тесты курса, stories этапов; Opus: приёмка и ревью.

## DeepSeek по фазам (`deepseek.md` §5)

| Фаза | Шаг (`--label`) | Модель | $ | Ходов | hitRate | Кругов доработки | `error` ревью |
|---|---|---|---|---|---|---|---|
| Ф1 | `cd-F1-s0` (migrator, S0 переименование) | flash | 0.024 | 26 | 96% | 0 (красный — бриф orchestrator, старый путь v0.2.6 в брифе) | — |
| Ф1 | `cd-F1-domain` (migrator, домен) | flash | 0.107 | 79 | 99% | 0 (эскалации: маркер DEBT-10 в комментарии теста — снят orchestrator; `ProjectVo` в `shared/` из-за DOM-11) | — |
| Ф1 | `cd-F1-app` (migrator, прикладной слой + `u7-app`) | flash | 0.102 | 75 | 99% | 0 (экспорт `ModuleArDef`/`ModulePolicy` из `domain/src/course/index.ts` — принято) | — |
| Ф1 | `cd-F1-data` (dmg-data-keeper) | flash | 0.028 | 20 | 96% | 0 | — |
| Ф1 | `cd-F1-fix` (migrator, правки ревью) | flash | 0.062 | 51 | 98% | 0 | 0 (ревью до правок: 0 `error`, 8 `warn`) |
| Ф1 | `cd-F1-entity` (migrator, `ProjectEntity` в state) | flash | 0.020 | 18 | 95% | 0 | — |
| Ф2 | `cd-F2-s0` (migrator, S0 переименование) | flash | 0.019 | 21 | 96% | 0 | — |
| Ф2 | `cd-F2-domain` (migrator, домен) | flash | 0.118 | 77 | 99% | 0 (эскалация: типы в 4 тестах — отданы шагу 3) | — |
| Ф2 | `cd-F2-app` (migrator, прикладной слой + `u7-app`, типы тестов) | flash | 0.171 | 104 | 98% | 0 | — |
| Ф2 | `cd-F2-data` (dmg-data-keeper) | flash | 0.066 | 47 | 98% | 0 | — |
| Ф2 | `cd-F2-fix` (migrator, правки ревью) | flash | 0.051 | 47 | 98% | 0 | 0 (ревью до правок: 0 `error`, 5 `warn`) |
| Ф2 | `cd-F2-dqs` (migrator, `LessonStepsDqs` после контрольной точки) | flash | 0.030 | 27+ | 97% | 1 (тип из legacy `commands/`) | — |
| Ф2 | `cd-F2-tst08` (migrator, чистка дублей TST-08 по списку orchestrator) | flash | 0.031 | — | — | 0 | — |
| Ф3 | `cd-F3-s0` (migrator, S0 переименование) | flash | 0.032 | 24 | 96% | 0 | — |
| Ф3 | `cd-F3-domain` (migrator, домен) | flash | 0.194 | 135 | 99% | 0 (эскалации: 3 дефекта red-тестов Sonnet) | — |
| Ф3 | `cd-F3-tstfix` (migrator, правка 3 red-тестов по эскалации) | flash | 0.012 | 9 | — | 0 | — |
| Ф3 | `cd-F3-app` (migrator, прикладной слой + `u7-app`) | flash | 0.195 | 128 | — | 0 (эскалации: тест против D-36, glob DEBT-44) | — |
| Ф3 | `cd-F3-stream` (migrator, клиент `stream`) | flash | 0.068 | 68 | — | 0 | — |
| Ф3 | `cd-F3-worlds` (migrator, тестовые миры) | flash | 0.103 | 75 | — | 0 | — |
| Ф3 | `cd-F3-data` (dmg-data-keeper, перевод `courses.json`) | flash | 0.066 | 58 | — | 0 | — |
| Ф3 | `cd-F3-fix` (migrator, правки ревью + чистка дублей) | flash | 0.102 | 53 | — | 0 | 0 (ревью до правок: 0 `error`, 4 `warn`) |
| Ф4 | `cd-F4-calls` (migrator, механика stories без этапов) | flash | 0.069 | 43 | 97% | 0 | — |
| Ф4 | `cd-F4-tests` (migrator, тесты stories на kit + С9) | flash | 0.123 | 66 | 99% | 0 | — |
| Ф4 | `cd-F4-fix` (migrator, тесты под TR-59 + переименование) | flash | 0.051 | 37 | 98% | 0 (эскалации Sonnet шага 4 — 4 теста) | — |
| Ф4 | `cd-F4-review` (migrator, правки ревью + TST-08) | flash | 0.082 | 67 | 98% | 0 | 0 (ревью до правок: 0 `error`, 6 `warn`) |
| Ф5 | `cd-F5-clients` (migrator, сборка + клиенты) | flash | 0.265 | 166 | 99% | 0 (эскалация: `external` и `arch:check` между шагами — бриф orchestrator, TR-60) | — |
| Ф5 | `cd-F5-remove` (migrator, удаление legacy) | flash | 0.090 | 64 | 98% | 0 (эскалация: места в `debt.md`) | — |
| Ф5 | `cd-F5-data` (dmg-data-keeper, скрипты против v0.2.6) | flash | 0.054 | 41 | 98% | 0 | — |
| Ф5 | `cd-F5-fix` (migrator, правки ревью) | flash | 0.039 | 33 | 97% | 0 | 0 (ревью до правок: 0 `error`, 1 `warn`) |

**Итог трека (flash):** 29 шагов, $2.37 (Ф1 $0.34, Ф2 $0.49, Ф3 $0.77, Ф4 $0.33, Ф5 $0.45); кругов доработки — 1 (Ф2, `cd-F2-dqs`); `error` ревью Opus по шагам flash — 0 за пять фаз (`warn` — 8, 5, 4, 6, 1, все исправлены). Эскалации flash обоснованы: дефекты red-тестов Sonnet, устаревшие места в брифе и `debt.md`.

## Сверка с `deepseek.md`

- §2 подтверждён: flash — `migrator` по готовым тестам, `dmg-data-keeper`, правки ревью; Sonnet — брифы `tech-lead`, red-тесты, stories этапов; Opus — приёмка, бриф сборки (TR-60), ревью.
- Отклонение (Ф4): механика stories без смены поведения (`cd-F4-calls`, `cd-F4-tests`) — на flash, а не Sonnet; регрессий видимого поведения нет. Отклонение (Ф5): сборка и удаление legacy одним шагом flash ($0.27, 166 ходов) — без замечаний. Строка «механический перенос» таблицы §2 расширена.
- Red-тесты Sonnet тоже дают дефекты (Ф3 — 3 по эскалации `cd-F3-domain`): правило «тест кажется неверным — эскалация» (§3) держит качество. В §2 дописано.

## Гейт закрытия (2026-11-11)

| Где | Команда | Базовая линия | Итог |
|---|---|---|---|
| u7-school (`1b4f3562`) | `CI=true bun run check` (`bun test`) | 4216 pass, 0 fail (397 файлов) | зелёный; 4562 pass, 0 fail (393 файла) |
| u7-school (`1b4f3562`) | `bun run test:bot` | 1107 pass, 0 fail (101 файл) | 1097 pass, 0 fail (98 файлов) |
| u7-school (`1b4f3562`) | `CI=true bun test domain/src/course` | 258 pass (26 файлов) | 442 pass, 0 fail (31 файл) |
| u7-school (`1b4f3562`) | `CI=true bun test modules/course` | 170 pass (29 файлов) | 330 pass, 0 fail (22 файла) |
| dmg-core (`eea2a24`) | `CI=true bun test` | 1397 pass, 0 fail | 1401 pass, 0 fail |

Прирост `course`: +344 (домен и прикладной слой на Def, репозитории со строгим разбором, DQS этапов и пререквизита). Общий `bun test`: пик 4910 после Ф4, −350 в Ф5 — тесты удалённого legacy (сценарии перенесены, сверка — `slices/assembly.md`). Бот: −10 — тесты удалённых UC и дубли (TR-59).

## Критерии приёмки spec

| Критерий | Итог | Проверка |
|---|---|---|
| нет `throw*` для штатных отказов, `new …Ar`, `#` в Ar, импортов `core`/`app-legacy` | ✅ | `grep` по `domain/src/course`, `modules/course/src` (без тестов): `throw` и `#` нет, импортов нет; `new …Ar` — только в фабриках самих Ar |
| программа — `moduleIds`, этапы — метки `fromModuleId`; курс без этапов валиден и виден ботом | ✅ | D-64; `course.state.test.ts`, тесты навигации по `stages` (Ф4: без этапов / один / несколько) |
| `courses.json` в новом формате, ad-hoc бэкап до перевода | ✅ | `backup:adhoc --courses course-dmg-phases`, коммит `5534ac1b` |
| клиенты не сравнивают id модулей курса; нет `teachesModule` в `student.rules.ts` | ✅ | `grep teachesModule domain/src/stream modules/stream` пуст; `wish` сравнивает свою цель с ответом курса (`FulfillmentTargets`) |
| долг погашен, TR-11 закрыт, `arch:check` синхронен | ✅ | мест `course` в DEBT-1, 2, 5, 34, 44 нет, DEBT-10 закрыт, TR-11 «закрыта для всех модулей» (Ф5, TR-60); `arch:check` в `check` зелёный; остаются DEBT-3 (barrel, по spec), DEBT-50, DEBT-51 (новые, с владельцами) |
| нет `external`; legacy-фасад, адаптеры, `CourseApiModule` удалены | ✅ | `course.module.test.ts`; `grep "CourseApiModule\|CourseInProcFacade\|CourseFacade\|CourseLegacy"` пуст |
| `check` зелёный, у reviewer нет `error`, красной зоны нет | ✅ | гейт закрытия; ревью Ф1–Ф5 — `error` 0; красная зона TR-57 снята в Ф4 |
| `git status data/` чист, кроме одобренного коммита `courses.json` | ✅ | пусто |
| перепроектирования одобрены и записаны | ✅ | D-64, D-65; TR-52…60 |

## Слияние `tst-cleanup` (Ф7)

| Замер | `CI=true bun test` | `bun run test:bot` |
|---|---|---|
| `main` перед слиянием (`676dd487`) | 4562 pass, 0 fail (393 файла) | 1097 pass, 0 fail (98 файлов) |
| после слияния (`4e7e1d3a`) | 3610 pass (353 файла) — ровно −952 | 939 pass (94 файла) — ровно −158 |
| после отложенного (`f8c8b29b`) — **новая базовая линия** | 3602 pass, 0 fail (353 файла) | 932 pass, 0 fail (94 файла) |

`domain/src/course` — 442, `modules/course` — 330: без изменений. Отложенное до `course-dmg` — −8 по `inventory/deferred-delete.md` (`cd-F7-table` flash $0.078, 39 ходов, hit 97%; `cd-F7-apply` flash $0.035, 29 ходов, hit 97%). Конфликты слияния — 3 файла, все по `stream-bot-delete.md`; тест Ф4 «отказ UC → 7d» из удалённого `hub.student-events.test.ts` перенесён в `hub.test.ts`.

**Покрытие строк** (`bun test --coverage`, собственные исходники без тестов и `dmg-core`; `676dd487` против `f8c8b29b`): из 12 файлов с меньшим LH у 9 изменилось и LF — мёртвый код снят в `tst-cleanup`, покрытие 100% или выше прежнего. Реальные потери — побочное покрытие без утверждающего теста:
- `notify.story.ts:64–73` — делегат `handleCallback → unknownCommand` (принято в `tst-cleanup`, Б-9);
- `stream-nav-resolver.ts:275` — обрезка тела шага > 3200 символов: ни до, ни после её не утверждал ни один тест;
- `user-in-proc-facade.ts:68–82` (`registerGuest`) — legacy-фасад `user`, снимается треком `user`.

## Чистка тестов `course` (Ф8)

**Базовая линия (2026-11-11, `d80654fb`):**

| Слой | Область | Тестов | Покрытие строк собственных исходников |
|---|---|---|---|
| домен | `cd domain && bun test src/course` | 442 (31 файл) | 100% у всех файлов `src/course` |
| модуль | `cd modules/course && bun test` | 330 (22 файла) | 100% у всех файлов `src` |
| бот | `src/controllers/courses/{course-nav-resolver,controller}.test.ts`, `stories/course-catalog.story.test.ts`, `tests/courses/course-catalog.integration.test.ts`, `tests/e2e/{curious-showcase,pagination}.e2e.test.ts` | 104 (6 файлов) | `course-nav-resolver.ts` 98.76%, `course-catalog.story.ts` 96.05%, `controller.ts` 100% |

Область бота — экраны каталога и навигации курса. Не входят: `wish-*` (почищены с `wish`), `learning/*` (с `stream`), `main-menu.e2e` (общее меню), `content-markdown.integration` (проверка контента `data/`).

**Итог (2026-11-11, `f81f3e8b`, `1b3b0b32`):**

| Слой | Тестов до → после | Покрытие строк |
|---|---|---|
| домен | 442 → 225 (31 → 14 файлов) | 100%; `index.ts` и `status.ts` тестами больше не загружаются (barrel и тип `Status`) |
| модуль | 330 → 162 (+2 перенесённых из домена; 22 → 21 файл) | 100%, кроме `course.module.ts:71–75` (фабрика `createCourseModule`): её исполняет сборка `platform/app` (100%), как у `stream` |
| бот | 104 → 66 | без изменений: `course-nav-resolver.ts` 98.76%, `course-catalog.story.ts` 96.05%, `controller.ts` 100% |

`check`: 3602 → **3179 pass, 0 fail** — новая базовая линия. Мёртвый код: `StatusSchema` (Б-13), хелперы фикстур `admin`, `FAFA`, `CCCC`, `A0`, `A1`, `PROJECT_DRAFT`, `pageOf`/`pageThroughCycle` в `pagination.e2e`. Хвост Ф7 — неиспользуемые импорты `student-dmg.e2e`. Новые закономерности — Б-18 (тест Def в домене дублирует тест UC модуля), Б-19 (рендер презентера в тесте владельца).

Приёмка: проверка цепочек дала 38 «покрыт удаляемым» между таблицами домена и модуля. Две — настоящие петли (`course.ar.test.ts:295`/`:305` ↔ `get-course.uc.test.ts`), доменные тесты оставлены как тесты владельца. Остальные 36 — транзитивные: опора доменной строки — остающийся тест домена или гарантия платформы (Б-8). Оставлены `curious-showcase.e2e:401` (единственный путь гость → поток → «Студенты») и `pagination.e2e:222` (S03, учёба — не курс).

**DeepSeek Ф8:** 9 запусков flash, **$1.23**, 0 кругов доработок, `error` ревью нет (ревью Opus по чистке тестов не запускался — таблицы приняты до применения, гейт и `check` зелёные). Инвентаризация $0.41 (30–50 ходов), таблицы $0.42 (33–60), применение $0.39 (72–106). Рычаги `deepseek.md` §4.1: список тестов файлом и выжимка правил в промпте — инвентаризация 30–50 ходов против 26–76 у `tst-cleanup` при большем объёме; стоимость на модуль та же (`questionnaire` $1.19). Нарушение: исполнитель `cd-F8-apply-bot` дважды откатывал свои пробные правки через `git checkout --` (чужих правок в файлах не было) — в промпт применения добавлен запрет `checkout`/`restore`/`reset`/`stash`.

## Журнал `test-bloat.md` (перенесён 2026-11-11)

| Дата | Трек | Файлы | Что дублирует | Решение |
|---|---|---|---|---|
| 2026-11-05 | `course-dmg` | `modules/course/src/step/uc/get-steps-by-lessons.uc.test.ts` ↔ `domain/src/course/lesson-steps.dqs.test.ts` | правила сборки ответа (порядок, висячие ссылки, пустые уроки, статусы) после выноса в `LessonStepsDqs` | почищено в треке |
| 2026-11-05 | `course-dmg` | `modules/course/src/module/uc/get-module-snapshot.uc.test.ts` ↔ `domain/src/course/module-snapshot.dqs.test.ts` | правила сборки снимка после выноса в `ModuleSnapshotDqs` | почищено в треке |
| 2026-11-05 | `course-dmg` | `modules/course/src/course.module.test.ts` (блоки адаптеров над `legacy`) ↔ `modules/course/src/course/uc/get-*.uc.test.ts`, `course.module.serves.test.ts` | сценарии шести внешних UC после замены адаптеров | почищено в треке |
| 2026-11-05 | `course-dmg` | `domain/src/stream/stream/stream.ar.student.test.ts` (`teachesModule`) ↔ `domain/src/stream/passed-modules.dqs.test.ts` | сравнение модуля потока после перевода пререквизита на вердикт | почищено в треке |
| 2026-11-05 | `course-dmg` | legacy `modules/course/src/api/course/*-uc.test.ts`, `domain/src/course/course/{policy,a-root}.test.ts` ↔ `domain/src/course/course/course.{ar,state}.test.ts`, `module-prerequisite.dqs.test.ts`, `modules/course/src/course/uc/*.uc.test.ts` | сценарии legacy-UC курса, перенесённые в Def | удалить с legacy-кодом в Ф5 |
| 2026-11-05 | `course-dmg` | `modules/course/src/course/uc/{get-module-prerequisite,get-course-by-module,get-module-place}.uc.test.ts`, `modules/stream/src/student/uc/enroll-student.uc.test.ts`, `course.module.serves.test.ts`, `student.rules.test.ts` ↔ `module-prerequisite.dqs.test.ts`, `module-courses.dqs.test.ts`, `course.ar.test.ts` (`placeOf`), `passed-modules.dqs.test.ts` | правила DQS/Ar, повторённые в тестах UC (ревью Ф3) | почищено в треке |
| 2026-11-06 | `tst-cleanup` | `wish-questionnaire.e2e.test.ts:460`, `student-dmg.e2e.test.ts:122`, `:251`, `questionnaire-ux.e2e.test.ts`, `modules/questionnaire/src/questionnaire.module.test.ts:169` | дубли e2e и `probe`-модуль — см. «Дальше» в plan.md | почищено 2026-11-11 в `course-dmg` Ф7: −8, `questionnaire-ux.e2e.test.ts:339` оставлен (deferred-delete.md) |
| 2026-11-11 | `course-dmg` Ф8 | `domain/src/course`, `modules/course`, тесты бота каталога и навигации курса (course) | Б-1…Б-19 по таблицам `conductor/archive/course-dmg_20261105/inventory/course-*-delete.md`; тесты: 442 → 225, 330 → 162, бот 104 → 66; мёртвый `StatusSchema` удалён (Б-13); оставлены по §6 строгое чтение `courses.json` и даты репозиториев | почищено в треке |

### Рекомендации для `course` (бывш. §6 `test-bloat.md`)

`course` в трек чистки не входит: его меняет `course-dmg`. Замер признаков (2026-11-05): `normalize`/`ArchChecker` — 17 тестовых файлов (Б-7), `safeParse`/`v.parse` — 174 вызова (Б-8), legacy-тесты `modules/course/src/api` — 21 файл, тесты бота по курсу — 13 файлов.

- **Профилактика в `course-dmg` Ф4–Ф5.** При переводе тестов бота на Def-имена не переносить Б-4 и Б-9: integration/e2e каталога и навигации — один сквозной сценарий на файл, умолчания платформы story не повторять. Legacy-тесты `api/**` удалять вместе с кодом (журнал), не переносить.
- **Ф8 трека `course-dmg`** (после слияния `tst-cleanup`, Ф7) — по схеме `tst-cleanup`: инвентаризация по слоям (домен, модуль, бот) на flash с промптом `inventory/prompt-*.md`, затем таблицы удаления. Выполнено 2026-11-11 (журнал §3).
- **Порядок:** Б-7 и Б-8 (механически, большой объём) → Б-1/Б-2 (UC ↔ DQS, уже частично почищено в треке) → бот (Б-4, Б-9) после зелёной базовой линии `test:bot`.
- **Не трогать:** строгое чтение `courses.json` (инвариант программы при чтении — защита данных), тесты этапов-меток (курс без этапов / один / несколько).
