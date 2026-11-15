# Бриф Ф3: `JobRunJsonRepo` числом (ФР-2)

Трек — [spec.md](../spec.md) (ФР-2), [plan.md](../plan.md) Ф3.

## Расхождение plan с кодом

`platform/app/tests/u7-app.test.ts` придётся править: хелперы `seedLongAgoRuns` (`:625`, `toISOString`), `readLastRuns` (`:639`, `Record<string,string>`), `waitRunsAfter` (`:651`), ассерты `:683,706` (`Date.parse(runs[name])`). Других потребителей `lastRuns` нет.

## Границы

`platform/app/src/infra/job-run-json-repo.ts`, `job-run-json-repo.test.ts`, `platform/app/tests/u7-app.test.ts` (хелперы `:619-720`). Не трогать: порт `JobRunRepo` в `dmg-core`, миграцию ISO (скрипт Ф4).

## Решения

- Файл: `{version:1, lastRuns:{<job>: number}}`, значение — `Timestamp` как есть.
- `JobRunFile.lastRuns: Record<string, number>`.
- Корректное значение — `Number.isSafeInteger(at) && at >= 0` (как `F.timestamp`). Иное, включая ISO-строку, → `undefined` + `warn` (путь файла, имя job, `{value}`). Fallback на ISO нет — старые записи переводит скрипт Ф4 до старта бота.
- Повреждённый файл — как сейчас. Ключ с ISO при записи не удаляется (перезапишется своим `set`).

## Было → станет

| Было | Станет |
|---|---|
| `:13` `Record<string,string>` | `Record<string, number>` |
| `:35-47` `Date.parse(at)`, `NaN` → warn | guard, иначе warn |
| `:54` `new Date(at).toISOString()` | `at` |
| тест «set пишет ISO-строку» | «set пишет число» (через `JSON.parse` файла) |
| тест keep-keys на ISO | на числах |
| тест «ISO читается как число» | «ISO-строка → undefined и warn; соседние числовые ключи читаются» (TST-08: инверсия, не копия) |
| — | отрицательное и дробное → warn и `undefined` |
| `u7-app.test.ts` хелперы на ISO | на числах |

## Критерии приёмки

1. `bun run check` зелёный, `u7-app.test.ts` зелёный, тестов не меньше.
2. `grep -n "toISOString\|Date.parse" platform/app/src/infra/job-run-json-repo.ts` пуст.

## Правила

Проект: ARC-09, TST-06. `dmg-core`: DOM-12, CODE-04, TST-04, TST-05, TST-08, TST-09.

## Шаги

1. `dmg-test-designer` — red-тесты; запуск — падают по делу.
2. `dmg-api-author` — правка репо.
3. `dmg-reviewer`.

## Открытые вопросы

—

## Отчёты

### Ф3 шаг 1 — dmg-test-designer

`job-run-json-repo.test.ts`: «set пишет число», keep-keys на числах, «ISO → undefined и warn; соседний числовой ключ читается» (инверсия), отрицательное/дробное/`null` → warn, `0` — корректный. `u7-app.test.ts`: хелперы на числах. Red: 7 из 24 по делу.

### Ф3 шаг 2 — dmg-api-author

`lastRuns: Record<string, number>`, guard `isSafeInteger && >= 0`, запись `at` как есть. `grep toISOString|Date.parse` пуст. Формат хранения меняется намеренно: `last-runs.json` на проде переводит скрипт Ф4 в окне Ф7.

### Ф3 шаг 3 — dmg-reviewer

Error/major нет. Minor CODE-04 (JSDoc «нечитаемая дата», тип с диска не проверен) — JSDoc уточнён оркестратором; minor «слить тест `0`» — оставлено (отдельный класс входа — граница).

Итог: `CI=true bun run check` — 3500 pass / 0 fail.
