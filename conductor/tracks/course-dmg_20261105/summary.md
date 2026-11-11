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
