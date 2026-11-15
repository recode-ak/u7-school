# Бриф Ф4: скрипт миграции и контрольное чтение (ФР-3, ФР-4, ФР-7: данные)

Трек — [spec.md](../spec.md), [plan.md](../plan.md) Ф4.

## Расхождения plan/spec с кодом

- Файлы данных — **голые JSON-массивы** записей (repo: `v.parse(v.array(XArDef.state), …)`, запись `JSON.stringify(rows, undefined, 2)`). Обёртки нет; `version` в записи — версия агрегата. Исключение — `jobs/last-runs.json`: `{version:1, lastRuns:{…}}`.
- `data/courses/lessons.json` и `modules.json` отформатированы не как пишет repo (однострочные массивы). Пересериализация даст шум в `git diff` → нужна **побайтовая замена** значений.
- До Ф6 (`dmg-core` v0.3.1) `ArDef.state` молча читает ISO: тест «контрольное чтение ловит ISO» возможен только в Ф6; в Ф4 — «0 ошибок» на мигрированной копии и «ошибка схемы — в отчёте» на заведомо битой записи.

## Границы

- `scripts/migrate-timestamps.ts`, `scripts/migrate-timestamps.test.ts`; `package.json` корня (`"migrate:timestamps": "bun run scripts/migrate-timestamps.ts"`).
- `platform/app/src/infra/data-dir-audit.ts` + тест; `platform/app/src/data-layout.ts`; `platform/app/src/u7-app.ts` (литералы путей → `DATA_FILES`); экспорт `DataDirAudit` из `platform/app/src/index.ts`.
- **Живые данные не читать и не писать.** Тесты — на временном каталоге (`TempDir`) и синтетических файлах. Копию `data/courses` для критерия 3 гоняет оркестратор.
- Не трогать: `oplog`, `replay`, `backup*`, `data/migrations/*`, `data/sources`, `data/fullstack-js`, `data/bot/*`, корневые `data/fixtures/{streams,students,users}.json`, `world.json`.

## Карта «файл в `DB_DIR` → поля дат»

Базовые `createdAt`, `updatedAt` — у всех агрегатов; у legacy-записей `updatedAt` может отсутствовать — не добавлять.

| Файл | Агрегат | Пути |
|---|---|---|
| `users/users.json` | `user` | `createdAt`, `updatedAt` |
| `courses/courses.json` (git) | `course` | `createdAt`, `updatedAt` |
| `courses/modules.json` (git) | `module` | `createdAt`, `updatedAt` |
| `courses/lessons.json` (git) | `lesson` | `createdAt`, `updatedAt` |
| `courses/steps.json` (git) | `step` | `createdAt`, `updatedAt` |
| `wish/wishes.json` | `wish` | `createdAt`, `updatedAt` |
| `questionnaires/questionnaires.json` | `questionnaire` | `createdAt`, `updatedAt`, `warnedAt?`, `continueInvitedAt?`, `completedAt` (nullable), `answers[].answeredAt` |
| `peer-review/campaigns.json` | `review-campaign` | `createdAt`, `updatedAt`, `expiresAt` |
| `peer-review/reviews.json` | `review` | `createdAt`, `updatedAt` |
| `streams/streams.json` | `stream` | `createdAt`, `updatedAt`, **`startDate` (местное UTC+5)** |
| `streams/students.json` | `student` | `createdAt`, `updatedAt`, `enrolledAt`, `steps[].issuedAt`, `steps[].completedAt?`, `notices[].sentAt` (`notices` необязателен) |
| `jobs/last-runs.json` | — | значения `lastRuns.<job>` |

## Решения

- **Карта — явный список в скрипте**, домен не импортируется (ARC-04). Нотация `steps[].completedAt`; поле `{path, zone?: 'local'}`.
- **Разбор строки** (как прежний `F.timestamp`): `YYYY-MM-DDTHH:mm`, `…:ss(.sss)`; без зоны = UTC; `Z`/`±hh:mm` — как есть. Date-only и мусор → `invalid`. `null`/отсутствие — не трогать. Число — «уже число».
- **`startDate`:** строка без зоны → как `+05:00` (−5 ч); с `Z`/смещением — как есть; **число → `invalid`**. Итог по `streams.json`: «без зоны / с зоной / число» и `uuid` потоков без зоны.
- **Побайтовая замена:** разобрать JSON, по карте вычислить новые значения, в исходном тексте заменить строковые литералы значений; самопроверка — `JSON.parse(новый текст)` deep-equal мигрированному дереву, иначе ошибка, файл не пишется. Форматирование, порядок, прочие поля, `version`, `updatedAt` (значения как есть после перевода) сохраняются.
- **Всё или ничего:** сначала разбор всех файлов; запись — только если суммарно `invalid == 0`; иначе код возврата ≠ 0 (и в сухом прогоне). Запись атомарная (временный файл + `rename`). Файл без изменений не перезаписывается.
- Итог — по каждому файлу: переведено / уже число / не разобрано (с путём записи и поля); отсутствующий файл — «нет файла».
- Устройство скрипта — `run(argv, io)` + `if (import.meta.main)` по образцу `scripts/update-stream-snapshot.ts`. Каталог — `DB_DIR` (по умолчанию `data`). Сухой прогон по умолчанию; `--write` — запись и затем контрольное чтение.
- **`DataDirAudit`** (`platform/app/src/infra/data-dir-audit.ts`): `new DataDirAudit(dbDir)`, `async run(): Promise<AuditReport>`; схемы — `XModuleDef.aggregates[i].state`/`.name` из `@u7-scl/domain/<m>/contract` (как в `u7-app.ts`, ARC-07); `v.safeParse` массива по записям; отчёт — по файлам число записей и `issues: {file, index, uuid?, message}[]`, общий `ok`; не бросает, не пишет. JSDoc: инварианты уровня repo (`CourseProgramInvariant`) не проверяются. После трека класс остаётся.
- **`data-layout.ts`:** `DATA_FILES` — карта `aggregate.name → относительный путь`; её используют `U7App` и `DataDirAudit`. Тест: все агрегаты всех `*ModuleDef` покрыты.

## Критерии приёмки

1. `bun run check`, `bun run arch:check` зелёные; тестов не меньше.
2. `grep -n "@u7-scl/domain" scripts/migrate-timestamps.ts` пуст.
3. Сухой прогон на копии `data/courses` (временный каталог): 2369 «переведено», `invalid = 0`; `--write` на копии → `diff` только в строках с датами (добавлено = удалено).
4. Повторный запуск — «уже число», файлы не изменены.
5. `DataDirAudit` на мигрированной копии — 0 ошибок.
6. `u7-app.ts` без литералов путей данных.

## Правила

Проект: ARC-04, ARC-07, ARC-09, ARC-12, DOM-01, TST-06. `dmg-core`: DOM-11, DOM-12, CODE-02, CODE-04, TST-04, TST-05, TST-07, TST-09.

## Шаги

1. `dmg-test-designer` — red-тесты:
   - `migrate-timestamps.test.ts`: смешанный формат (число / ISO с зоной / ISO без зоны / мусор → `invalid`, ничего не пишется); идемпотентность (байты равны); сохранение порядка, полей, `version`; отсутствующие поля не добавляются; вложенные пути, `completedAt: null`, нет `notices`; `startDate` (без зоны −5 ч, с зоной как есть, число → `invalid`, счёт трёх видов); `last-runs.json`; отсутствующий файл; сухой прогон по умолчанию, `--write`; формат байт в байт (однострочные массивы, `\n` в конце и без); «всё или ничего» (`invalid` в одном файле — не пишется ни один).
   - `data-dir-audit.test.ts`: валидная копия → 0 ошибок; битая запись → «файл → запись → ошибка»; покрытие `DATA_FILES`.
   - Запуск — падают по делу.
2. `dmg-api-author` — скрипт, `DataDirAudit`, `data-layout.ts`, `u7-app.ts`, `package.json`.
3. `dmg-reviewer` — ARC-04/ARC-07, `arch:check`.

## Открытые вопросы

—

## Отчёты
