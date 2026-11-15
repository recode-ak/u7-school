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
4. Повторный запуск — «уже число», файлы не изменены. Исключение — `streams.json`: `startDate`-число после миграции неотличимо от «фальшивого UTC», повторный прогон по нему — `invalid` и код 1 (ФР-7, решение spec; повторять миграцию не требуется).
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

### Ф4 шаг 1 — dmg-test-designer

`scripts/migrate-timestamps.test.ts`, `platform/app/src/infra/data-dir-audit.test.ts`, `platform/app/src/data-layout.test.ts`: смешанный формат, invalid → ничего не пишется, вложенные пути, `startDate` (без зоны −5 ч, число → invalid), `last-runs.json`, сухой прогон, побайтовая замена, идемпотентность, «всё или ничего», `run` (коды возврата); аудит — 0 ошибок / битая запись / нет файла / битый JSON. Интерфейс: `run(argv, dbDir, io)`, `migrate(dbDir, {write})`, `MigrationReport`, `DataDirAudit.run(): AuditReport`, `DATA_FILES`.
Вопрос «повторный прогон по `startDate`-числу — invalid» решён оркестратором: оставить по spec (ФР-7), критерий 4 уточнён.

### Ф4 шаг 2 — dmg-api-author (Opus)

Скрипт (карта полей поверх `DATA_FILES`/`JOB_RUNS_FILE` из `@u7-scl/app`, разбор ISO, побайтовая замена с самопроверкой, «всё или ничего», атомарная запись с сохранением режима и `fsync`, `PartialWriteError` со списком записанных, контрольное чтение после `--write`), `DataDirAudit`, `data-layout.ts` (`DATA_FILES`, `JOB_RUNS_FILE`, `OPLOG_DIR`, `DATA_MODULES`), `u7-app.ts` на `DATA_FILES`, команда `migrate:timestamps`.
Эскалация: 3 ожидания счёта в тесте посчитаны неверно — исправлены оркестратором (6/7/8).
Прогон на копии `data/courses`: переведено 2369 (2/8/494/1865), invalid 0; `--write` — diff только в строках дат (удалено = добавлено), режим файлов сохранён; повтор — «уже число» 2369, записано 0.
Сухой прогон на копии локального `data/` (dev-машина: users + courses): 2371 переведено, invalid 0.

### Ф4 шаг 3 — dmg-reviewer (Opus) и dmg-data-keeper

Error нет. Решено оркестратором:
- разбор — **строгий паритет** с прежним `F.timestamp` v0.3.1 (`isoDateTime`: `[T| ]hh:mm` без зоны; `isoTimestamp`: `:ss(.d{1,9})` + обязательная зона `Z`|`±hh:mm`|`±hhmm`); строже прежнего — только несуществующая дата и `+05` (прежняя схема пропускала мусор). Что прежняя схема не читала, на проде лежать не может;
- частичная запись — честный список записанных; режим файла сохраняется; диапазон смещения проверяется; дубли ключей; экранирование — тесты добавлены;
- пути — из `DATA_FILES`, единый `DATA_MODULES` для аудита и теста (остаток: модуль, добавленный в `U7App` мимо `DATA_MODULES`, тест не поймает);
- `#private` — конвенция соседних файлов, оставлено; тавтология в `data-layout.test.ts` удалена.
Data-keeper: карта полей полная; `bot/*`, `oplog`, `replay` дат state не содержат; `backup.sh` покрывает все мигрируемые файлы. Риски для Ф7: откат на v0.3.5 без восстановления снимка ломает `last-runs.json` (старый код `Date.parse(число)` → NaN → внеплановые sweep) → **откат = восстановление всего снимка**; снимок `before-*` (не `planned`) и `--verify`; перед `--write` сверить `ls -R data` с картой.
Data-keeper не мог проверить состав прода: эта машина — dev, прод — отдельный сервер.

Итог: `CI=true bun run check` — 3571 pass / 0 fail, `arch:check` чисто, `grep @u7-scl/domain scripts/migrate-timestamps.ts` пуст.
