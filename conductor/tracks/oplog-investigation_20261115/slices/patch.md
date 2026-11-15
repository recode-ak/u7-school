# Бриф среза: dmg-core / patch (F-111, Фаза 1)

Репо `~/dev/tools/dmg/dmg-core`, база — `72bdf0a`. Valibot 1.5.0. Черновик — `dmg-tech-lead`, принят orchestrator (тактические рекомендации приняты все).

## Границы

Правится только `dmg-core`. u7-school не трогаем (Ф4). Документы и D-86 — Ф3. Релиз и тег — Ф3.

| Файл | Что |
|---|---|
| `src/kernel/fields/fields.ts` | + `F.sensitive(schema)` в объект `F` |
| `src/kernel/schema/sensitive-mask.ts` (+ `.test.ts`) | новый класс `SensitiveMask` (kernel: только valibot и схема; используют `domain` и `app`) |
| `src/domain/aggregate/aggregate.ts` | + геттеры `baseline`, `current` (решение 2) |
| `src/app/oplog/field-diff.ts` (+ тест) | новый класс `FieldDiff`, тип `FieldChange` |
| `src/app/oplog/record-mask.ts` (+ тест) | новый класс `RecordMask`: из Def операции берёт схемы и маскирует запись |
| `src/app/oplog/operation-record.ts` | типы `ValueDigest`, `RedactedChange` (сам `AggregateWrite` — в `unit-of-work.ts`) |
| `src/app/oplog/operation-run.ts` | маскирование в `record()` |
| `src/app/oplog/jsonl-operation-log.ts` | опция `valueMaxBytes`, `ValueDigest`, порог на `changes[].from/to` |
| `src/app/uow/unit-of-work.ts` | `Committable.baseline?/current?`, `AggregateWrite.changes?`, расчёт в `commit`, `UnitOfWorkContext.warn?` |
| `src/app/operation/operation-from-def.ts` | `journal` строит `RecordMask` из `this.def`; `createUow` передаёт `warn` |
| `src/app/index.ts`, `src/index.ts` | экспорты (`ValueDigest`, `FieldChange`, `RedactedChange`, `SensitiveMask`) |
| `src/testing/example/**` | пометить `F.sensitive` поля example для тестов (решение 10) |

Не трогаем: сигнатуры `OperationLog`/`OperationFromDef.journal` для внешних вызывающих, репозитории, `package.json` (новых зависимостей нет, sha256 — `node:crypto`).

## Решения

1. **`F.sensitive`** — `v.pipe(schema, v.metadata({ sensitive: true }))`, возвращаемый тип сохраняет вывод схемы, без type-трюков. Единственный источник метки.
2. **Доступ UoW к состояниям (вар. A).** В `Aggregate` два публичных геттера: `baseline: Readonly<StateOf<D>> | undefined` и `current: Readonly<StateOf<D>>` (JSDoc: ссылка, не мутировать, для UoW и лога). Без копий: `mutate` строит `draft = structuredClone(current)` и присваивает новый объект. `FieldDiff` — в `app/oplog` (домен не знает про лог). В `Committable` оба поля необязательные: фейки тестов не ломаются; без `current` `changes` не пишется.
3. **Схема state для маскировки в UoW** — `repo.aggregate.state` в `register`; `Entry` получает поле `state`. Это уже обёртка `withEntityDefaults`.
4. **Порядок в `commit`:** `from = ar.storedVersion ?? null` → `await save()` → `changes = diff(ar.baseline, ar.current)` в `try/catch` → `ar.markStored()` → `written.push({…, changes})`. После `markStored` считать нельзя: он заменит `baseline`. Ошибка `save` — в `written` ничего (как сейчас).
5. **Сбой расчёта патча** — `changes` не добавляется, `warn` через `UnitOfWorkContext.warn?: (message: string) => void`; `createUow` передаёт `app.logger.warn(def.name, …)`.
6. **Листья `FieldDiff`.** Объекты по полям (путь через точку). Массив и примитив — лист. `BaseEntityFields` (`uuid`, `version`, `createdAt`, `updatedAt`) пропускаются. Равенство листа — собственная рекурсивная структурная функция. Созданный (`baseline` нет) → поля верхнего уровня, `from: undefined`.
7. **Чувствительный лист.** Поле помечено или в поддереве листа (массив VO, `record`) есть помеченное → `{ path, redacted: true }` без значений и хеша. `SensitiveMask` отдаёт `isSensitive(schema, path)` / `containsSensitive(schema)` (или эквивалент).
8. **Дайджест.** `ValueDigest = { digest: true, size, hash }`; `hash` — первые 12 hex sha256 от JSON. Порог — опция `valueMaxBytes` (по умолчанию 1024) в `JsonlOperationLog` рядом с `maxBytes`, внутренний класс `ValueLimit` как `SizeLimit`; применяется к `from`/`to` каждой записи `changes`. `redacted` не превращается в дайджест. Не путать с `TruncatedValue`.
9. **Маскирование записи** в `OperationRun.record()`: `RecordMask.of(def)` из `OperationFromDef.journal`; `OperationRun` получает его четвёртым необязательным параметром (по умолчанию — без маскирования).
   - UC: `input` — `def.input`; `output` — `def.output`; `payload` ошибки — по `code` из `def.errors` + `CoreErrors`.
   - ER: `input` — конверт события; маскируется **только `event.payload`** схемой события из `def.on` по `event.name`. Выход ER и Job схем не имеет — не маскируется (поправка spec).
   - Job: `input` — `null`.
   - `changes` маскирует UoW.
   - Сбой маскирования — значение целиком `'[redacted]'` + `warn`.
   - Ошибка с кодом вне `def.errors`/`CoreErrors` (вложенный вызов) и непустым payload → payload целиком `'[redacted]'`.
10. **Образец в example:** пометить `F.sensitive` одно-два поля (например, `title` задачи; поле в payload события и ошибки — `task.events.ts`, `user.errors.ts`), чтобы покрыть вход UC, вход ER, payload ошибки, выход из state, `changes`.
11. **Обход по `kind`** valibot: `object`/`loose_object`/`strict_object`/`object_with_rest` (`entries`), `array` (`item`), `tuple`, `optional`/`nullable`/`nullish`/`exact_optional`/`undefinedable` (`wrapped`), `record` (`value`), `variant`/`union` (`options`: пометка хотя бы в одной ветке), `pipe` (проверять **все** элементы `pipe` на `metadata.sensitive`). Неизвестный `kind` внутри, где может быть помеченное (`lazy` и т. п.) → значение целиком `'[redacted]'` + `warn`. Поля вне схемы — как есть. `withEntityDefaults` сохраняет `kind` и `entries` — только тест.

## Шаги

**dmg-test-designer** — red-тесты:
- `aggregate.test.ts`: `baseline` — `undefined` у `create`; равен state при `restore`; после мутации прежний, `current` новый; после `markStored` равен `current`.
- `field-diff.test.ts`: объекты по точке; массив и примитив — лист; `from: undefined` у созданного; пропуск `BaseEntityFields`; одинаковые листы не пишутся; помеченный лист (в т. ч. массив VO с помеченным полем) — `redacted: true` без значений.
- `sensitive-mask.test.ts`: каждый `kind` п. 11; пометка в производной схеме (`v.pick`/spread entries state и VO); `withEntityDefaults`; лишние ключи как есть; сбой — `'[redacted]'`.
- `record-mask` / `use-case-from-def.test.ts` / `reaction-from-def.test.ts`: в строке JSONL нет значений помеченных полей (тест ищет само значение) во `input` UC, payload ER, `output`, `payload` ошибки; `changes` помеченного — `redacted: true`. Сквозной — по одному, детали — на уровне `SensitiveMask`/`RecordMask` (TST-08).
- `unit-of-work.test.ts`: `changes` у команды, у query нет; сбой расчёта не ломает `commit` и даёт `warn`; запись без `changes` принимается типом.
- `jsonl-operation-log.test.ts`: значение > порога — `{digest, size, hash}`; одинаковые значения — одинаковый hash; порог настраивается; `redacted` не дайджест.
- Запуск: падают по делу.

**dmg-domain-author** — реализация (green). Порядок: `F.sensitive` + `SensitiveMask` → `Aggregate.baseline/current` → `FieldDiff` → UoW → `RecordMask` + `OperationRun` → `JsonlOperationLog`. Замер стоимости `FieldDiff` на дереве типа `contentSnapshot` (сотни КБ JSON) — время в отчёт; при дороговизне — порог размера сравнения (лист крупнее порога — без разбора, дайджест). Экспорты.

**dmg-reviewer** — по разделу «Правила».

## Было → станет

| Точка | Было | Станет |
|---|---|---|
| `Aggregate` | `stored`, `current`, базы для diff нет | `private base`: в конструкторе при `restore`, в `markStored()`; `create` → `undefined`. Геттеры `baseline`, `current` |
| `Committable` | uuid, version, storedVersion, pullEvents, markStored | + `baseline?`, `current?` |
| `AggregateWrite` | `{aggregate, uuid, from, to}` | + `changes?: readonly (FieldChange \| RedactedChange)[]`; `FieldChange = {path, from, to}`, `from/to` — значение или `ValueDigest`; `RedactedChange = {path, redacted: true}` |
| `UnitOfWork.commit` | `written.push` после `markStored` | diff между `save` и `markStored`; у query нет |
| `UnitOfWorkContext` | `onViolation?` | + `warn?` |
| `OperationRun.record` | `input` как есть, `error` как есть | `input`/`output`/`payload` через `RecordMask`; `writes` уже замаскированы UoW |
| `OperationFromDef.journal` | `new OperationRun(ref, now, call, output)` | + `RecordMask.of(this.def)` |
| `JsonlOperationLog.limited` | `input`/`output`/`payload` через `SizeLimit` | + `writes[].changes[]`: `ValueLimit` по `from`/`to` |
| `F` | uuid, timestamp, string, int, boolean, picklist, expectedVersion | + `sensitive` |

## Сохраняемое поведение

- Ветки и тексты ошибок UC без изменений; `input` пишется «как пришёл» (до схемы), только маскируется.
- `result.size` у query — по немаскированному выходу.
- Порядок `save → markStored → send(outbox)` и `from = storedVersion ?? null` не меняется.
- Сбой лога и расчёта патча не ломает операцию.
- Тесты с `toEqual` по `writes` (могут упасть от `changes`): `src/app/use-case/use-case-from-def.test.ts` (~865), `src/app/reaction/reaction-from-def.test.ts` (~201), `src/app/job/job-from-def.test.ts` (~164), `src/app/uow/unit-of-work.test.ts`. Перед работой — `grep -rn "writes" src --include=*.test.ts`. Правка этих ожиданий под `changes` — разрешена в рамках среза.

## Ловушки

1. `v.pipe(v.pipe(x, …), …)` — метка может быть в любом элементе `pipe`.
2. Схема, собранная заново из `entries`, теряет обёртку `withEntityDefaults`, но не пометки полей — тест.
3. `parseOutput` применяет `transform` (`F.timestamp`): маскирование по форме выхода; отметить в JSDoc `SensitiveMask`.
4. Вход ER — конверт события (`name`, `eventId`, `payload`, `trace`…): маскировать только `payload`.
5. Ошибка вложенного вызова — код может быть не из `def.errors` (решение 9).
6. `JSON.stringify` теряет `undefined`: `from: undefined` пропадёт в JSONL — ожидаемо, отметить в типе.
7. DOM-17: `baseline`/`current` — публичные геттеры, не `snapshot()`.
8. Diff линейный по размеру state — замер.
9. Слои `ArchChecker`: `kernel` не импортирует `app`/`domain`.
10. Маскирование ровно один раз — в `OperationRun`; `JsonlOperationLog` схем не знает.

## Расхождения spec с кодом (поправки spec — в Ф3 вместе с D-86)

1. ФТ-1: кроме `baseline` нужен `current` (решение 2).
2. ФТ-2: вход ER — конверт, маскируется только `payload`.
3. ФТ-2: схем выхода у ER и Job нет — маскируется выход UC.
4. ФТ-1: у UoW нет логгера — поле `warn`.
5. ФТ-2: payload ошибки ищется по `code`; неизвестный код — целиком `'[redacted]'`.
6. ФТ-3: `SizeLimit` внутренний — `ValueLimit` рядом.
7. `AggregateWrite` объявлен в `unit-of-work.ts`.

## Правила (ID rules.md)

DOM-17, DOM-11 (`F.sensitive` — в `F`), CODE-02, CODE-04 (комментарии: порядок save→diff→markStored, «лист redacted без хеша»), TST-05, TST-06, TST-07, TST-08, слои ARC (`kernel` не знает `app`), D-43/D-73 (оговорку снимает D-86 в Ф3).

## Критерии приёмки

- `bun run check` dmg-core зелёный, тестов не меньше 1504.
- Критерий spec 1: команда, изменившая поле, — `writes[].changes` `{path, from, to}`; у query нет.
- Критерий 2 (механика): помеченные поля во `input` UC, payload ER, `output`, `payload` ошибки — `'[redacted]'`; значения нет в строке JSONL; `changes` помеченного — `{path, redacted: true}`.
- Критерий 3: пометка в производных схемах; обход видов схем и `withEntityDefaults`; лишние ключи как есть; сбой → `'[redacted]'`.
- Критерий 4: значение больше порога — `ValueDigest`; одинаковые — одинаковый hash; порог — опция.
- Запись без `changes` принимается типом; `Committable` без `baseline/current` работает.
- `git diff package.json` пуст; замер стоимости `FieldDiff` — в отчёте.
- `bun run e2e` зелёный.

## Отчёты

### dmg-test-designer (2026-11-15)

Red-тесты: новые `src/kernel/schema/sensitive-mask.test.ts`, `src/app/oplog/field-diff.test.ts`, `src/app/oplog/record-mask.test.ts`; дописаны `aggregate.test.ts`, `unit-of-work.test.ts`, `jsonl-operation-log.test.ts`, `use-case-from-def.test.ts`, `reaction-from-def.test.ts`, `src/testing/example/app/example-app.test.ts` (ждёт `title` → `[redacted]`).

Ожидаемые API:
- `F.sensitive(schema)` — разбор и тип выхода те же.
- `SensitiveMask(warn?)`: `apply(schema, value)`, `containsSensitive(schema)`, `isSensitive(schema, path)`; `lazy` → `'[redacted]'` целиком + `warn`.
- `FieldDiff(stateSchema).between(baseline | undefined, current)`; порядок записей не контракт.
- `RecordMask.of(def, warn?)`, `apply(record)` — маскирует `input`, `result.output`, `result.error.payload`.
- `ValueDigest = { digest: true; size; hash }` (`size` — байты UTF-8 JSON), `RedactedChange = { path; redacted: true }` — из `operation-record.ts`.
- `AggregateWrite.changes?`, `UnitOfWorkContext.warn?`, `JsonlOperationLog(dir, { maxBytes?, valueMaxBytes? })` (по умолчанию 1024).
- `Aggregate`: публичные `baseline`, `current` (приватное `current` переименовать).

Пометить в example: `TaskState.title` (`todo/task/task.state.ts`) — обязательно; `TaskEvents.created.payload.title` — для согласованности. `UserEvents.removed.payload.userId` не помечать (ломает тест ER «успех»). Для ошибок и ER тесты используют локальные Def.

Не тестировалось отдельно: «у query нет `changes`» (покрыто существующим тестом «writes пустые»); проброс `warn` в `createUow` — на ревью. Место параметра `RecordMask` в `OperationRun` — на выбор автора.

Прогон: 1510 pass, 17 fail, 5 errors (нет модулей/`F.sensitive`) — по делу.

### dmg-domain-author (2026-11-15)

Реализация по брифу, тесты не менялись. Отклонения: `RecordMask` — пятый параметр `OperationRun` (четвёртый — `output`); `user.errors.ts` не помечен (ломает тест ER «успех»; ошибки и ER покрыты локальными Def); у ER и Job нет `errors` — payload их ошибок не из `CoreErrors` скрывается целиком; payload ER с неизвестным событием — целиком. Приватное `current` агрегата → `live`, публичные `baseline`/`current`.

После ревью: `SensitiveMask` — `apply`, `containsSensitive`, `isSensitive`, `branches`, `isObject`, `field`; `FieldDiff` хранит схемы-кандидаты поля (ветки `variant` по дискриминатору `baseline` и `current`, иначе все ветки; `union` — все; `object_with_rest` — `rest`); try/catch в `RecordMask.apply` (сбой — `input`/`output`/`payload` → `'[redacted]'` + `warn`).

Замер (Bun 1.4.2, ~550 КБ JSON): `FieldDiff.between` 0,53–0,73 мс; дайджест 2,6 мс на значение. Порог размера сравнения не нужен.

`docs:impact`: concepts/aggregate-lifecycle, caller, domain, reading-a-module, uc-path; guides/aggregate, state, use-case; reference/testing (+ документы лога — вручную, Ф3).

check 1602 pass / 0 fail, e2e ok. Коммит dmg-core `f509cbf`.

### dmg-reviewer (2026-11-15)

| ID | файл:строка | суть | severity |
|---|---|---|---|
| — | field-diff.ts:37 | state-`variant`/`union` — помеченные поля в `changes` открыты | blocker → закрыто |
| — | field-diff.ts:62, sensitive-mask.ts:89 | `object_with_rest` — `rest` не учитывается | major → закрыто |
| CODE-04 | 12 мест | `(F-111)` в комментариях пакета | major → закрыто (D-86) |
| — | operation-run.ts:66 | сбой `RecordMask` вне try | minor → закрыто |
| TST-08 | use-case-from-def.test.ts:1094 | дубль record-mask | minor → удалён |
| CODE-04 | unit-of-work.ts:150 | проза в JSDoc `changesOf` | minor → закрыто |
| — | sensitive-mask.ts:80 | `isSensitive` не вызывается в рабочем коде (публичный API) | minor, оставлено |
| DOM-17 | aggregate.ts:106,114 | публичные `baseline`/`current` — живые ссылки на state, читаются мимо `view()` | question → Нурболату |

Кандидат в машинную проверку: DOM-17 — обращение к `.baseline`/`.current` агрегата вне `src/app/uow`.

## Открытые вопросы (на контрольную точку)

- DOM-17: публичные `Aggregate.baseline`/`current` (вар. A брифа) — оставить с lint-правилом «только `app/uow`» или скрыть иначе?
