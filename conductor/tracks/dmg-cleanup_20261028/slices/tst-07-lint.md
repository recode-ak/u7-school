# Срез: TST-07 — фейки и `dmg-core/testing` только в тестах

Трек: [dmg-cleanup_20261028](../plan.md), Фаза 2, по ревью ([memory-repo.md](./memory-repo.md), «Отчёт ревьюера»). Решение — D-55 в `docs/decisions.md` пакета (последний пункт, TST-07).

## Где работать

- Репо пакета: `~/dev/tools/dmg/dmg-core` (не `node_modules`), абсолютные пути при записи.
- `src/cli/scaffold/lint-map.ts` (+ тесты, в т. ч. `project-scaffold.e2e.test.ts`) — новая строка карты для проектов-потребителей.
- `biome.json` пакета — то же правило на учебный модуль (`src/testing/example/app/**`), если это не ломает сам пакет; иначе — обоснуй в отчёте.
- `docs/rules.md`: строка TST-07 в разделе TST (проверка — lint) и строка в «Карте линтера».
- Переименование теста: `src/testing/example/app/todo/task/er/release-removed-user-tasks.er.test.ts` — «задач у пользователя нет — Ok, файл не создан» → «задач у пользователя нет — Ok, ничего не записано» (решение Нурболата). Других имён не трогать.
- Не коммитить, `conductor/` не трогать.

## Правило

TST-07: в прикладном слое и корне сборки (каталоги строки DOM-01 «прикладной слой» карты) нетестовые файлы не импортируют `dmg-core/testing` и `*.repo.fake` (по спецификатору — `**/*.repo.fake`). Исключения: `*.test.ts` (вся карта их уже исключает) и сами `*.repo.fake.ts` (им `dmg-core/testing` нужен). Механизм — `noRestrictedImports` по образцу DOM-01; сообщение начинается с `TST-07: …`. Учти, что biome не сливает две секции `noRestrictedImports` на одни файлы (см. `repeats` в `LintMap` и комментарий в `project-scaffold.e2e.test.ts` про ARC-02 и DOM-01) — проверь, что DOM-01 и TST-07 на одних файлах действуют оба.

## TDD

1. Тесты карты и e2e каркаса (`init` → сгенерированный `biome.json` ловит импорт фейка из `*.uc.ts`; фейк и тест — без нарушений) — **red**, запуск.
2. Реализация — **green**.
3. `bun run check` и `bun run e2e` пакета зелёные.

## Критерии приёмки

- Импорт `*.repo.fake` или `dmg-core/testing` из рабочего файла прикладного слоя — ошибка lint `TST-07`; фейки и тесты — без нарушений; DOM-01 не ослаб.
- `rules.md` (TST и карта) согласован с `LintMap`.
- Тест ER переименован.
- `check` и `e2e` пакета зелёные. Отчёт: файлы, red/green, отклонения.

## Отчёт автора

api-author (Opus), 2026-10-28. Пакет `dmg-core` `d448dd5`.

- `lint-map.ts`: строка TST-07 после DOM-01 «прикладной слой» — `<app-dirs>/**` без `infra/**` и `*.repo.fake.ts`; запрет `**/*.repo.fake`, `dmg-core/testing`, `dmg-core/testing/**`; `repeats: ['DOM-01']`.
- Отклонение: `bans()` — `repeats` берёт ближайшую строку с ID выше (раньше — первую, доменную DOM-01 с чужим сообщением); тест в `lint-map.test.ts`.
- Отклонение: `infra/` вне TST-07, как и DOM-01 прикладного слоя (иначе ложный DOM-01 на json-repo).
- `biome.json` пакета: секция для `src/testing/example/app/**` (кроме тестов, `infra`, фейков) — ARC-10, DOM-01, TST-07 (+ `#core/testing`, `#core/testing/*`).
- `rules.md`: TST-07 и строка карты; фикстуры `lint-fixtures/…`; `scripts/lint-rules.test.ts` — фильтр ID с `TST`; e2e каркаса single/monorepo.
- Тест ER переименован: «…Ok, ничего не записано».
- red: 7 падений; green. `check` пакета — 1275 pass / 0 fail, `e2e: ok` (сверил orchestrator). u7-school: `bun install`, `dmg:sync` — без изменений файлов, `check` 3273 pass / 0 fail.

## Отчёт ревьюера
