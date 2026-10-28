# Plan: dmg-cleanup_20261028

Каждая задача — TDD (red → запуск → green, по шагам). Правки пакета — коммит в `~/dev/tools/dmg/dmg-core` (зелёные `check` и `e2e`), затем в u7-school `bun install` (+ `dmg:sync`/`agents:sync` при изменении доставляемых документов), `check`, коммит с SHA пакета. Данные `data/` не трогаем; пушей и деплоя нет.

## Фаза 0: Базовая линия

- [x] Task: Зафиксировать базовую линию (`bun test` pass/fail в u7-school и в пакете, `bun run e2e` пакета) в черновике `summary.md` 57af7441
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Параллельная разработка платформы

- [ ] Task: `AGENTS.md`, `conductor/architecture/agents.md`, `index.md` §«Правка платформы» — `dmg-core` (и будущий `dmg-ui`) развиваются параллельно, агенты правят репо пакета
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Тесты прикладного уровня на фейках (dmg-core)

- [ ] Task: `MemoryRepo<A>` в `dmg-core/testing`
    - [ ] Тесты: round trip, конфликт версии, `seed`, записанное, `failOn`, заданный ответ `find*`; red
    - [ ] Реализация, экспорт; green
- [ ] Task: Перевод тестов UC примера (`create`/`complete`/`assign`/`get`/`list` задач, `get-user`); сверка сценариев старых и новых тестов
- [ ] Task: Перевод тестов ER и Job примера (`FailingRepo` → `failOn`)
- [ ] Task: Шаблон теста UC в `gen` на фейке; тесты генератора и `consumer-e2e` зелёные
- [ ] Task: Документация: `testing.md` §4 (пирамида), гайды `use-case`, `event-reaction`, `job`, `module`, `repo`, `llms.txt`
- [ ] Task: u7-school — `bun install`, `dmg:sync`/`agents:sync`; запись в debt: тесты UC переводятся на фейк по мере касания
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Отсев повторов command UC (DEBT-1 dmg-core)

- [ ] Task: Решение D-NN в `decisions.md` пакета: ключ (`caller` + `requestId`), сравнение входа, TTL, `REQUEST_CONFLICT`, признак серверного `requestId`; обсудить с Нурболатом
- [ ] Task: Признак серверного `requestId` в `Trace` (`fromRequest` без `requestId`); тесты red → green
- [ ] Task: Порт `ReplayStore` + реализация в памяти с TTL в `dmg-core/app`; тесты red → green
- [ ] Task: Отсев в `dispatch`
    - [ ] Тесты: повтор → сохранённый ответ без исполнения; другой вход → `REQUEST_CONFLICT`; query и серверный `requestId` — без отсева; истёкший TTL; red
    - [ ] Реализация, подключение хранилища (`AppContext`/`ApiApp`), учебное приложение; green
- [ ] Task: `transport.md` §2; снять DEBT-1 (`debt.md` и маркер)
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: `requestId` из `update_id` (u7-school, DEBT-38)

- [ ] Task: Контекст запроса: транспорт кладёт `update_id`, `dispatchUc` — `requestId = tg:<update_id>#<n>`, `correlationId = tg:<update_id>`, без `warn`; тесты stories и транспорта red → green
- [ ] Task: Файловый `ReplayStore` в `data/replay/` (TTL, очистка просроченного); тесты на временном каталоге red → green; подключение в раннере
- [ ] Task: `AGENTS.md` (незащищённые данные), `docs/backup.md`, `.gitignore`
- [ ] Task: e2e: повтор апдейта — UC не исполнен повторно; два UC одного апдейта — общий `correlationId`
- [ ] Task: Снять DEBT-38; новый долг — контракт story в `dmg-ui` несёт id запроса явно
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Показ ошибок DMG в боте (DEBT-37)

- [ ] Task: `ucErrorNotify` по `kind` и тексту из Def без `toLegacyError`; тесты red → green; снять DEBT-37
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

## Фаза 6: Финал

- [ ] Task: Гейт качества (workflow.md): полный прогон, сверка с базовой линией; `summary.md`
- [ ] Task: Удалить `roadmap/bot-request-id.md`, снять `[?]` в `tracks.md`, обновить `roadmap.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)
