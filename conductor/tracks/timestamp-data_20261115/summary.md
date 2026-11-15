# Итог: `timestamp-data` — даты только числом

## Базовая линия (Фаза 0, 2026-11-15)

| Репо | Команда | Результат |
|---|---|---|
| dmg-core (`edd0dc0`) | `bun run check` | зелёный: 1648 pass / 0 fail, 144 файла; `docs:covers` — 3 warn (domain.md ×2, project.md) |
| u7-school (`8d3591b`) | `CI=true bun run check` | зелёный: 3456 pass / 0 fail, 332 файла |
| u7-school | `CI=true bun test` | 3456 pass / 0 fail, 332 файла |

### Счёт ISO-дат (точка сравнения для Ф5)

Шаблон — `YYYY-MM-DDTHH:MM`.

| Где | Счёт |
|---|---|
| `data/courses/*.json` | 2369: `steps.json` 1865, `lessons.json` 494, `modules.json` 8, `courses.json` 2 |
| `.ts` (без `node_modules`) | 61 файл / 160 строк; вне `Date.parse`/`new Date` — 116 строк |

## Фаза 1: dmg-core v0.3.2

- Тег `v0.3.2` → `4df6cbc` (push 2026-11-15). Коммиты среза: `a6043b1` (схема + тесты), `6a3e238` (D-16, `guides/state.md`), `5302112` (дубли «отвергает ISO» из образца убраны, TST-09), `adb4b8f` (`verified`), `4df6cbc` (версия). В релиз вошли и невыпущенные D-87/D-88.
- `check` пакета: 1655 pass / 0 fail (база 1648); `e2e` — ok; `docs:covers --strict` — чисто.
- CHANGELOG в пакете нет — пункт плана неприменим.
- Пункт 4 `RELEASING.md` (установка из git в пустой каталог) отдельно не выполнялся: установку по тегу проверит переход u7-school в Ф6.

## Фаза 2: зона проекта UTC+5

- `72edbae`: `ProjectZone` (`platform/core/src/shared/project-zone.ts`), показ старта потока и ввод в визарде — в UTC+5; C-DEBT-43 — Место `project-zone.ts`, Признак `DEFAULT_OFFSET_MINUTES`.
- `check`: 3498 pass / 0 fail (база 3456); `arch:check` — чисто.

## Фаза 3: `last-runs.json` числом

- `46b6a45b`: `JobRunJsonRepo` — `Record<string, number>`, guard Timestamp, без `toISOString`/`Date.parse`.
- `check`: 3500 pass / 0 fail.

## Фаза 4: скрипт миграции и контрольное чтение

- `71bd810`: `scripts/migrate-timestamps.ts` (64 теста), `DataDirAudit`, `data-layout.ts` (`DATA_FILES`, `DATA_MODULES`); `U7App` на `DATA_FILES`.
- Разбор ISO — строгий паритет с прежним `F.timestamp` v0.3.1; строже — только несуществующая дата и `+05`.
- Копия `data/courses`: 2369 переведено, invalid 0, diff только в строках дат; повтор — 0 изменений.
- `check`: 3571 pass / 0 fail.

## Фаза 5: контент, миры, литералы

- `6794a92`: `data/courses` — 2369 дат числом (diff только `createdAt`/`updatedAt`).
- `f8672738`: генератор миров на числа, `data/fixtures` пересоздан; ISO в state тестов → числа (9 файлов). Остаток ISO в `.ts`: обёртки `Date.parse`, негативные тесты, тест миграции, ввод визарда, DSL миров, тесты legacy-чтения (Ф6).
- `check`: 3571 pass / 0 fail.

## Фаза 6: dmg-core v0.3.2

- `8221233`: `#v0.3.2` во всех `package.json` (`bun.lock` → `4df6cbc`); «ISO отвергается» — по одному на 11 state, сквозной в stream json-repo и `DataDirAudit`; удалено 12 дублей (10 json-repo ISO, 2 сценария course).
- `check`: 3575 pass / 0 fail.

## Фаза 7: релиз и выкатка

### Финальный гейт (2026-11-15)

| Команда | Результат | База (Ф0) |
|---|---|---|
| `CI=true bun test` | 3575 pass / 0 fail, 336 файлов | 3456 / 0, 332 файла |
| `CI=true bun run check` | зелёный | зелёный |

Триаж: падений нет. Рост +119 тестов: зона проекта, валидация визарда, скрипт миграции (64), `DataDirAudit`, `data-layout`; удалено 12 дублей (Ф6) и 1 перенос (`formatDate`, Ф2).
