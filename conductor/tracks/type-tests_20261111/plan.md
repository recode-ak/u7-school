# План: аудит тестов типов `dmg-core` (Б-17)

## Фаза 1: Базовая линия и инвентаризация [checkpoint: feead9f]
*Приёмка фазы: зафиксированы базовые числа обоих репо; у всех 135 случаев есть принятый вердикт.*

- [x] Task: Базовая линия `494af2c`
    - [x] `dmg-core`: `bun run check` и `bun run e2e`, записать pass/fail и число тестов
    - [x] u7-school: `CI=true bun test`, записать pass/fail
    - Итог (2026-11-11): `dmg-core` @ `eea2a24` — check зелёный, 1401 pass / 0 fail, 132 файла, 2765 expect; e2e ok. u7-school — 3179 pass / 0 fail, 335 файлов.
- [x] Task: Механический список скриптом, без LLM `494af2c`
    - [x] `grep -n` с контекстом по `@ts-expect-error|expectTypeOf|Equal<` → `inventory/list.md` (файл:строка, фрагмент)
    - [x] Выжимка правила §2 и критериев TST-08 (5–10 пунктов) → `inventory/rules.md`
    - Итог: 135 случаев (72 `@ts-expect-error`, 63 позитивных). Число 153 в spec включало 18 строк импорта `expectTypeOf` — гейт таблицы ниже считается по 135.
- [x] Task: Инвентаризация (flash, одна сессия, только чтение) `d4b0e2c`
    - [x] Промпт по `deepseek.md` §3, вход — `list.md` и `rules.md`; на выходе `inventory/table.md`: вид, гарантия, использование в `src/` или `src/testing/example/`, вердикт
    - [x] Гейт: строк в таблице 135, у каждой строки есть вердикт
- [x] Task: Приёмка таблицы (Opus) `d4b0e2c`
    - [x] Сверить вердикты с §2, особенно на негативных гарантиях (Def вне `calls`, ошибка вне Meta, `ReadonlyAr`/`state`, чужая команда)
    - [x] Спорные случаи — Нурболату: подтверждены 2026-11-11 (структурные тесты D-48 остаются; тест учебного модуля `todo.facade.test.ts:177` удаляется по TST-09; дубли негативов и позитивы с потребителем удаляются)
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Чистка тестов в `dmg-core` [checkpoint: efe9d17]
*Приёмка фазы: таблица применена; голых `@ts-expect-error` нет; `check` и `e2e` пакета зелёные; разница с базовой линией объяснена таблицей.*

- [x] Task: Применение таблицы (flash, одна сессия) `dmg-core@02fe86c`
    - [x] Удалить позитивные тесты с вердиктом «удалить»
    - [x] Сузить голые `@ts-expect-error`: пояснение и одна ошибка в строке — сужать нечего: голых 0, у всех 72 одна ошибка (Ф1)
    - [x] Рантайм-ветки — по вердикту TST-08
    - [x] Отдельной строкой: «не ослаблять типы, не трогать `src/` вне тестов; тест кажется нужным — эскалация»
- [x] Task: Гейт исполнителя `dmg-core@02fe86c`
    - [x] `bun run check` и `bun run e2e` пакета — зелёные, 1379 pass, 131 файл
    - [x] `git diff --numstat`: изменены только `*.test.ts` (21 файл, +18/−305)
    - [x] grep: `@ts-expect-error\s*$` даёт 0; негативные тесты на 4 гарантии §2 на месте (сверка скриптом 83 строк «оставить»)
- [x] Task: Ревью diff (Opus) по таблице `dmg-core@02fe86c`
    - Diff совпал с таблицей. Доработка (тот же `--label`): 4 устаревших имени `it`; 2 `it` в `policy.test.ts` и `def-types.test.ts` целиком — дубли `rule.test.ts:109` и `use-case-def.test.ts:120` (TST-08)
- [x] Task: Коммит в репо `dmg-core` `02fe86c`
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)
    - Разница с базовой линией: 1401 → 1379 (−22 `it`: 19 по таблице, 3 дубля после доработки), файлов 132 → 131, маркеров 72 → 62

## Фаза 3: Правило в документации и закрытие
*Приёмка фазы: правило есть в `docs/testing.md` пакета; u7-school на новом SHA зелёный; кандидат Б-17 снят.*

- [x] Task: Правило §2 → `docs/testing.md` пакета; при необходимости `llms.txt`; `check` пакета; коммит `dmg-core@93333e8`
    - Итог: `docs/reference/testing.md` §5.2, TST-10 в `rules.md`, D-68, строка в `llms.txt`; check пакета зелёный, 1379 pass
- [x] Task: u7-school на новом пакете
    - [x] `bun install`, `bun run dmg:sync`, `bun run check` — зелёный, 3179 pass
- [x] Task: Документы conductor (по `conductor-docs`)
    - [x] `test-bloat.md`: Б-17 отмечена закрытой, новые закономерности — в журнал
    - [x] Снять кандидата из `tracks.md`; `roadmap/type-tests.md` удалить, ссылки поправить
- [x] Task: Финальный гейт
    - [x] `CI=true bun test` в u7-school, триаж по workflow; сравнение с базовой линией обоих репо
    - [x] `summary.md`: числа, расход flash (`usage.jsonl`), итог по таблице
    - [x] Коммит u7-school с SHA пакета
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

---

Покрытие спецификации: ФТ1 и КП1 закрывает Ф1; ФТ2 — Ф1; ФТ3–5 и КП2–4 — Ф2; ФТ6 и КП5 — Ф3; КП6 — Ф2 и Ф3; ФТ7 и КП7 — Ф3.
