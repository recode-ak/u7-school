# Бриф Ф5: контент, миры и литералы тестов (ФР-5)

Трек — [spec.md](../spec.md) (ФР-5), [plan.md](../plan.md) Ф5. Бриф — оркестратор (без тех-лида: границы заданы планом).

## Сделано до агентов

- `6794a92`: `data/courses/*.json` переведены скриптом (2369 полей, diff только `createdAt`/`updatedAt`).

## Границы

- Шаг 2 (`dmg-api-author`): генератор миров `runners/u7-bot/tests/worlds/**` — `relative-time.ts`, `builder.ts`, `types.ts`, `invariants.ts`, `materializer.ts` (и что найдётся): все даты state — `Timestamp`; `startDate` — настоящий UTC (местное 10:00 = 05:00Z; если генератор задаёт «время старта», выражать через `ProjectZone` из `platform/core` или явный UTC). Сброс кэша мира (где он — найти в `worlds/`); `rm -rf data/fixtures && bun run seed:fixtures` — `data/fixtures` генерат, не живые данные. `generatedAt` в `world.json` — не state, за рамками. Также найти любые места рабочего кода и скриптов, которые **пишут** ISO-строку в поле state (`toISOString()` в данных, генераторы контента в `data/courses`) — список в отчёт, правка в границах генераторов.
- Шаг 3 (`dmg-test-designer`): литералы ISO-дат в тестах и конструкторах фикстур (`*.test.ts`, `*test-kit*.ts`, `tests/**`) → числа (≈116 строк вне `Date.parse`/`new Date`; база — `summary.md`). Допустимо оставить `Date.parse('…Z')` как читаемую обёртку числа. Сценарии сохранить; нарочные негативные тесты (ISO как вход, который должен отвергаться) — оставить и перечислить. Тесты «legacy ISO читается» **не трогать** — это Ф6 (после перехода на v0.3.2). `student-dmg.test-kit.ts:38` (`${iso}Z`) — сюда.
- Не трогать: `scripts/migrate-timestamps*` (ISO там — вход миграции), `data/` кроме `data/fixtures`, домен и модули (кроме тестов).

## Критерии приёмки

1. `grep -rnE '"[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}' data/courses data/fixtures --include=*.json` — пусто (кроме логов).
2. В `runners/u7-bot/tests/worlds` ISO-литералов дат нет.
3. В `.ts` ISO-литералы — только внутри `Date.parse`/`new Date` и в нарочных негативных тестах, тестах миграции и тестах Ф6 (список — в отчёте).
4. `CI=true bun run check` зелёный, тестов ≥ 3571.

## Правила

`dmg-core`: TST-04, TST-05, TST-08 (сценарии переезжают), DOM-12. Проект: TST-06.

## Открытые вопросы

—

## Отчёты

### Ф5 шаг 2 — dmg-api-author

Генератор миров (`relative-time.ts`, `builder.ts`, `types.ts`, `invariants.ts`, `index.ts`, `kit-framework.test.ts`): `resolveRelativeTime` → число; типы миров = state агрегатов; `startDate` — UTC от якоря мира (местного времени генератор не задаёт). Кэш — `.cache/worlds`, сброшен; `data/fixtures` пересоздан. Рабочего кода, пишущего ISO в state, нет (`toISOString` — имена бэкапов, логи, показ, `generatedAt`). Генераторов контента `data/courses` нет.

### Ф5 шаг 3 — dmg-test-designer

9 файлов (+94/−72): ISO в полях state → `Date.parse('…Z')`/числа (`review.fixture.ts`, learning/mentor/streams stories-тесты, `student-dmg.test-kit.ts` — `${iso}Z` убран). Оставлены по категориям: обёртки `Date.parse`/`new Date`; негативные (`project-zone.test.ts`, `job-run-json-repo.test.ts`); миграция (`migrate-timestamps.test.ts`); ввод визарда (`create-stream.test.ts`, строки пользователя); входы DSL миров (`resolveRelativeTime('…')`); Ф6 — `*.state.test.ts`, `*.json-repo.test.ts`, `u7-caller-resolver.test.ts`, `u7-app.test.ts:332,339,350,396`, `update-stream-snapshot.test.ts:20`, `wish-legacy-records.integration.test.ts:26-27`.

### Ф5 шаг 4 — dmg-reviewer

Error нет. Question `minimal.ts:16` (`registeredAt` заменён на `T-30d` — сдвиг +12 ч, вне брифа) → оркестратор вернул абсолютную дату. Question «якорь по умолчанию `new Date()` без обрезки до минуты» → принято: якорь не входит в ключ кэша мира. Minor `startDate: startDate` — косметика, оставлено.

Итог: ISO в `data/courses` и `data/fixtures` нет (кроме `generatedAt`); `CI=true bun run check` — 3571 pass / 0 fail.
