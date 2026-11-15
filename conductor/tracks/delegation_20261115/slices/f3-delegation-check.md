# Срез Ф3: проверка заявки (ФР-6)

**Репо:** `~/dev/tools/dmg/dmg-core`. Решение — D-89 (черновик), пункты «Заявка», «Порт», «Проверка». Spec — `../spec.md` ФР-6. Резолвер и образец — Ф4, не здесь.

## Границы

| Файл | Что |
|---|---|
| `src/app/delegation/delegation.types.ts` | `DelegationClaim = { principalId; actorId; delegationId }` — что прислал транспорт; `DelegationRecord = { delegationId; principalId; actorId; expiresAt: Timestamp; revoked: boolean; readOnly: boolean }` — что читает платформа (начала срока и «кто выдал» нет: их хранит приложение сверх этого); `DelegationStore = { find(delegationId: string): Promise<DelegationRecord \| undefined> }` — порт, реализует приложение |
| `src/app/delegation/delegation-check.ts` | класс `DelegationCheck`: `constructor(store: DelegationStore \| undefined, clock: Clock)`; `verify(claim): Promise<Result<DelegationRecord, DelegationDenied>>`. Порядок: порта нет → `disabled`; записи нет или пара (`principalId`, `actorId`) не совпала → `invalid` (одна причина — не раскрывать, что запись есть); `revoked` → `revoked`; `clock() >= expiresAt` → `expired`. Исключение порта не ловится (ERR-01: дефект хранилища, не отказ). JSDoc — шапка с D-89 |
| `src/kernel/errors/core-errors.ts` | `DELEGATION_DENIED`: `kind: 'unauthorized'`, label «Делегирование не принято», payload `{ reason: 'invalid' \| 'expired' \| 'revoked' \| 'disabled' }` (`v.picklist`, `description`) |
| `src/app/index.ts` | экспорт `DelegationCheck` и типов `DelegationClaim`, `DelegationRecord`, `DelegationStore` |
| `src/app/delegation/delegation-check.test.ts` | тесты (dmg-test-designer) |
| документы | по `bun run docs:impact` — минимально; `reference/errors-result.md` — строка `DELEGATION_DENIED`; полная правка — Ф6 |

## Red-тесты (dmg-test-designer)

`delegation-check.test.ts`, часы — подставные (`() => <число>`), порт — объект в тесте (не фейк-класс):

1. Успех: запись есть, пара совпала, не отозвана, срок впереди → `ok(record)`, `readOnly` из записи.
2. Нет записи → `invalid`.
3. Пара не совпала (чужой замещаемый; чужой заместитель) → `invalid`.
4. Срок истёк: `clock() === expiresAt` и позже → `expired`; за 1 мс до — успех.
5. Отозвано → `revoked` (в т.ч. при истёкшем сроке — порядок: `revoked` раньше `expired`).
6. Порта нет → `disabled`, порт не вызывается.
7. Ошибка — `DELEGATION_DENIED` с `kind: 'unauthorized'`.

## Критерии приёмки

- `bun run check` зелёный; `docs:covers --strict` чист.
- В тесте класса — случай на каждую из четырёх причин.
- `DELEGATION_DENIED` в `core-errors.ts` с `kind: 'unauthorized'`.

## Правила

ERR-01, ERR-02, CODE-04, TST-09 (не тестировать ядро: тексты `label`), D-59, D-89.

## Отчёты

### dmg-test-designer (Sonnet)

`src/app/delegation/delegation-check.test.ts`, 14 тестов: успех (запись как есть, `readOnly` из записи), `invalid` (нет записи, чужой замещаемый, чужой заместитель; чужая пара при отозванной и истёкшей — `invalid`, не `revoked`), `expired` (`clock === expiresAt`, позже; за 1 мс до — успех), `revoked` (и при истёкшем сроке), `disabled`, `kind: 'unauthorized'`, исключение порта пробрасывается. Падает на импорте (модуля нет).

### dmg-api-author (Opus)

`delegation.types.ts` (`DelegationClaim`, `DelegationRecord`, `DelegationStore`), `DelegationCheck` (порядок `disabled` → `invalid` → `revoked` → `expired`, исключение порта не ловится), `DELEGATION_DENIED` после `UNAUTHORIZED`, экспорт из `dmg-core/app`, строка в `reference/errors-result.md`. Отклонение: `core-errors.test.ts` — пара `DELEGATION_DENIED`/`unauthorized` в списке. `docs:impact` — `concepts/errors.md`, `guides/errors.md` сверены без правки (`verified` после коммита). `check`: 1695 pass.

### dmg-reviewer (Opus)

Error нет. Minor (все автору): дубль «за 1 мс до» (TST-08), тест `kind` из Def (TST-09), название теста чужой пары, `DelegationDenied` через `ErrorOf`. Вопрос — в Ф6: `DELEGATION_DENIED` в `CoreErrors` попадает в объединение ошибок каждого UC, хотя `handle` её не возвращает; причина (клиент восстановит код, иначе `SERVER_INTERNAL`) не записана в D-89 и `errors-result.md`.

### dmg-access-auditor (Sonnet, пилот)

Обхода и раскрытия чужой записи нет. Warn (принят): `expiresAt` не числом (`NaN` из JSON приложения) — сравнение `>=` ложно, делегирование бессрочное; проверка — fail-closed. Info для Ф4: пустая заявка, исключение порта не превращать в гостя.

## Открытые вопросы → Ф6

- Причина места `DELEGATION_DENIED` в `CoreErrors` — в D-89 и `reference/errors-result.md`.
- `guides/app.md:30-31` — резолвер образца с заявкой и `Result` (ревью Ф4).
- Ratchet: число `D-NN` на блок JSDoc (CODE-04) — проверкой `docs:jsdoc` (ревью Ф4); решение — в Ф6.
- Гайд: самоделегирование (`principalId === actorId`) запрещать при выдаче (аудит Ф4).

### Итог среза

Правки: срок fail-closed (`!(now < expiresAt)`, тест `NaN`), дубли тестов убраны, `DelegationDenied` через `ErrorOf` и экспортирован. Пакет `1d3e613` (срез), `9094e9a` (`verified`). `check` — 1694 pass / 0 fail.
