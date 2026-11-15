# План: лог операций для расследований (F-111)

> Spec — [spec.md](./spec.md). Исполнители: **O** — Opus (orchestrator), **S** — Sonnet (роли `conductor/architecture/agents.md` §4). Ф1–Ф3 — репо `~/dev/tools/dmg/dmg-core` (порядок правки — `conductor/architecture/index.md`, «Правка платформы `dmg-core`»), Ф4 — u7-school. Порядок строго Ф0 → Ф1 → Ф2 → Ф3 → Ф4: u7-school зависит от тега пакета. Одна фаза — одна сессия.

> **Режим (Нурболат, 2026-11-15):** трек целиком в одной сессии-оркестраторе, шаги — свежие субагенты; ручная верификация фаз заменена автоматическими проверками, остановка — только на стратегических вопросах.

---

## Фаза 0: Базовая линия [checkpoint: 34162d9f]

- [x] Task: O — `bun run check` в dmg-core; `CI=true bun run check` и `bun run test:bot` в u7-school; числа (pass/fail, число тестов) — в `summary.md`
- [x] Task: O — замер: размер `data/fixtures/oplog/*.jsonl` (копия в scratchpad) — точка сравнения объёма для Ф1
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

**Критерии:** числа базовой линии обоих репо и размер лога фикстур — в `summary.md`.

## Фаза 1: dmg-core — патч полей и маскирование всей записи (ФТ-1, ФТ-2, ФТ-3) [checkpoint: 1c2cd73]

- [x] Task: S (`dmg-tech-lead`) — бриф среза `slices/patch.md`: `Aggregate.baseline` / `Committable.baseline`; класс сравнения (`FieldDiff`, место — `src/app/oplog/` или `src/domain/aggregate/`); `F.sensitive` и `SensitiveMask` (обход схемы valibot: object, array, optional/nullable/nullish, pipe, record, variant/union, `withEntityDefaults`); точки применения: `OperationRun` (input по схеме UC/события, output, payload ошибки) и UoW (`changes`); `AggregateWrite.changes`; `ValueDigest` и порог в `JsonlOperationLog`; ID `rules.md` (DOM-17 — `snapshot()` только репозиторий: `baseline` через публичный геттер)
- [x] Task: S (`dmg-test-designer`) — red-тесты
    - [x] `baseline`: restore / create (нет) / после `markStored`
    - [x] `FieldDiff`: объекты по точке, массив и примитив — лист, созданный — `from: undefined`, без `BaseEntityFields`
    - [x] `SensitiveMask`: каждый вид схемы; пометка в производной схеме (выход из state, вход из VO); лишние ключи сырого входа — как есть; сбой — `'[redacted]'` целиком
    - [x] запись лога: помеченные поля во `input` UC и ER (payload события), `output`, `payload` ошибки, `changes` (`redacted: true`) — значения нет в строке JSONL
    - [x] `UnitOfWork.commit`: `changes` у command, у query нет; сбой расчёта патча не ломает операцию
    - [x] `JsonlOperationLog`: значение больше порога — `{ size, hash }`, одинаковые значения — одинаковый hash
    - [x] Запуск — падают по делу
- [x] Task: S (`dmg-domain-author`) — реализация (green) [dmg-core f509cbf]; sha256 — `node:crypto`; замер стоимости сравнения на крупном снимке (`contentSnapshot`-подобное дерево); при дороговизне — порог размера сравнения (сверх — дайджест всего поля)
- [x] Task: S (`dmg-reviewer`) — ревью среза по `rules.md`; замечания error/warn исправлены [dmg-core f509cbf]
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

**Критерии:** `bun run check` dmg-core зелёный, тестов не меньше базовой линии; критерии spec 1–4 закрыты тестами (маскирование — на example-модуле пакета: UC, ER, ошибка); запись без `changes` принимается типом; `git diff package.json` — без новых зависимостей; замер стоимости сравнения — в `summary.md`.

## Фаза 2: dmg-core — срок хранения и читатель (ФТ-4, ФТ-5) [checkpoint: 7d7d002]

- [x] Task: S (`dmg-test-designer`) — red-тесты
    - [x] `retainDays` (временной каталог): старше срока — удалены, свежие — нет; срабатывание при смене дня; по умолчанию не удаляет; сбой удаления не блокирует `append`
    - [x] `OperationLogReader`: фильтры `request` (цепочка по `correlationId`: UC → ER → Job → вложенные), `aggregate` (патчи по версиям), `subject`, `module`, `op`, `failed`, `since`/`until`; комбинации; записи без `changes`; битая строка JSONL — пропуск с предупреждением; реальная запись из копии `data/fixtures/oplog/`
    - [x] CLI `oplog`: лента, `--json`, без аргументов — код 2 и `USAGE`
    - [x] Запуск — падают по делу
- [x] Task: S (`dmg-api-author`) — реализация (green) [dmg-core c456e8d]: `retainDays`; `OperationLogReader` и форматтер ленты в `src/app/oplog/`; ветка `oplog` в `src/cli/main.ts` до `PackageSource.load`, `USAGE`; проверить правила слоёв `ArchChecker` (`cli` → `app/oplog`)
- [x] Task: S (`dmg-reviewer`) — ревью среза; замечания error/warn исправлены [dmg-core c456e8d]
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

**Критерии:** `bun run check` зелёный, тестов не меньше; `bun src/cli/main.ts oplog <dir> --request <id>` печатает цепочку по `at`, `--aggregate <uuid>` — патчи по версиям (критерии spec 5, 6).

## Фаза 3: dmg-core — документы и релиз (критерий 8) [checkpoint: d288265]

- [x] Task: S (`documentarian` — аудит; правка — O) [dmg-core f0e38fa, 962046a] — D-86 в `docs/decisions.md` (снять оговорку D-73; baseline по ссылке; пометка `F.sensitive` и маскирование всей записи — `OperationRun` и UoW; порог в Jsonl); новый `docs/reference/oplog.md`; правки `guides/use-case.md`, `guides/app.md`, `llms.txt`, `docs/index.md`, `CHANGELOG`; `bun run docs:impact`
- [x] Task: O — релиз по `RELEASING.md` [v0.3.0 = 962046a] (minor: новое поле публичного `AggregateWrite` и опция Def), тег и SHA — в `summary.md`
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

**Критерии:** `bun run check` (включая `docs:covers`, `docs:jsdoc`) зелёный; аудит `documentarian` без расхождений; D-86 есть, `reference/oplog.md` в `llms.txt`; тег создан.

## Фаза 4: u7-school — разметка и подключение (ФТ-6, критерии 7, 8)

- [x] Task: S (`dmg-data-keeper`) — аудит ПД: VO `student` (`abandonDetails`, `completionDetails`, `notices`), `ownerInfo` анкеты; схемы входа и выхода UC, payload событий и ошибок, собранные не из помеченных state/VO (вход регистрации пользователя и др.) — итоговый список мест для `F.sensitive`; совместимость: чтение старых файлов `data/oplog/` новым читателем. Живые `data/` не трогать
- [x] Task: S (`dmg-test-designer`) — red-тесты: пометки покрывают список аудита; прогон операций на фикстурах — в строках лога нет имён и Telegram ID; `u7-app` — `retainDays: 90`; `bun run oplog` на `DB_DIR=./data/fixtures`; проверить точные `toEqual` по записи лога в `u7-app*.test.ts` и UC-тестах `writes`
    - [x] Запуск — падают по делу
- [x] Task: S (`dmg-domain-author`) [119f3e6c, 08343f47] — обновить тег `dmg-core` (`package.json`, `bun.lock`); `F.sensitive` в state/VO user, questionnaire, review, stream, student и в схемах операций по аудиту; `retainDays: 90` в `platform/app/src/u7-app.ts`; `scripts/oplog.ts` + `"oplog"` в `package.json` (по `DB_DIR/oplog`)
- [x] Task: O — документы [08343f47]: `docs/backup.md` (oplog вне бэкапа, срок 90 дней, чтение; предупреждение — удаление при смене дня), раздел данных `AGENTS.md`, `conductor/architecture/index.md`; удалить заготовку `roadmap/oplog-state-patch.md`, снять кандидата F-111 в `tracks.md`
- [x] Task: S (`dmg-reviewer`) — финальное ревью diff трека [08343f47]
- [x] Task: O — гейт закрытия (workflow.md): `CI=true bun test`, триаж красных, сравнение с базовой линией Ф0 — в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

**Критерии:** `bun run check` u7-school зелёный, тестов не меньше базовой линии; `DB_DIR=./data/fixtures bun run oplog --request <id>` выдаёт ленту; все места аудита помечены, в логе фикстур нет ПД; `package.json` на новом теге; заготовка удалена, новый кандидат заведён.

---

## Покрытие spec

| Критерий spec | Фаза |
|---|---|
| 1 — `changes` у command, нет у query | 1 |
| 2 — маскирование всей записи | 1 (механика), 4 (разметка) |
| 3 — пометка в производных схемах, виды схем | 1 |
| 4 — `{ size, hash }` | 1 |
| 5 — `retainDays` | 2 |
| 6 — CLI, фильтры, старые записи | 2 |
| 7 — u7-school: разметка, `bun run oplog` | 4 |
| 8 — D-86, документы, тег, u7-school на нём | 3, 4 |
| НФР — без зависимостей, сбой патча, объём | 1 |

## Риски

- **Стоимость сравнения** на крупных снимках (`stream.contentSnapshot`) — замер в Ф1, при необходимости порог размера сравнения.
- **Объём лога** — массивы пишутся листом (`answers` анкеты — под `redacted`); сравнить с замером Ф0.
- **`retainDays` удаляет файлы** — тесты только во временном каталоге; сейчас самые старые файлы `data/oplog` — от 2026-11-11, первый запуск ничего не удалит.
- **Схемы, собранные заново из `entries`**, теряют обёртку, но не пометку поля — проверить тестом; ручные схемы выхода без пометки — закрывает аудит Ф4.
- **Размер трека** вырос (маскирование всей записи); если Ф1 не укладывается в сессию — делить на Ф1а (патч) и Ф1б (маскирование).
