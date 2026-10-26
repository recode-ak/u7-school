# Бриф: Фаза 4 — готовность к распределённому запуску (D-28)

Решения Нурболата (2026-10-26): [D-46](../../../architecture/decisions.md) (JSON `Caller`/`Trace`), [D-47](../../../architecture/decisions.md) (outbox и отсев повторов), правило [MAN-13](../../../architecture/rules.md) (один UoW — один модуль).

Базовая линия: `bun run check` зелёный, 3741 pass.

## Общие границы

- Платформа: `packages/dmg-core/src/**`. Публичная поверхность пакета меняется только так, как описано в шагах.
- Потребители правятся **механически**, чтобы компилировались и проходили тесты: `packages/core/src/legacy-bridge`, `packages/core/src/api/app/api-app.ts`, `packages/{wish,…}/src`, `apps/u7-bot/src`, шаблоны `scripts/gen`, учебный модуль `dmg-core/src/testing/example`.
- Не трогать: `conductor/`, `data/`, legacy-код модулей вне указанного в шаге.
- Применимые ID: ARC-01/02/10, MAN-05, MAN-06, MAN-13, ERR-07, CODE-*, TST-*.
- TDD: сначала тест, запуск (красный), затем реализация.

## Шаг 1 — круг через JSON (domain-author, платформа, Opus)

Файлы: `kernel/caller/caller.ts`, `kernel/trace/trace.ts` и их тесты; новый тест круга конверта и снапшота (`app/events/`, `domain/aggregate/`).

- `Caller.toJSON(): CallerJson` для всех четырёх видов: `guest`; `user` с `user: U` целиком; `delegate` с `principal`, `actor` (оба `U`), `delegationId`; `system` с `from` и необязательным `person` (вложенный `CallerJson` человека). Тип `CallerJson<U>` — размеченное объединение по `kind`; типы — в отдельном файле (`caller.types.ts`), если `caller.ts` разрастается.
- `Caller.fromJSON<U>(json, revive?: (raw: unknown) => U): Caller<U>`: восстанавливает тот же класс; без `revive` `U` берётся как есть. `system.person` восстанавливается как `PersonCaller` (не `SystemCaller` — матрёшки нет; JSON с `person.kind === 'system'` — ошибка `fromJSON`).
- `Trace.toJSON(): TraceJson` и `Trace.fromJSON(json)`: `cause`, `correlationId`, `channel` (без поля, если нет). Приватный конструктор остаётся, `fromJSON` — ещё одна фабрика.
- `toLog()` не меняется.
- Тесты: `JSON.parse(JSON.stringify(x.toJSON()))` → `fromJSON` → тот же класс (`instanceof`), те же `kind`, `subject()`, `person()`, `toLog()`, `toJSON()`; `revive` вызывается для каждого `U`. Конверт события (`EventEnvelope`) и `snapshot()` Ar учебного модуля проходят `JSON.parse(JSON.stringify(...))` с `toEqual` (без `undefined`-полей, `Timestamp` — число).
- Невалидный JSON на входе `fromJSON` — бросает `Error` с понятным текстом (это дефект транспорта, не доменная ошибка); схемы valibot — по усмотрению, если уже есть приём в ядре.

## Шаг 2 — outbox и inbox (domain-author, платформа, Opus)

- Порт `Outbox` в `AppContext` (рядом с `bus`): UoW после записи отдаёт конверты записанных агрегатов в outbox вместо `bus.publish`; порядок и семантика частичного сбоя (D-15) — как сейчас. In-proc реализация по умолчанию публикует в шину сразу.
- Порт `Inbox`: доставка в реакцию (`ReactionFromDef` / модуль) отсеивает повтор того же `eventId` для той же реакции. In-proc реализация по умолчанию (в памяти).
- `dmg-core/testing`: контрактный хелпер идемпотентности ER (событие доставлено дважды с разными `eventId` → второй прогон без новых записей и событий) + тест на учебном модуле.
- Механически — потребители `AppContext`.

## Шаг 3 — идемпотентность реальных ER (api-author, Sonnet)

Хелпер шага 2 — к каждому ER `wish`. Нарушения не чинить: список оркестратору (уйдут в DEBT).

## Шаг 4 — MAN-13 (domain-author, платформа, Opus)

- `checkDefs`: агрегаты операции (`aggregatesOf`) — только своего модуля; сообщение `MAN-13: <операция>: агрегат <fqn> модуля <x>`.
- UoW: `register` агрегата чужого модуля — нарушение (`violate`).
- Добавить `MAN-13` в `arch/violation.ts`.

## Шаг 5 — ARC-04 в `checkFiles`, DEBT-33 (domain-author, платформа, Opus; затем оркестратор — `scripts/`)

- Вход модуля для других задаёт приложение (параметр, по умолчанию `index`; у нас — `contract`).
- Прикладной слой внешнего модуля не проверяется (как обещает JSDoc) — найти, где цикл импортов его обходит.
- Домен в `ARCH_APPS`, `arch:check` чист, маркер DEBT-33 снят.

## Шаг 6 — снят

DEBT-1…26 переданы трекам перевода модулей (ответ на вопрос 1).

## Открытые вопросы

1. ✅ *Решено (Нурболат, 2026-10-26): долги — трекам перевода.* **DEBT-1, 6, 11, 16, 25** — legacy-модули домена импортируют legacy-базовые классы `@u7-scl/core` (`Aggregate`, `DomainEvent`, ошибки, `isoNow`). Погасить их можно только переводом модуля на Def, а в `dmg-core` legacy не попадёт. **DEBT-2, 7, 12, 17, 26** — тип `U7ModuleResolver` и `U7_SCHOOL_ID` из `app` в legacy-`module.ts`; эти файлы исчезнут при переводе модуля. Предложение: перенести эти десять долгов в треки перевода модулей; в Ф4 — только если Нурболат хочет перенести `U7ModuleResolver` (разрыв цикла `app ↔ domain`).

## Отчёты агентов

### Шаг 1 — domain-author (Opus), готово

- `kernel/caller/caller.types.ts` (новый): `Identified`, `CallerKind`, `OperationRef`, `CallerLog` + `CallerJson<U>` и виды; `caller.ts` реэкспортирует.
- `Caller.toJSON()` (узкий тип у каждого класса), `Caller.fromJSON(json, revive?)`, `ReviveSubject<U>`; вход проверяется valibot (`safeParse` + `summarize`, как в `aggregate.ts`), ошибка — `Error('Caller.fromJSON: …')`; `system.person` — только guest/user/delegate.
- `Trace.toJSON()`, `Trace.fromJSON(json)`, `TraceJson` (= `TraceLog`); `toLog()` делегирует `toJSON()`.
- Экспорт: `CallerJson`, `ReviveSubject` (корень), `TraceJson` (`/app`).
- Тесты: круг для 7 вариантов `Caller`, `Trace` (запрос с каналом и без, событие, Job), конверты UoW (`app/events/event-envelope.test.ts`), снапшот `TaskAr` (`domain/aggregate/snapshot-json.test.ts`).
- Отклонения: тесты конверта и снапшота зелёные сразу (свойство уже выполнялось — тест закрепляет); `toStrictEqual` вместо `toEqual` (ловит `undefined`-поля); без `revive` субъект проверяется на `uuid: string`; `JSON.stringify(caller)` теперь даёт форму `toJSON()` (лог операций пишет `toLog()` — не затронут).
- Открытый вопрос агента: экспорт вложенных JSON-типов (`UserCallerJson`…) из корня — пока нет (тактика оркестратора: по первому потребителю).
- Гейт оркестратора: `bun run check` — 3764 pass, 0 fail.

### Шаг 2 — domain-author (Opus), готово

- Порты: `app/events/outbox.ts` (`Outbox.put`, `InProcOutbox(bus)`), `app/events/inbox.ts` (`Delivery`, `Inbox.claim/release`, `InProcInbox({ capacity })`, `DEFAULT_INBOX_CAPACITY`); `AppContext.outbox`, `AppContext.inbox` обязательные.
- UoW: `bus` → `outbox`, партия конвертов записанных агрегатов, D-15 сохранён; сбой `put` — исключение, `published` пуст.
- `ReactionFromDef.handle`: `claim` → повтор `Ok` без лога операций (`debug`); не-`Ok` → `release`.
- `dmg-core/testing`: `expectIdempotentReaction({ event, deliver, published, state })` (вторая доставка с новым `eventId`: `Ok`, без новых конвертов, `state()` прежний); `testAppContext` собирает `InProcOutbox` + `InProcInbox`.
- Учебная ER `archive-removed-user-tasks` — тест хелпера.
- Механически: `apps/u7-bot/src/create-dmg-modules.ts`, `packages/core/src/legacy-bridge/example-app.test.ts`.
- Отклонения и открытые вопросы агента — решены оркестратором: TR-24.
- Гейт оркестратора: `bun run check` — 3782 pass, 0 fail.

### Шаг 3 — api-author (Sonnet), готово

- Блок «идемпотентность (D-47)» с `expectIdempotentReaction` в тестах 4 ER `packages/wish/src/wish/er/` (`state` — текст `wishes.json`).
- Идемпотентны: `abandon-wish`, `confirm-wish`, `fulfill-wish`. Не идемпотентен: `invite-wishers` (повторное `stream.created` снова публикует `wish.invited`) — `it.failing` + DEBT-35.
- Прод-код не менялся.

### Шаг 4 — domain-author (Opus), готово

- `checkDefs`: `checkOwnAggregates` — `MAN-13: ER alpha.addNote: агрегат beta.item модуля beta`; ветка MAN-06 «агрегат другого модуля» снята (без дубля), агрегат вне модулей — по-прежнему MAN-06.
- UoW: `UnitOfWorkContext.module?` (необязательное, как `emits`/`touches`), `register` → `assertOwnModule` до `assertTouches`; `OperationFromDef.createUow` передаёт модуль.
- Механически поправлены фикстуры, нарушавшие MAN-13: `operation-from-def.test.ts` (модуль `probe`), `use-case-from-def.test.ts`, `reaction-from-def.test.ts`, `core/legacy-bridge/legacy-job.test.ts`, `core/api/app/api-app-dmg.test.ts`.
- Реальный домен MAN-13 не нарушает: `arch:check` example 0, domain 0.
- Открытый вопрос агента (обязательность `module`): оставлено необязательным — тактика, TR-25.
- Гейт оркестратора: `bun run check` — 3792 pass, 0 fail; `arch:check` чист.

### Шаг 5 — domain-author (Opus), готово

- `checkFiles(index, layout, entry = 'index')`, `ArchApp.entry?`; импорт мимо входа не проверяется только между двумя `external`; прикладной слой внешнего модуля не сканируется (цикл импортов не учитывал `external` — причина 92 нарушений TR-23).
- Эскалация: с `entry: 'contract'` — 52 импорта чужого `index` из домена legacy-модулей (DEBT-34). Решение оркестратора — TR-26 (по D-45 «пары legacy — по долгу»).
- Проект: `DomainArch` (`scripts/domain-arch.ts`, `entry: 'contract'`) в `ARCH_APPS`; DEBT-33 погашен.
- Гейт оркестратора: `bun run check` — 3800 pass, 0 fail; `arch:check` чист.

### Ревью фазы — reviewer (Opus)

| ID | файл:строка | суть | severity |
|---|---|---|---|
| ERR-07 | `app/reaction/reaction-from-def.ts:63,71` | сбой `inbox.claim/release` выходит из `handle` исключением мимо `runLogged`; сбой `release` оставляет доставку занятой | question |
| D-15 | `app/uow/unit-of-work.ts:96-97` | сбой `outbox.put` в `finally` подменяет исключение сохранения | warn |
| TST-04 | `wish/er/invite-wishers.er.test.ts:432` | `it.failing` проходит при любом падении, не закрепляет суть нарушения | info |
| TST-04 | `testing/reaction-idempotency.test.ts:80` | два сценария в одном тесте | info |
| CODE-03 | `testing/reaction-idempotency.ts:14-15` | `state` фактически асинхронный, по типу не видно | info |
| CODE-03 | `kernel/trace/trace.ts:37` | `TraceJsonSchema` не связана с типами `Cause`/`TraceChannel` | info |
| D-46 | `kernel/caller/caller.ts:107` | результат `revive` без проверки `uuid`, исключение без префикса | info |
| CODE-01 | `app/uow/unit-of-work.ts:69`, `apps/u7-bot/src/create-dmg-modules.ts:48` | перенос JSDoc | info |

Вывод: блокеров нет, код соответствует D-46, D-47, MAN-13, TR-24/25/26. Решение оркестратора: все пункты — в правки (дешевле сейчас, платформа).

### Правки по ревью — domain-author (Opus), готово

1. ERR-07: сбой `claim` — путь сбоя операции (`SERVER_INTERNAL`, лог операций, `error`), реакция не исполняется, доставка не снимается (неизвестно, занята ли); сбой `release` — `error`, исходный результат.
2. D-15: `finally` убран; сбой `outbox.put` после не-`VersionConflict` — в `cause` исходного исключения (или `AggregateError`).
3. `state: () => unknown | Promise<unknown>`; тест разбит; тест асинхронного `state`.
4. `TraceJsonSchema` ↔ `TraceJson` — присваивания в обе стороны (удаление необязательного поля из схемы не ловится — без type-level трюков).
5. `revive` через `Caller.checked`: префикс `Caller.fromJSON:`, `cause`, проверка `uuid`.
6. `invite-wishers`: `it` + `rejects.toThrow('опубликовала событий')`, DEBT-35.
7. Перенос JSDoc.
- Гейт оркестратора: `bun run check` — 3808 pass, 0 fail; `arch:check` чист.
