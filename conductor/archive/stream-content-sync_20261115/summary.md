# Итог: обновление контента идущего потока (F-80)

**Цель:** ментор потока или админ приводит идущий поток к текущей опубликованной версии модуля без потери прогресса студентов: предпросмотр → подтверждение → применение одной операцией UoW. Заменяет временные скрипты прямой записи JSON.

## Сделано

- **Ф1, домен** (`d55b90c`): `SnapshotDiffDqs` (сравнение снимков по позициям — заголовки, добавленные, удалённые, перенесённые; `shiftsAround` относительно текущего шага), `StreamContentSyncDcs` (`plan` — отчёт и блокеры, `apply` — проверки до мутаций), `StudentAr.creditStep` (пометка `completionSource: 'content_sync'`, без событий, идемпотентен), `StreamAr.canSyncContent`/`replaceContent`, событие `stream.stream.contentSynced`, ошибки `STREAM_CONTENT_NOT_SYNCABLE`, `STREAM_SYNC_REMOVES_CURRENT_STEP`, `STREAM_SYNC_NEEDS_CONFIRMATION`; схемы отчёта — `content-sync.types.ts`.
- **Ф2, UC** (`db8224e`): `previewStreamContentSync` (query: план + `streamVersion`) и `syncStreamContent` (command: `expectVersion` первым, студенты в UoW раньше потока, поток — только при изменении); модуль `stream` — 21 UC.
- **Ф3, скрипт и документы** (`14a3ba4`): `scripts/update-stream-snapshot.ts` на `U7App` + `dispatch` (`--dry-run`, отказ на неизвестных флагах), общая сборка `scripts/_app.ts`, `call-uc` видит `stream`; `stream-snapshot-sync.*` удалены; заготовка `roadmap/stream-snapshot-dmg.md` удалена, ссылки сняты; `AGENTS.md`, `content-management.md`, вход F-111 (`oplog-state-patch.md`), D-85.

## Ограничения

- Пройденный шаг, ушедший вперёд от студента, — только предупреждение: [D-DEBT-7](../../debt/product.md).
- UoW без отката: при сбое посередине часть студентов зачтена, снимок потока старый; повтор доводит (ФР-8а).
- Сценарий `sync` со студентами на реальных данных не прогонялся (на машине разработки их нет) — первый запуск на сервере: бот остановлен, `bun run backup`, `--dry-run`.
- Экрана в боте нет — будущий `dmg-ui`.

## Базовая линия (Ф0, 2026-11-15, `544a1f6`)

| Прогон | Результат |
|---|---|
| `CI=true bun run check` | зелёный: 3291 pass / 0 fail, 320 файлов |
| `bun run test:bot` | 1232 pass / 0 fail, 111 файлов (подмножество `check`) |

## Таблица переноса сценариев `scripts/stream-snapshot-sync.test.ts` (11, TST-08)

| # | Сценарий | Судьба (Ф3) |
|---|---|---|
| 1 | `extractStepIds` извлекает упорядоченный список шагов | заменён: порядок обхода — `SnapshotDiffDqs` (`snapshot-diff.dqs.test.ts`) |
| 2 | `analyzeSnapshotDelta`: без изменений — конфликтов нет | перенесён: идентичные снимки → `changed=false`, `unchanged` (DQS, DCS, `StreamAr`) |
| 3 | `analyzeSnapshotDelta`: шаг добавлен в хвост после текущего — конфликта нет | перенесён: `tail`/`ahead` — строки 1, 4 таблицы исходов (`stream-content-sync.dcs.test.ts`) |
| 4 | `analyzeSnapshotDelta`: шаг добавлен позади текущего — конфликт | перенесён: `behind` → зачёт — строки 2, 7, 11 (DCS) |
| 5 | `analyzeSnapshotDelta`: `abandoned` игнорируется | перенесён: терминальные не затрагиваются (DCS) |
| 6 | `analyzeSnapshotDelta`: `advanced` считается опережающим | заменён намеренно (ФР-6): `advanced`/`not_advanced` больше не затрагиваются |
| 7 | `syncAheadStudents`: новые шаги — только опережающим | перенесён: `StudentAr.creditStep` + `apply` (DCS, UC) |
| 8 | `syncAheadStudents`: повторный вызов идемпотентен | перенесён: `already_credited`, повторный `apply`/UC без записи |
| 9 | запись студентов: legacy-запись и новый формат — `version` и числовые даты сохранены, репозиторий читает | отпал: скрипт не пишет файлы; совместимость формата — round-trip `completionSource` в `student.json-repo.test.ts` |
| 10 | битая запись — ошибка разбора до записи | отпал: разбор записей — репозиторий (`StudentArDef.state`) |
| 11 | битый `students.json` — отказ чтения, `streams.json` не изменён; нет файла — пустой список | отпал: то же; частичная запись — UoW, сценарий «сбой посередине» в `sync-stream-content.uc.test.ts` |

## Решения по ходу (Нурболат и orchestrator, 2026-11-15)

- Пройденный шаг, ушедший вперёд от студента, — предупреждение `completedAhead`, не отказ; пробел — [D-DEBT-7](../../debt/product.md).
- Зачтённые синхронизацией шаги вне статистики времени (`durationOf`) и последней активности (`lastActivityAt`, `neverStarted`).
- Хвост: студенту, завершившему последний шаг, добавленный шаг выдаёт `issueTail` (не зачёт).
- Подтверждение: `affected ⊆ confirmed` — повтор после сбоя посередине с тем же списком доводит обновление.
- Def UC вошли в коммит Ф1: событие `contentSynced` без публикующего UC не проходит `arch:check` (MAN-06).

## Проверка на данных (Ф3)

- Живых `streams`/`students` на машине разработки нет — проверка на копии `data/fixtures` (scratchpad): разбор фикстур схемой — 5/5 записей; переименован урок модуля → `--dry-run` показал `~ урок`, данные не изменены; применение (`replace`) → в `oplog` копии запись `syncStreamContent` с `writes: [stream 0→1]` и событием `contentSynced`; повтор — «Контент не изменился».
- Поток `active` со студентами в фикстурах отсутствует — сценарий `sync` проверен тестами UC (зачёт, порядок `writes`, сбой посередине).
- **Перед первым применением на сервере:** остановить бота, `bun run backup`, сначала `--dry-run`.

## Гейт закрытия (Ф3)

| Прогон | Результат |
|---|---|
| `CI=true bun run check` | зелёный |
| `CI=true bun test` | 3420 pass / 0 fail, 324 файла (базовая линия 3291; −11 перенесённых сценариев `stream-snapshot-sync.test.ts`) |

Красных нет: промежуточных состояний и регрессов нет. Grep `stream-snapshot-sync` вне `conductor/archive/` и папки трека пуст.
