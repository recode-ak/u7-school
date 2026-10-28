# Срез: отсев повторов command UC (`ReplayStore`, D-56)

Трек: [dmg-cleanup_20261028](../plan.md), Фаза 3. Спецификация — [spec.md](../spec.md) ФР-3. Решение — **D-56** в `docs/decisions.md` пакета (прочитай целиком до начала работы), правило — `docs/transport.md` §2, долг — DEBT-1 в `debt.md` пакета.

## Где работать

- Репо пакета: `~/dev/tools/dmg/dmg-core` (не `node_modules/dmg-core` в u7-school).
- Не коммитить (коммит делает orchestrator после каждого шага).
- u7-school не трогать: подключение файлового хранилища — Фаза 4.

## Шаги (orchestrator вызывает по одному)

### Шаг 1. Признак серверного `requestId` в `Trace`

- `src/kernel/trace/trace.ts`: `Cause` `request` получает необязательное `generated?: true`; `Trace.fromRequest` без id клиента ставит его. Схема `TraceJsonSchema` и `toJSON`/`fromJSON` — с полем (без поля, если `generated` нет).
- Удобный вопрос к следу для `dispatch` — на усмотрение автора (например геттер `clientRequestId: string | undefined`), обосновать в отчёте.
- TDD: тесты `trace.test.ts` (id клиента — без признака; без id — с признаком; round trip JSON с признаком и без) → red → реализация → green.

### Шаг 2. Порт `ReplayStore` и `InProcReplayStore`

- Рядом с inbox (`src/app/events/inbox.ts` — образец стиля): порт и реализация в памяти в `src/app/` (место — по `naming.md`/`layers.md` пакета; предложи в отчёте). Экспорт из `dmg-core/app`.
- API (D-56): `claim(key, input)` — занимает ключ («в работе») или сообщает, что он уже есть: сохранённый ответ, «в работе» или другой вход; `complete(key, answer)` — сохраняет `Ok`; `release(key)` — снимает запись. Точные типы — на усмотрение автора, простые (feedback: без type-level трюков).
- `InProcReplayStore`: TTL (по умолчанию 24 ч) и ёмкость, время — из `Clock` (`AppContext.clock`, D-34), не `Date.now()`.
- `AppContext.replay: ReplayStore`; по умолчанию в `testAppContext` и учебном приложении — `InProcReplayStore`. Все места сборки `AppContext` в пакете (фикстуры, пример, шаблоны `gen`/`init`, если строят контекст) — обновить.
- TDD: тесты хранилища (занять → повтор того же входа «в работе»; `complete` → сохранённый ответ; другой вход; `release` → снова свободен; TTL истёк → свободен; ёмкость) → red → green.

### Шаг 3. Отсев в `dispatch`

- `src/app/module/module-from-def.ts` `dispatch` (маркер DEBT-1). Правила — D-56 дословно: только command UC, `cause.kind: 'request'` без `generated`, вызывающий не `system`, гость — только с `channel.visitorId`. Ключ — модуль + вызывающий + `requestId`; вход — канонический JSON `{ uc, input }` с отсортированными ключами.
- Новая ошибка ядра `REQUEST_CONFLICT` (`conflict`) в `src/kernel/errors/core-errors.ts`, payload `{ requestId, reason: 'input' | 'in_progress' }`; подмешивается к ошибкам UC так же, как остальные `CoreErrors` (проверь типы `UseCaseErrorOf`, `OPTIONS`-контракт, документацию ошибок).
- `Ok` → `complete`; `Err` (включая исключение UC) → `release`.
- TDD: тесты `dispatch` на учебном модуле: повтор → сохранённый ответ, UC не исполнен (проверка по фейку репозитория/счётчику); другой вход → `REQUEST_CONFLICT` `input`; параллельный повтор → `in_progress`; `Err` → повтор исполняется; query, серверный `requestId`, `system`, гость без `visitorId` — без отсева; истёкший TTL → исполняется снова. Red → green.
- Удалить маркер DEBT-1 и запись в `debt.md`; `docs/transport.md` §2 — сослаться на D-56, описать `REQUEST_CONFLICT`; `docs/errors-result.md` (если там перечислены базовые ошибки) и `llms.txt` — по необходимости.

## Правила

Применимые ID из `docs/rules.md` пакета проверь сам (ERR-* для новой ошибки, ARC-11 для границ подпутей, TST-* для тестов). ООП: классы с API и зоной ответственности; комментарии и JSDoc на русском, как в `inbox.ts`. Без новых зависимостей.

## Критерии приёмки

- На каждом шаге: тесты сначала red (вывод в отчёте), затем green; `bun run check` пакета зелёный, `bun run e2e` — после шага 3.
- В отчёте: API, решения на усмотрение, отклонения от брифа и почему.

## Отчёт автора

api-author (Opus), 2026-10-28. Пакет `dmg-core` `00fe6c8..7e4bea1`.

- **Шаг 1** (`783a9fd`): `Cause` `request` — `generated?: true`, схема JSON с полем; геттер `Trace.clientRequestId` — единственный вопрос `dispatch` к следу. Red 5 fail → green; `check` 1281 pass.
- **Шаг 2** (`31a9c0a`): `src/app/replay/replay-store.ts` — `ReplayStore` (`claim(key, input)` → `claimed | answered | conflict(reason)`, `complete`, `release`), `InProcReplayStore` (`clock`, TTL 24 ч от последней записи, ёмкость 10 000). `AppContext.replay` — `testAppContext`, учебное приложение, шаблон `init`. Red 11 fail → green; `check` 1292 pass, `e2e` ok. В u7-school `InProcReplayStore` подключил orchestrator (`e19b7d2f`).
- **Шаг 3** (`7e4bea1`): `src/app/replay/command-replay.ts` — `CommandReplay` (не экспортируется), `dispatch` идёт через него; `REQUEST_CONFLICT` в `CoreErrors`; DEBT-1 снят; `transport.md` §2, `errors-result.md`, `caller.md` п. 5. Red 7 fail → green; `check` 1305 pass, `e2e` ok.
- **Отклонения шага 3:** тесты `api-app`, `example-app`, `todo.module` слали разные команды с одним `requestId` — теперь `req()` на вызов; ключ гостя включает имя канала; сбой хранилища — `SERVER_INTERNAL`/`error` в логгер (ERR-07). Оба последних orchestrator внёс в D-56.

## Отчёт ревьюера

reviewer (Opus), 2026-10-28 — пакет `d448dd5..7e4bea1`, u7-school `43397831..ffcfa46b`. Блокеров (`error`) нет; D-56 и `transport.md` §2 соблюдены, прод не меняется (бот без id клиента, `call-uc.ts` — новый id на вызов). Решения — orchestrator (Нурболат разрешил на своё усмотрение), правки — dmg-core `c949ba0`.

| ID | файл | суть | severity | решение |
|---|---|---|---|---|
| — | `replay-store.ts` | атомарность `claim` не записана в порт | warn | JSDoc порта |
| — | `replay-store.ts`, `command-replay.ts` | поздний `complete`/`release` после TTL трогает чужую запись | question | токен владельца из `claim` |
| — | `replay-store.ts` | вытеснение по ёмкости снимает записи «в работе» | info | JSDoc |
| — | `command-replay.ts`, `replay-store.ts` | ответ хранится ссылкой; тип после JSON может разойтись с `O` | warn | `structuredClone`, контракт «JSON-совместим» |
| — | `replay-store.ts` | `forgetExpired` полагается на монотонные часы | info | JSDoc |
| TST-04 | `module-from-def.test.ts` | пять сценариев в одном тесте | info | разбит на пять |
| TST-05 | `module-from-def.test.ts` | не покрыты гость в разных каналах и сбой `release` | warn | тесты добавлены |
| — | `command-replay.ts` | недостижимое `?? ''` | info | убрано |
| — | `transport.md` §2 | нет правила «один `Trace` с id клиента — одна команда» | info | добавлено |
| ERR-07 | `command-replay.ts` | повтор и конфликт не видны в логах | question | `info` в логгер |
