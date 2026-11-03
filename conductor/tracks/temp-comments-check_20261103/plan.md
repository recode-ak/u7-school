# Plan: temp-comments-check_20261103

Каждая фаза — отдельная сессия: Нурболат начинает её сам с выбранной моделью.

**Модели по фазам:** Ф1 — Sonnet (работа по готовому образцу: `checkIds`, `checkTrMarkers`, блок «DEBT-N в коде»; фаза небольшая), Ф2 — Sonnet (документация и снятие кандидата по образцу).

**Агенту:** в начале сессии сверь модель с этой таблицей — не совпадает, скажи Нурболату до начала работы. В конце фазы (после контрольной точки) последней строкой сообщи: «Следующая — Фаза N: <имя>, модель <Opus|Sonnet>, новая сессия».

Код — TDD (red → запуск → green). Поведение кода не меняется; данные `data/` не трогаем; пушей и деплоя нет.

## Фаза 1: Проверка маркеров в `DebtRegistry` (Sonnet)

- [ ] Task: Базовая линия: `bun run check` (число тестов) и `bun run arch:check` до правок — записать в черновик `summary.md`
- [ ] Task: Red-тесты в `scripts/domain-check.test.ts` (роль `test-designer`), новый `describe` рядом с «DEBT-N в коде»; запустить, зафиксировать red
    - [ ] Каждая из трёх фраз вне Места: ошибка с путём, строкой и подсказкой
    - [ ] Фраза в файле из Места открытой записи — ошибки нет
    - [ ] Фраза в Месте закрытой записи («слит в») — ошибка есть
    - [ ] Регистр: «ВРЕМЕННЫЙ» только заглавными; две другие фразы без учёта регистра
    - [ ] Без ложных срабатываний: «временный», «временные метки», «одновременно», «временном каталоге»
- [ ] Task: Реализация: `DebtRegistry.checkTempMarkers`, вызов из `check`, тесты green; обновить шапку `domain-check.ts`
- [ ] Task: `bun run arch:check` на реальном коде — 0 новых нарушений, сравнить с базовой линией
- [ ] Task: Ревью diff по `rules.md` (роль `reviewer`)
- [ ] Task: Conductor - User Manual Verification 'Проверка маркеров в DebtRegistry' (Protocol in workflow.md)

*Приёмка:* тестов больше базового числа, red зафиксирован; `bun run check` и `arch:check` зелёные; `scripts/arch-check.ts` не менялся; новых исключений в `readPackageSources` и `checkDebt` нет.

## Фаза 2: Документация и снятие кандидата (Sonnet)

- [ ] Task: `conductor/architecture/debt.md` («Правила»): список фраз, регистр, где маркер допустим, текст ошибки; проверить `rules.md` и `migration.md` на упоминания маркеров
- [ ] Task: Снять кандидата в `conductor/tracks.md`, удалить `conductor/roadmap/temp-comments-check.md`
- [ ] Task: Финальный гейт: `bun run check` и `bun run arch:check` зелёные, сравнение с базовой линией; итог в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Документация и снятие кандидата' (Protocol in workflow.md)

*Приёмка:* `grep "Временное решение" conductor/architecture/debt.md` находит правило; `grep temp-comments conductor/tracks.md` пусто; файла `roadmap/temp-comments-check.md` нет.
