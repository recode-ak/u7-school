# Бриф среза: dmg-core / reader (F-111, Фаза 2)

Репо `~/dev/tools/dmg/dmg-core`, база — `f509cbf` (срез patch). Spec — ФТ-4, ФТ-5, критерии 5, 6.

## Границы

| Файл | Что |
|---|---|
| `src/app/oplog/jsonl-operation-log.ts` | опция `retainDays?: number`; при смене дня (первая запись нового дня, включая первую запись после старта) удаляются файлы `YYYY-MM-DD.jsonl` старше срока; по умолчанию — не удаляет |
| `src/app/oplog/operation-log-reader.ts` (+ тест) | класс `OperationLogReader`: чтение каталога JSONL, фильтры, порядок по `at` |
| `src/app/oplog/operation-log-feed.ts` (+ тест) | форматтер ленты (класс) — строка на запись: время, `модуль.операция`, кто, итог, изменения |
| `src/cli/main.ts` (+ тест CLI) | ветка `oplog <dir> [фильтры] [--json]` **до** `PackageSource.load`; `USAGE` |
| `src/app/index.ts`, `src/index.ts` | экспорт `OperationLogReader` и типа фильтра |

Без новых зависимостей. Документы — Ф3.

## Решения

1. **`retainDays`.** Удаляются только файлы с именем по шаблону дня в каталоге лога; дата — из имени, сравнение с днём текущей записи (часы `now` лога, не системные — тестируемо). Срок `N` — остаются файлы за последние `N` дней включая текущий. Сбой удаления — `warn`/игнор, `append` не блокируется. Проверка — один раз на смену дня, не на каждую запись.
2. **`OperationLogReader`** (`new OperationLogReader(dir, warn?)`, `read(filter): Promise<OperationRecord[]>` или async-итератор — на выбор автора):
   - `request` — цепочка по `trace.correlationId` (проверь фактическое поле в `OperationRecord`/`TraceLog`): операция, порождённые реакции, Job, вложенные вызовы;
   - `aggregate` — записи, у которых в `writes` есть `uuid`; в выводе — патчи по версиям (`from → to`, `changes`);
   - `subject` — по субъекту `caller` (проверь поле);
   - `module`, `op`, `failed` (итог — ошибка), `since`/`until` (дата `YYYY-MM-DD` — граница дня; ISO-время — точно);
   - фильтры комбинируются по И; файлы вне диапазона дат не читаются;
   - записи без `changes` читаются; битая строка JSONL — пропуск + `warn` (номер строки, файл).
3. **Лента.** Порядок по `at`. Для `--aggregate` — у каждой записи строки `path: from → to` (`redacted` — `path: [скрыто]`; `ValueDigest` — `заменено, N байт, hash`). Формат строк — на выбор автора, без цветов.
4. **CLI.** `dmg-core oplog <dir> [--request id] [--aggregate uuid] [--subject id] [--module m] [--op o] [--failed] [--since d] [--until d] [--json]`. Без `<dir>` — код 2 и `USAGE`. `--json` — исходные записи построчно (JSONL). Слои `ArchChecker`: `cli` → `app/oplog` — проверить, при запрете — согласовать с orchestrator.

## Тесты (dmg-test-designer)

- `retainDays` во временном каталоге: старше срока удалены, свежие нет; срабатывание при смене дня; по умолчанию не удаляет; сбой удаления не блокирует `append`; посторонние файлы не трогаются.
- `OperationLogReader`: каждый фильтр; комбинации; цепочка UC → ER → Job → вложенные; записи без `changes`; битая строка — пропуск + `warn`; реальная запись старого формата — копия строк из `~/dev/kalki/u7-school/data/fixtures/oplog/2026-11-13.jsonl` (фикстуры, не живые данные; взять 3–5 строк одной цепочки в тестовую фикстуру пакета).
- Лента: `redacted`, `ValueDigest`, без `changes`.
- CLI: лента, `--json`, без аргументов — код 2 и `USAGE`.

## Правила

CODE-02, CODE-04 (ссылка — `D-86`, не номер трека), TST-05..08, слои ARC, D-43.

## Критерии приёмки

- `bun run check` и `bun run e2e` зелёные; тестов не меньше 1602.
- `bun src/cli/main.ts oplog <dir> --request <id>` печатает цепочку по `at`; `--aggregate <uuid>` — патчи по версиям.

## Отчёты

### dmg-test-designer (2026-11-15)

Новые тесты: `src/app/oplog/jsonl-operation-log.retain.test.ts` (6), `operation-log-reader.test.ts` (15), `operation-log-feed.test.ts` (10), `src/cli/main-oplog.test.ts` (7); фикстура `src/app/oplog/fixtures/legacy/2026-11-13.jsonl` (5 строк одной цепочки из фикстур u7-school).

Находка: в старом формате нет поля `writes` — читатель и лента трактуют как `[]`.

API: `retainDays` — день из `record.at`, удаление внутри `append` до записи строки, остаются N дней включая текущий, только `^\d{4}-\d{2}-\d{2}\.jsonl$`. `OperationLogFilter = { request?, aggregate?, subject?, module?, op?, failed?, since?, until? }`; `new OperationLogReader(dir, warn?).read(filter): Promise<OperationRecord[]>` по `at`; `subject` — `caller.subjectId` (user, delegate), `caller.person.subjectId` (system); даты — день UTC включительно, ISO — точно. `new OperationLogFeed().lines(records, { aggregate? }): string[]` — время UTC, `module.op`, субъект или `guest`, код ошибки; с `aggregate` — `1 → 2`, `path: "a" → "b"`, `[скрыто]`, `заменено, N байт, hash`. CLI — ветка `oplog` до `PackageSource.load`, `--json`, без `<dir>` — код 2 и `USAGE` в stderr.

Прогон: 12 fail по делу (нет модулей, ветки CLI, удаления).

### dmg-api-author (2026-11-15)

Реализация: `retainDays` (чистка в `append` раз на смену дня, «сегодня» = min(день `at`, день `Date.now()`), только `OPLOG_DAY_FILE`, сбой удаления проглатывается; не целое ≥ 1 — throw); `OperationLogReader` (UTC: день включительно, ISO без смещения — UTC; несуществующая дата — `OperationLogFilterError`; строка без `at`/`module`/`op`/`kind` — пропуск + warn; старый формат без `writes` → `[]`); `OperationLogFeed`; CLI — класс `OplogCommand` (`src/cli/oplog-command.ts`). Экспорт только из `dmg-core/app`: корень пакета — без IO (ARC-03), подтверждено ревью. Исправлен тест ленты «redacted — значений нет». Синтетический `tg:1004` в фикстуре legacy вместо реального id.

check 1640 pass / 0 fail, e2e ok. `docs:impact`: `docs/concepts/caller.md`. Коммит dmg-core `c456e8d`.

### dmg-reviewer (2026-11-15)

Major: ISO без смещения в поясе процесса; `retainDays` без проверки (0 удалял текущий день). Question: будущий `at` удалял весь лог — решено min с системными часами. Minor: валидация дат, форма строки, разбор флагов CLI (класс), CODE-03/04, дубли тестов CLI и ленты (TST-08, удалены), реальный id в фикстуре. Все исправлены; повторное ревью не требовалось (error нет).

Для Ф3 (D-86): `retainDays` (срок от min(`at`, часы)), UTC-семантика фильтров, CLI `oplog`.
