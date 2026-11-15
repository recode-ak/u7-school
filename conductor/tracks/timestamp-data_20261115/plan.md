# План: `timestamp-data` — даты только числом

> Spec — [spec.md](./spec.md). Исполнители: **O** — Opus (orchestrator), **S** — Sonnet (роли `conductor/architecture/agents.md` §4). Ф1 — репо `~/dev/tools/dmg/dmg-core` (порядок правки — `conductor/architecture/index.md`, «Правка платформы `dmg-core`»), остальное — u7-school.
>
> Порядок: Ф0 → {Ф1, Ф2, Ф3, Ф4} → Ф5 (после Ф4) → Ф6 (после Ф1 и Ф5) → Ф7. Ф5 идёт до Ф6: код проверяется на числах до того, как ISO станет ошибкой. Строгий код и данные прода сходятся только в окне «бот остановлен» (Ф7).
>
> **Режим:** трек в одной сессии-оркестраторе, шаги — свежие субагенты; ручная верификация фаз заменена автоматическими проверками; остановка — на стратегических вопросах и на шаге подтверждения записи живых данных (Ф7).

---

## Фаза 0: Базовая линия [checkpoint: d541f4d9]

- [x] Task: O — `bun run check` в dmg-core; `CI=true bun run check` и `CI=true bun test` в u7-school; числа (pass/fail, число тестов) — в `summary.md`
- [x] Task: O — счёт ISO-дат: `data/courses/*.json` (≈2370), литералы в `.ts` (≈61 файл / 160 строк) — точка сравнения для Ф5
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

**Критерии:** числа базовой линии обоих репо и счёт ISO — в `summary.md`.

## Фаза 1: dmg-core v0.3.2 — `F.timestamp` только число (ФР-1) [checkpoint: 37498819]

- [x] Task: S (`dmg-test-designer`) — red-тесты `a6043b1` (dmg-core)
    - [x] `fields.test.ts`: число принимает; ISO-строка, произвольная строка, `NaN`, `Infinity`, отрицательное, дробное — отвергает
    - [x] `withEntityDefaults` (`fields.test.ts:101,115`) и `testing/example/todo/task/task.state.test.ts` — на числах; тесты «ISO-дата → число» переписаны на «ISO отвергается»
    - [x] прочие ISO-входы тестов пакета (`grep ISO|T\d\d:\d\d`: `snapshot-json`, `project-scaffold.e2e`, `debt-checker`, `lint-fixtures`)
    - [x] Запуск — падают по делу
- [x] Task: S (`dmg-domain-author`) — `a6043b1` (dmg-core) — `src/kernel/fields/fields.ts`: убрать `parseIso`, union ISO и `transform`; число `integer`, `minValue(0)`
- [x] Task: S (`documentarian` — аудит; правка — O) — `6a3e238`, `adb4b8f` (dmg-core); CHANGELOG в пакете нет (D-87/D-88 — в сообщении релиза) — D-16 в `decisions.md` (без «переходные схемы читают ISO»), `guides/state.md`, `reference/manifests.md`, `llms.txt`, CHANGELOG пакета (с невыпущенными D-87/D-88); `bun run docs:impact`
- [x] Task: S (`dmg-reviewer`) — ревью; замечания error/warn исправлены — error нет; дубли по TST-09 убраны `5302112` (dmg-core)
- [x] Task: O — релиз `4df6cbc` (dmg-core, тег v0.3.2) — по `RELEASING.md`: `check` + `e2e`, версия, тег `v0.3.2`, push; тег и SHA — в `summary.md`
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

**Критерии:** `bun run check` и `bun run e2e` пакета зелёные, тестов не меньше базовой линии; `grep -rn "isoDateTime\|isoTimestamp\|parseIso" src/kernel/fields` пуст; тест «отвергает ISO-строку» есть; тег `v0.3.2` на коммите с правкой; D-16 обновлён.

## Фаза 2: зона проекта и `stream.startDate` (ФР-7: ввод и вывод) [checkpoint: f596cf9f]

> Бриф — [slices/f2-project-zone.md](./slices/f2-project-zone.md)

- [x] Task: S (`dmg-test-designer`) — `72edbae` — red-тесты
    - [x] модуль зоны проекта: «10:00 по Уральску ↔ 05:00Z» в обе стороны (разбор локального ввода → `Timestamp`; формат даты и времени), граница суток (22:30Z → следующий день в UTC+5)
    - [x] `create-stream`: ввод разбирается как `+05:00`; невалидный ввод — отказ с понятным текстом
    - [x] `view-stream`, `wish-invite`: старт показывается в UTC+5 (ожидания «10:00» при `startDate = 10:00Z` → «15:00»)
    - [x] Запуск — падают по делу
- [x] Task: S (`dmg-api-author`) — `72edbae` — модуль зоны в `platform/core/src/shared/` (рядом с `now.ts`): константа UTC+5 и разбор/формат; `BotUiStory.formatDate`, `#formatTime` в `view-stream.story.ts` и `wish-invite.story.ts`, `create-stream.ts:421,783`; запись C-DEBT-43 (Место, Корень, Признак — под новое место)
- [x] Task: S (`dmg-reviewer`) — `72edbae` — ревью; замечания error/warn исправлены
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (автопроверка: `check`, `arch:check`) (Protocol in workflow.md)

**Критерии:** `bun run check` и `arch:check` зелёные, тестов не меньше; `getUTCHours`/`getUTCDate` в `runners`/`platform/core` — только в модуле зоны и `review-render.ts` (за рамками); тесты в обе стороны есть; C-DEBT-43 соответствует новому Месту.

## Фаза 3: `JobRunJsonRepo` числом (ФР-2) [checkpoint: ef210d25]

> Бриф — [slices/f3-job-run-numbers.md](./slices/f3-job-run-numbers.md)

- [x] Task: S (`dmg-test-designer`) — `46b6a45b` — red-тесты `job-run-json-repo.test.ts`: `set` пишет число, `get` читает число; строка в файле — предупреждение и «нет прогона»; формат `{version:1,lastRuns:{<name>:number}}`; запуск — падают по делу
- [x] Task: S (`dmg-api-author`) — `46b6a45b` — `lastRuns: Record<string, number>`, без `toISOString`/`Date.parse`
- [x] Task: S (`dmg-reviewer`) — `46b6a45b` — ревью
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (автопроверка: `check`) (Protocol in workflow.md)

**Критерии:** `bun run check` зелёный; `grep -n "toISOString\|Date.parse" platform/app/src/infra/job-run-json-repo.ts` пуст; `platform/app/tests/u7-app.test.ts` зелёный.

## Фаза 4: скрипт миграции и контрольное чтение (ФР-3, ФР-4, ФР-7: данные) [checkpoint: dbb0f25b]

> Бриф — [slices/f4-migrate-timestamps.md](./slices/f4-migrate-timestamps.md)

- [x] Task: S (`dmg-test-designer`) — `71bd810` — red-тесты (временной каталог, `DB_DIR`)
    - [x] смешанный формат: число / ISO с зоной / ISO без зоны (как UTC) / мусор → `invalid`, файл не пишется
    - [x] идемпотентность: второй запуск — «уже число», файл не переписан
    - [x] сохраняются порядок записей, прочие поля, `version`, `updatedAt`; отсутствующие поля не добавляются
    - [x] вложенные пути (`steps[].issuedAt`, `steps[].completedAt?`, `notices[].sentAt`, `answers[].answeredAt`), optional/nullable
    - [x] `startDate`: без зоны → −5 ч; с зоной/`Z` — как есть; число → `invalid`; счёт «без зоны / с зоной / число» в итоге
    - [x] `last-runs.json` (значения по имени job); отсутствующий файл; сухой прогон по умолчанию, `--write`
    - [x] контрольное чтение: мигрированная копия — 0 ошибок; ошибка схемы — в отчёте «файл → запись → ошибка»
    - [x] Запуск — падают по делу
- [x] Task: S (`dmg-api-author`) — `71bd810` — `scripts/migrate-timestamps.ts` (карта «файл → пути» по таблице тех-лида; без импорта домена); класс контрольного чтения в `platform/app` (строгие `ArDef.state` всех файлов, отчёт), вызов после `--write`; скрипт в `package.json`
- [x] Task: S (`dmg-reviewer`) — `71bd810` — ревью; ARC-04 (скрипт импортирует только `@u7-scl/app`), `arch:check`
- [x] Task: Conductor - User Manual Verification 'Фаза 4' (автопроверка: `check`, `arch:check`, прогон на копии `data/courses`) (Protocol in workflow.md)

**Критерии:** `bun run check` и `arch:check` зелёные, тестов не меньше; `grep -n "@u7-scl/domain" scripts/migrate-timestamps.ts` пуст; сухой прогон на копии `data/courses` — ≈2370 «переведено», `invalid = 0`.

## Фаза 5: контент, миры и литералы тестов (ФР-5) [checkpoint: 19e385b9]

> Бриф — [slices/f5-content-worlds.md](./slices/f5-content-worlds.md)

- [x] Task: O — `6794a92` — `migrate-timestamps --write` на `data/courses` (под git), отдельный коммит; `git diff --stat` — только поля дат
- [x] Task: S (`dmg-api-author`) — `f8672738` — генератор миров на числа (`relative-time.ts`, `builder.ts`, `types.ts`, `invariants.ts`, `materializer.ts`); сброс кэша мира; `rm -rf data/fixtures && bun run seed:fixtures`
- [x] Task: S (`dmg-test-designer`) — `f8672738` — литералы ISO в тестах и конструкторах фикстур → числа (≈116 строк вне `Date.parse`/`new Date`); сценарии сохранены
- [x] Task: S (`dmg-reviewer`) — `f8672738` — ревью; кандидаты в чистку тестов — в отчёт
- [x] Task: Conductor - User Manual Verification 'Фаза 5' (автопроверка: `check`, grep ISO по `data/courses`, `data/fixtures`) (Protocol in workflow.md)

**Критерии:** ISO-дат в `data/courses`, `data/fixtures` (кроме логов) и `tests/worlds` нет; в `.ts` — только обёртки `Date.parse` и нарочные негативные тесты (список — в отчёте); `bun run check` и `CI=true bun test` зелёные, тестов не меньше.

## Фаза 6: u7-school на dmg-core v0.3.2 (после Ф1, Ф5)

- [ ] Task: S (`dmg-test-designer`) — тесты «legacy ISO читается» → «ISO отвергается»: `*.state.test.ts` (8), `*.json-repo.test.ts` (7), `u7-caller-resolver.test.ts:21`; негативный тест чтения ISO на каждый из 11 state; тест контрольного чтения «ловит ISO»; запуск — падают по делу
- [ ] Task: S (`migrator`) — `#v0.3.2` во всех `package.json`, `bun install`, `dmg:sync`, `agents:sync`; комментарии про legacy ISO (state-файлы, json-repo, `campaign-fields.ts:35`, `worlds/types.ts`); ветки «нет `updatedAt`/`version`» остаются
- [ ] Task: S (`dmg-reviewer`) — ревью
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)

**Критерии:** одна версия `dmg-core` `#v0.3.2` во всех `package.json`; `bun run check`, `CI=true bun test`, `arch:check` зелёные, тестов не меньше; `grep -rn "legacy ISO" --include=*.ts` пуст.

## Фаза 7: релиз и выкатка (ФР-6) — выполняет O

- [ ] Task: O — финальный гейт workflow: `CI=true bun test` полностью, триаж и сравнение с базовой линией — в `summary.md`
- [ ] Task: O — релиз u7-school (CHANGELOG, версия, тег), push
- [ ] Task: O — прод:
    - [ ] `git status` / `git diff <тег> -- data/courses` пусты
    - [ ] сверить `ls -R data` с картой скрипта (`DATA_FILES` + `jobs/last-runs.json`)
    - [ ] стоп бота; `bun run backup before-timestamp-data` (имя `before-*` — не пропускается ротацией), `bash scripts/backup.sh --verify data/backup/<снимок>`
    - [ ] чекаут релиза, `bun install` (бот не стартует)
    - [ ] сухой прогон; итог по файлам и счёт `startDate` — Нурболату; **ждать подтверждения**
    - [ ] `--write`, контрольное чтение (0 ошибок), поиск строковых дат в данных — ноль
    - [ ] старт бота; лог, `bun run oplog`; показ потока в UTC+5
    - [ ] при сбое — откат: **весь** снимок (`docs/backup.md`) и предыдущий тег; откат только по коду нельзя — v0.3.5 читает `last-runs.json`-число как NaN (внеплановые sweep). `DB_DIR` задавать явно (`bun run` не грузит `.env.production`)
- [ ] Task: O — удалить `migrate-timestamps.ts` (тест, скрипт `package.json`); убрать `timestamp-data` из `roadmap.md`; `summary.md`; разбор долга по трём реестрам
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md)

**Критерии:** сухой прогон `invalid = 0`; контрольное чтение 0 ошибок; `startDate` потоков = местное −5 ч; `last-runs.json` — числа; бот отвечает, в логе нет ошибок чтения; `grep -rn migrate-timestamps scripts package.json` пуст; `check` и `CI=true bun test` зелёные на финальном коммите.
