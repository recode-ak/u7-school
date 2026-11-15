# Срез Ф5: oplog — `--actor` и `--request` по `requestId` (ФР-8)

**Репо:** `~/dev/tools/dmg/dmg-core`. Решения — D-86 (читатель), D-89 (след заместителя). Долг — `debt.md` пакета, DEBT-1.

## Границы

| Файл | Что |
|---|---|
| `src/app/oplog/operation-log-reader.ts` | `OperationLogFilter.actor?: string` — записи, где заместитель `actorId === actor`: `caller.kind === 'delegate'` или `system` с `person` заместителем (по образцу приватного `subject`). `request` — цепочка: значение совпало с `trace.correlationId` **или** с `trace.cause.requestId` (`cause.kind === 'request'`) любой записи → все записи с её `correlationId`. Два прохода по уже прочитанным записям диапазона (сначала собрать множество `correlationId`, затем фильтр) — без второго чтения файлов. JSDoc поля `request` — по новому смыслу |
| `src/cli/oplog-command.ts` | флаг `--actor <id>` (по образцу `--subject`) |
| `src/cli/main.ts` | строка справки: `[--actor <id>]` |
| `src/app/oplog/operation-log-feed.ts` | лента уже показывает заместителя (Ф1) — правка только если `--actor` требует |
| `debt.md` | запись `### DEBT-1` удалить (D-84: закрытая запись удаляется); «Последний выданный ID» не менять |
| тесты | `operation-log-reader.test.ts`, тест CLI `oplog` — red от dmg-test-designer |
| документы | `docs/reference/oplog.md` — фильтры `actor` и новый смысл `request`; по `docs:impact` |

## Red-тесты (dmg-test-designer)

1. `actor`: находит записи заместителя (`kind: 'delegate'`) и системные с этим заместителем в `person`; не находит записи, где этот id — `subjectId` (замещаемый или `user`).
2. `request` по `requestId` (`tg:<update>#<n>`, `correlationId` = `tg:<update>`): находит всю цепочку этого `correlationId`, включая записи реакций (`cause.kind: 'event'`); по `correlationId` — как раньше.
3. CLI: `--actor <id>` передаётся в фильтр (по образцу теста `--subject`).

## Критерии приёмки

- `grep -n "### DEBT-1" debt.md` пуст; `grep -rn "correlationId !== f.request" src/app/oplog` пуст.
- `bun test src/cli src/app/oplog` зелёные; `bun run check` зелёный; `docs:covers --strict` чист.

## Правила

ARC-12 (долг), D-84, D-86, TST-09, CODE-04.

## Отчёты
