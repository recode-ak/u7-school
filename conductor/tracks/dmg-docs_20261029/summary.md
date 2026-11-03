# Summary: dmg-docs_20261029 (черновик)

## Базовая линия (Фаза 0, 2026-11-03)

`dmg-core` @ `00bda68`, u7-school @ `7f85673b`.

**Проверки:**
- Пакет: `bun run check` — зелёный (1345 тестов, 130 файлов); `bun run e2e` — ok.
- u7-school: `bun run check` — красный на `dmg:check`: копии ролей `api-author`, `domain-author`, `reviewer` в `.agents-core/roles/` расходятся с пакетом (поле `model:` добавлено в проекте коммитом `7f85673b`, в пакете его нет). Исправлено: `model:` перенесено в роли пакета (`dmg-core@46b5c72`), после `bun install` и `sync` копии совпали, `check` зелёный. Остальные шаги `check` зелёные (3526 тестов, 366 файлов). Отдельного `e2e` в u7-school нет — его роль играет `gen:e2e` внутри `check`.

**Замер `dmg-core/src`** (скрипт: непустые строки; комментарий — строка `//`, `/* … */` или внутри блока; блок — подряд идущие строки комментария):

| Метрика | prod | тесты |
|---|---|---|
| Файлов | 198 | 126 |
| Непустых строк | 14 572 | 17 781 |
| Строк комментариев | 2 582 (17,7%) | 352 (2,0%) |
| Блоков ≥12 строк | 15 | 1 |
| JSDoc >6 строк (из них без ссылки на документ/тест) | 69 (69) | 2 (1) |
| Строк с `D-NN` | 178 | 19 |
| Строк с `TR-NN` | 0 | 0 |

Блоки ≥12 строк (prod):

| Файл:строка | Строк |
|---|---|
| `testing/memory-repo.ts:16` | 23 |
| `cli/scaffold/app-sources.ts:267` | 22 |
| `app/use-case/use-case-from-def.ts:71` | 20 |
| `app/replay/command-replay.ts:11` | 19 |
| `app/uow/unit-of-work.ts:62` | 17 |
| `arch/assembly-checker.ts:20` | 16 |
| `app/reaction/reaction-from-def.ts:52` | 15 |
| `kernel/fields/fields.ts:94` | 15 |
| `cli/scaffold/app-sources.ts:529` | 14 |
| `app/replay/replay-store.ts:15` | 14 |
| `testing/stub-facade.ts:42` | 13 |
| `arch/file-checker.ts:15` | 12 |
| `cli/scaffold/project-init.ts:16` | 12 |
| `app/api-app/api-app.ts:20` | 12 |
| `app/reaction/reaction-from-def.ts:21` | 12 |

Отличия от оценки в spec: 16% → 17,7% (точный подсчёт по непустым строкам), 203 → 178 строк с `D-NN` в prod (+19 в тестах). `TR-NN` в `src/` нет — пункт ФР-1 про треки работает как запрет на будущее.

## Пилот ролей

_Заполняется в фазах 2–5 (`documentarian`)._
