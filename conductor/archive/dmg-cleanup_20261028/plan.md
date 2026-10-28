# Plan: dmg-cleanup_20261028

Каждая задача — TDD (red → запуск → green, по шагам). Правки пакета — коммит в `~/dev/tools/dmg/dmg-core` (зелёные `check` и `e2e`), затем в u7-school `bun install` (+ `dmg:sync`/`agents:sync` при изменении доставляемых документов), `check`, коммит с SHA пакета. Данные `data/` не трогаем; пушей и деплоя нет.

## Фаза 0: Базовая линия [checkpoint: db8d6a26]

- [x] Task: Зафиксировать базовую линию (`bun test` pass/fail в u7-school и в пакете, `bun run e2e` пакета) в черновике `summary.md` 57af7441
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Параллельная разработка платформы [checkpoint: 9c108539]

- [x] Task: `AGENTS.md`, `conductor/architecture/agents.md`, `index.md` §«Правка платформы» — `dmg-core` (и будущий `dmg-ui`) развиваются параллельно, агенты правят репо пакета 29710115
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Тесты прикладного уровня на фейках (dmg-core) [checkpoint: f179b4e1]

- [x] Task: `MemoryRepo<A>` в `dmg-core/testing` 5620b60 (dmg-core da9e9a6)
    - [x] Тесты: round trip, конфликт версии, `seed`, записанное, `failOn`, заданный ответ `find*`; red
    - [x] Реализация, экспорт; green
- [x] Task: Перевод тестов UC примера (`create`/`complete`/`assign`/`get`/`list` задач, `get-user`); сверка сценариев старых и новых тестов 73deffde (dmg-core 7a559c2)
- [x] Task: Перевод тестов ER и Job примера (`FailingRepo` → `failOn`) a176dfa8 (dmg-core 1df1d03)
- [x] Task: Шаблон теста UC в `gen` на фейке; тесты генератора и `consumer-e2e` зелёные 5253a4f0 (dmg-core f61a212)
- [x] Task: Документация: `testing.md` §4 (пирамида), гайды `use-case`, `event-reaction`, `job`, `module`, `repo`, `llms.txt` e7eb3bf8 (dmg-core a32f3e4)
- [x] Task: u7-school — `bun install`, `dmg:sync`/`agents:sync`; запись в debt: тесты UC переводятся на фейк по мере касания ab658e4c
- [x] Task: Ревью reviewer cf8169fd (dmg-core 3b9d7cd)
- [x] Task: Решение D-55 в `decisions.md` пакета: `MemoryRepo`, `<a>.repo.fake.ts`, TST-07 (по ревью, согласовано с Нурболатом) (dmg-core f8fb202)
- [x] Task: TST-07 — lint: рабочий код не импортирует `*.repo.fake` и `dmg-core/testing` (`LintMap`, `biome.json` пакета, `rules.md`); переименовать тест ER «…файл не создан» a52a7371 (dmg-core d448dd5)
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Отсев повторов command UC (DEBT-1 dmg-core) [checkpoint: d6e96450]

- [x] Task: Решение D-56 в `decisions.md` пакета: ключ (`caller` + `requestId`), сравнение входа, TTL, `REQUEST_CONFLICT`, признак серверного `requestId`; обсудить с Нурболатом (dmg-core 00fe6c8)
- [x] Task: Признак серверного `requestId` в `Trace` (`fromRequest` без `requestId`); тесты red → green (dmg-core 783a9fd)
- [x] Task: Порт `ReplayStore` + реализация в памяти с TTL в `dmg-core/app`; тесты red → green; u7-school — `InProcReplayStore` до Фазы 4 (dmg-core 31a9c0a)
- [x] Task: Отсев в `dispatch` (dmg-core 7e4bea1)
    - [x] Тесты: повтор → сохранённый ответ без исполнения; другой вход → `REQUEST_CONFLICT`; query и серверный `requestId` — без отсева; истёкший TTL; red
    - [x] Реализация, подключение хранилища (`AppContext`/`ApiApp`), учебное приложение; green
- [x] Task: `transport.md` §2; снять DEBT-1 (`debt.md` и маркер) (dmg-core 7e4bea1)
- [x] Task: Ревью reviewer; правки по ревью (dmg-core c949ba0)
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: `requestId` из `update_id` (u7-school, DEBT-38) [checkpoint: c424efe1]

- [x] Task: Контекст запроса: транспорт кладёт `update_id`, `dispatchUc` — `requestId = tg:<update_id>#<n>`, `correlationId = tg:<update_id>`, без `warn`; тесты stories и транспорта red → green 8ff646cc
- [x] Task: Файловый `ReplayStore` в `data/replay/` (TTL, очистка просроченного); тесты на временном каталоге red → green; подключение в раннере 4455d890
- [x] Task: `AGENTS.md` (незащищённые данные), `docs/backup.md`, `.gitignore` 2ae78429
- [x] Task: e2e: повтор апдейта — UC не исполнен повторно; два UC одного апдейта — общий `correlationId` 3a6fc630
- [x] Task: Снять DEBT-38; новый долг — контракт story в `dmg-ui` несёт id запроса явно (DEBT-41) b8b50fd0
- [x] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Показ ошибок DMG в боте (DEBT-37) [checkpoint: b590e99c]

- [x] Task: `ucErrorNotify` по `kind` и тексту из Def без `toLegacyError`; тесты red → green; снять DEBT-37 b6294f91
- [x] Task: Ревью reviewer 15e6f0db
- [x] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

## Фаза 6: Финал [checkpoint: 4a153d43]

- [x] Task: Гейт качества (workflow.md): полный прогон, сверка с базовой линией; `summary.md` c6942521
- [x] Task: Удалить `roadmap/bot-request-id.md`, снять `[?]` в `tracks.md`, обновить `roadmap.md` 820e499f
- [x] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)
