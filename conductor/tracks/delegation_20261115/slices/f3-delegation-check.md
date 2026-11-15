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
