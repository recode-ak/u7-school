# План: обновление контента идущего потока (F-80)

> Spec — [spec.md](./spec.md). Исполнители: **O** — Opus (orchestrator), **S** — Sonnet (роли `conductor/architecture/agents.md` §4). Порядок строго Ф0 → Ф1 → Ф2 → Ф3: UC опираются на домен, скрипт — на UC. Одна фаза — одна сессия.

> **Режим (Нурболат, 2026-11-15):** трек целиком в одной сессии-оркестраторе, шаги — свежие субагенты; ручная верификация фаз заменена автоматическими проверками, остановка — только на стратегических вопросах.

---

## Фаза 0: Базовая линия [checkpoint: 204521f]

- [x] Task: O — прогнать `CI=true bun run check` и `bun run test:bot`, записать числа (pass/fail, число тестов) в `summary.md`
- [x] Task: O — список сценариев `scripts/stream-snapshot-sync.test.ts` (11) в `summary.md` — основа таблицы переноса (TST-08)
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (автопроверка, режим трека) (Protocol in workflow.md)

**Критерии:** числа базовой линии и список старых сценариев — в `summary.md`.

## Фаза 1: Домен — сравнение снимков и операции Ar

- [ ] Task: S (`dmg-tech-lead`) — бриф среза `slices/domain.md`: `SnapshotDiffDqs` (сравнение двух `ContentSnapshot` по позициям — заголовки, добавленные, удалённые, переставленные, перенесённые между уроками/проектами; агрегатов не знает); `StreamContentSyncDcs(stream, students)` — `plan(newSnapshot)` (отчёт, причины отказа) и `apply(...)`; таблица исходов для нетривиальных случаев (студент `active` с завершённым последним шагом, `enrolled` без шагов, перенос шага в другой урок, удалён и добавлен под новым id); форма отчёта (список изменений по ключам, не полное «было → стало» шагов); ID `rules.md`
- [ ] Task: S (`dmg-test-designer`) — red-тесты: `snapshot-diff.dqs.test.ts`, `stream-content-sync.dcs.test.ts` (впереди / хвост / позади; удалён текущий шаг; терминальные не трогаются; статусы потока), `StudentAr.creditStep` (нет записи / `issued` / `completed` — идемпотентность, без событий, `currentStepId` не меняется), `StreamAr.replaceContent`/`canSyncContent`, `StudentProgressDqs` — помеченные шаги вне статистики времени
    - [ ] Тесты (red) → запуск, убедиться, что падают по делу
- [ ] Task: S (`dmg-domain-author`) — реализация: необязательное поле `completionSource: 'content_sync'` в `StepRecordVo`; `StudentAr.creditStep`; `StreamAr.replaceContent` + `canSyncContent` + событие `StreamEvents.contentSynced`; ошибки `CONTENT_NOT_SYNCABLE`, `SYNC_REMOVES_CURRENT_STEP`, `SYNC_NEEDS_CONFIRMATION` (вкл. устаревший список затронутых); `SnapshotDiffDqs`, `StreamContentSyncDcs`; исключение помеченных из `computeStepTimeStats`; экспорт из `domain/src/stream/index.ts`
    - [ ] Реализация (green) → `bun test domain/src/stream`
- [ ] Task: S (`dmg-reviewer`) — ревью домена по `rules.md`; замечания error/warn исправлены
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

**Критерии:** `bun test domain/src/stream` зелёный; покрыты все классы ФР-2, включая перестановку шага позади студента и перенос шага в другой урок/проект (spec 1); `creditStep` идемпотентен, без событий (spec 3); терминальные не меняются (spec 4); помеченные шаги вне статистики времени (spec 8а); прямой мутации `state.steps` вне Ar нет; `bun run check` зелёный.

## Фаза 2: UC модуля `stream` — предпросмотр и применение

- [ ] Task: S (`dmg-tech-lead`) — бриф среза `slices/uc.md`: Def `previewStreamContentSync` (query) и `syncStreamContent` (command) — `aggregate: StreamArDef`, `callers: ['user']`, `policy: StreamPolicy.rules.canManage`, `calls: [GetModuleSnapshotUcDef]` (образец — `create-stream.uc.ts`); вход применения — список затронутых студентов из предпросмотра; загрузка потока и студентов, регистрация в UoW: студенты первыми, поток последним, `expectVersion` потока (образец — `activate-stream.uc.ts`, ФР-8а)
- [ ] Task: S (`dmg-test-designer`) — red-тесты UC на фейк-репозиториях: статусы потока; удалён текущий шаг — отказ без записи; подтверждение отсутствует / устарело — отказ; конфликт version потока — отказ до записи; сбой посередине → повтор доводит до конца; Policy (ментор потока, админ, чужой ментор, студент); `writes` и событие `contentSynced`; повторное применение — без изменений
    - [ ] Тесты (red) → запуск
- [ ] Task: S (`dmg-api-author`) — Def в `domain/src/stream/stream/uc/`, реализации в `modules/stream/src/stream/uc/`, регистрация в модуле; обновить `stream.module.student.test.ts` (точный список UC: 19 → 21) и прочие точные списки UC/событий, если найдутся
    - [ ] Реализация (green) → `bun test modules/stream domain/src/stream`
- [ ] Task: S (`dmg-data-keeper`) — совместимость: живые `streams.json`/`students.json` читаются с новым необязательным полем, миграция не нужна; тесты `student.json-repo`
- [ ] Task: S (`dmg-reviewer`) — ревью среза; замечания error/warn исправлены
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

**Критерии:** `bun test modules/stream domain/src/stream` зелёный; тестами UC покрыты spec 2, 3, 5, 6; запись `writes` проверена (spec 7, на уровне UoW); прямой записи JSON в UC нет; отчёт `dmg-data-keeper` без блокеров; полный `bun run check` зелёный.

## Фаза 3: Скрипт, данные, документы

- [ ] Task: S (`dmg-api-author`) — `call-uc.ts`: добавить `StreamModuleDef` в `DMG_MODULES`, поправить шапку и `printHelp`
- [ ] Task: S (`dmg-api-author`) — переписать `scripts/update-stream-snapshot.ts` на `U7App` + `dispatch` от субъекта: выбор потока (`enrollment`/`active`) → предпросмотр → подтверждение (`prompt`) → применение; `--dry-run` — только предпросмотр; код отказа → понятное сообщение и выход 1. Общую сборку приложения со `_course-client.ts`/`call-uc.ts` — вынести в `scripts/_app.ts`, если упрощает (решение в задаче)
- [ ] Task: S — удалить `scripts/stream-snapshot-sync.ts` и его тест; таблица переноса сценариев (перенесён / заменён новой логикой / отпал и почему) — в `summary.md` (spec 8)
- [ ] Task: S (`dmg-data-keeper`) — копия `data/` в scratchpad, `DB_DIR` на копию: сухой прогон (`--dry-run`) и применение на реальном потоке; в `data/oplog/` копии — запись с `writes`. **Живые `data/` не трогать**
- [ ] Task: O — документы: `conductor/debt/code.md` (записи про `stream-snapshot-sync` / «Погашает: F-80» — закрыть), `conductor/roadmap/stream-snapshot-dmg.md` (удалить, ссылки снять, запись-кандидат в `tracks.md`), `AGENTS.md` (описание `update-stream-snapshot.ts`), `content-management.md` («Есть сейчас», порядок работ п. 2); в `conductor/roadmap/oplog-state-patch.md` — пример: замена снимка как крупный патч (вход F-111)
- [ ] Task: S (`dmg-reviewer`) — финальное ревью diff трека
- [ ] Task: O — гейт закрытия (workflow.md): `CI=true bun test`, триаж красных, сравнение с базовой линией Ф0 — в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

**Критерии:** `scripts/stream-snapshot-sync*` нет; в `scripts/` нет прямой записи `streams.json`/`students.json` (spec 8); сухой прогон и применение на копии отработали, в oplog копии — `writes` (spec 7, 9); grep `stream-snapshot-sync` вне `archive/` пуст; `bun run check` зелёный, тестов не меньше базовой линии за вычетом перенесённых (spec 10).

---

## Покрытие spec

| Критерий spec | Фаза |
|---|---|
| 1 — классы ФР-2, перестановка, перенос | 1 |
| 2 — completed/archived; удалён текущий шаг | 1 (DCS), 2 (UC без записи) |
| 3 — пометка, без событий, идемпотентность | 1, 2 |
| 4 — терминальные не меняются | 1, 2 |
| 5 — version, сбой посередине, подтверждение | 2 |
| 6 — Policy | 2 |
| 7 — oplog `writes` | 2, 3 |
| 8 — нет записи в `scripts/`, таблица переноса | 3 |
| 8а — статистика времени | 1 |
| 9 — data-keeper, сухой прогон | 2, 3 |
| 10 — `check`, число тестов | 1, 2, 3 |

## Риски

1. **Неатомарность UoW** — окно частичной записи студентов при сбое; смягчено порядком записи и идемпотентностью (ФР-8а); скрипт напоминает остановить бота.
2. **Нетривиальные позиции** (завершённый последний шаг, `enrolled` без шагов, удалён + добавлен под новым id) — таблица исходов в брифе Ф1, тест на каждый.
3. **Точные списки UC в тестах** — после Ф2 полный `bun test`, не только каталоги среза.
4. **Размер отчёта предпросмотра** в Def-схеме — список изменений по ключам.
