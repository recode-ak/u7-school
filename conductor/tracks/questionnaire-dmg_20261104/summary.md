# Summary: questionnaire-dmg_20261104

## Базовая линия (2026-11-04)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`bc2c0950`) | `CI=true bun test` | 3959 pass, 0 fail (386 файлов) |
| u7-school (`bc2c0950`) | `bun run test:bot` (e2e-тесты бота) | 1039 pass, 0 fail (97 файлов) |
| u7-school (`bc2c0950`) | `CI=true bun test domain/src/questionnaire` | 97 pass, 0 fail (11 файлов) |
| u7-school (`bc2c0950`) | `CI=true bun test modules/questionnaire` | 51 pass, 0 fail (8 файлов) |
| dmg-core (`6cfe5f2`) | `CI=true bun test` | 1397 pass, 0 fail (132 файла) |
| dmg-core (`6cfe5f2`) | `bun run e2e` | `e2e: ok` |

Расхождение со spec: на конец `stream` записано 3947 pass, сейчас 3959 — +12 тестов от трека волны 2 ролей (после закрытия `stream`).

## Пилот ролей

Строка на каждый вызов роли ([agent-roles.md](../../architecture/agent-roles.md) §5). Роли — из пакета `dmg-core` (волна 2).

| # | Роль | Задача | Модель | Повлиял на решение | Принято замечаний | Промпт правился | Оценка orchestrator |
|---|---|---|---|---|---|---|---|
| 1 | `dmg-tech-lead` | Черновик брифа `questionnaire` (Ф0) | Sonnet | да — 10 расхождений с планом: `external` снимается уже в Ф1 (MAN-06 для Job), `U7App` в Ф1, `GetTelegramAddressesUcDef` недоступен story, `updatedAt` в `change`; variant-state поддержан без правки пакета; 2 стратегических и 20 тактических вопросов | проверены 4 ключевых утверждения — верны; С1, С2, Т1 — Нурболат по рекомендациям, Т2–Т20 приняты (TR-48); бриф принят без переписывания | нет | полезен; ~306k токенов, 17 мин, 87 вызовов инструментов |
| 2 | `dmg-test-designer` | Характеризация и red-тесты среза `questionnaire` (Ф1) | Sonnet | да — зафиксирован API Ar/UC/фейка/репозитория для migrator; Ar-тесты разбиты на 4 файла; Т10 — один код `NOT_INVITED` | прогон сверен: 474 pass / 61 fail / 25 «нет модуля» — всё ожидаемый red; удаления только в тестах состава модуля (по брифу) | нет | полезен; ~267k токенов, 6 мин (+ пауза на лимит API) |

## DeepSeek по фазам (`deepseek.md` §5)

| Фаза | Шаг (`--label`) | Модель | $ | Ходов | hitRate | Кругов доработки | `error` ревью |
|---|---|---|---|---|---|---|---|
