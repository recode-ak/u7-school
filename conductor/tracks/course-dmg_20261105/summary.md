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
