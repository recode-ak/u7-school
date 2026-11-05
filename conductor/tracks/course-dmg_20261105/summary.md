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

## DeepSeek по фазам (`deepseek.md` §5)

| Фаза | Шаг (`--label`) | Модель | $ | Ходов | hitRate | Кругов доработки | `error` ревью |
|---|---|---|---|---|---|---|---|
| Ф1 | `cd-F1-s0` (migrator, S0 переименование) | flash | 0.024 | 26 | 96% | 0 (красный — бриф orchestrator, старый путь v0.2.6 в брифе) | — |
| Ф1 | `cd-F1-domain` (migrator, домен) | flash | 0.107 | 79 | 99% | 0 (эскалации: маркер DEBT-10 в комментарии теста — снят orchestrator; `ProjectVo` в `shared/` из-за DOM-11) | — |
| Ф1 | `cd-F1-app` (migrator, прикладной слой + `u7-app`) | flash | 0.102 | 75 | 99% | 0 (экспорт `ModuleArDef`/`ModulePolicy` из `domain/src/course/index.ts` — принято) | — |
| Ф1 | `cd-F1-data` (dmg-data-keeper) | flash | 0.028 | 20 | 96% | 0 | — |
| Ф1 | `cd-F1-fix` (migrator, правки ревью) | flash | 0.062 | 51 | 98% | 0 | 0 (ревью до правок: 0 `error`, 8 `warn`) |
