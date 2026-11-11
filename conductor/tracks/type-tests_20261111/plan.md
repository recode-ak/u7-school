# План: аудит тестов типов `dmg-core` (Б-17)

## Фаза 1: Базовая линия и инвентаризация
*Приёмка фазы: зафиксированы базовые числа обоих репо; у всех 153 случаев есть принятый вердикт.*

- [ ] Task: Базовая линия
    - [ ] `dmg-core`: `bun run check` и `bun run e2e`, записать pass/fail и число тестов
    - [ ] u7-school: `CI=true bun test`, записать pass/fail
- [ ] Task: Механический список скриптом, без LLM
    - [ ] `grep -n` с контекстом по `@ts-expect-error|expectTypeOf|Equal<` → `inventory/list.md` (файл:строка, фрагмент)
    - [ ] Выжимка правила §2 и критериев TST-08 (5–10 пунктов) → `inventory/rules.md`
- [ ] Task: Инвентаризация (flash, одна сессия, только чтение)
    - [ ] Промпт по `deepseek.md` §3, вход — `list.md` и `rules.md`; на выходе `inventory/table.md`: вид, гарантия, использование в `src/` или `src/testing/example/`, вердикт
    - [ ] Гейт: строк в таблице 153, у каждой строки есть вердикт
- [ ] Task: Приёмка таблицы (Opus)
    - [ ] Сверить вердикты с §2, особенно на негативных гарантиях (Def вне `calls`, ошибка вне Meta, `ReadonlyAr`/`state`, чужая команда)
    - [ ] Спорные случаи — Нурболату
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Чистка тестов в `dmg-core`
*Приёмка фазы: таблица применена; голых `@ts-expect-error` нет; `check` и `e2e` пакета зелёные; разница с базовой линией объяснена таблицей.*

- [ ] Task: Применение таблицы (flash, одна сессия)
    - [ ] Удалить позитивные тесты с вердиктом «удалить»
    - [ ] Сузить голые `@ts-expect-error`: пояснение и одна ошибка в строке
    - [ ] Рантайм-ветки — по вердикту TST-08
    - [ ] Отдельной строкой: «не ослаблять типы, не трогать `src/` вне тестов; тест кажется нужным — эскалация»
- [ ] Task: Гейт исполнителя
    - [ ] `bun run check` и `bun run e2e` пакета
    - [ ] `git diff --numstat`: изменены только `*.test.ts`
    - [ ] grep: `@ts-expect-error\s*$` даёт 0; негативные тесты на 4 гарантии §2 на месте
- [ ] Task: Ревью diff (Opus) по таблице
- [ ] Task: Коммит в репо `dmg-core`
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Правило в документации и закрытие
*Приёмка фазы: правило есть в `docs/testing.md` пакета; u7-school на новом SHA зелёный; кандидат Б-17 снят.*

- [ ] Task: Правило §2 → `docs/testing.md` пакета; при необходимости `llms.txt`; `check` пакета; коммит
- [ ] Task: u7-school на новом пакете
    - [ ] `bun install`, `bun run dmg:sync`, `bun run check`
- [ ] Task: Документы conductor (по `conductor-docs`)
    - [ ] `test-bloat.md`: Б-17 отмечена закрытой, новые закономерности — в журнал
    - [ ] Снять кандидата из `tracks.md`; `roadmap/type-tests.md` удалить, ссылки поправить
- [ ] Task: Финальный гейт
    - [ ] `CI=true bun test` в u7-school, триаж по workflow; сравнение с базовой линией обоих репо
    - [ ] `summary.md`: числа, расход flash (`usage.jsonl`), итог по таблице
    - [ ] Коммит u7-school с SHA пакета
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

---

Покрытие спецификации: ФТ1 и КП1 закрывает Ф1; ФТ2 — Ф1; ФТ3–5 и КП2–4 — Ф2; ФТ6 и КП5 — Ф3; КП6 — Ф2 и Ф3; ФТ7 и КП7 — Ф3.
