# Итог трека command-dispatch_20261027

**Цель.** UC исполняется по сериализуемой команде `{ uc, input, meta? }`, а не по ссылке на Def. Модуль адресует транспорт, Def служит типами клиента. UI, CLI, фасады и будущий HTTP идут одним путём.

## Задачи

- **Фаза 0:** D-49 в `decisions.md`, `transport.md` §2 и §4.
- **Фаза 1:** `Command<D>` и `UseCaseDef.command`; сериализуемый `Result` (`serializeResult`/`restoreResult`, `ErrorDef.serialize/restore`); правки ревью.
- **Фаза 2:** `ModuleFromDef.dispatch` (UC по имени, `OPERATION_NOT_FOUND`), `ApiApp.dispatch(module, …)`, `ModuleFacade` через команды (`UseCaseDef.commandOf`), гайды `facade`/`module`; правки ревью (уникальность имён UC и модулей при сборке); `requestId` как ключ идемпотентности (DEBT-36).
- **Фаза 3:**
  - `ModuleApi<M, U>` (`dmg-core/app`): `dispatch(command, caller, trace)` по адресу модуля из Def через `CommandTransport` (in-proc — `ApiApp`, `Result` как есть); `restore(command, wire)` восстанавливает ответ по Def UC, ошибка вне контракта — `SERVER_INTERNAL` и `warn` с исходным `code` (ERR-07).
  - Бот: `U7BotUiStory.dispatchUc(api, command, actor)` вместо `executeUc`, story ветвится по `error.code`, неожиданный отказ — `BotUiStory.ucErrorNotify` (DEBT-37); `wishApi` в `ApiAppBundle` и resolve UI; `course-catalog` на командах.
  - CLI `call-uc`: wish — команда через `ModuleApi`, `Err` — код в stderr, выход 1.
  - Удалены `ApiApp.run`, `ApiApp.execute(Def)`, `ModuleFromDef.handle/serves`; тесты модулей, `example-app`, интеграционные и e2e тесты бота — на `dispatch`/`ModuleApi`.

## Решения Нурболата в Фазе 3

- Caller и Trace у `moduleApi.dispatch` — явные аргументы, а не привязка к клиенту.
- In-proc ответ — `Result` без сериализации; `restore` с `warn` — сразу в `ModuleApi` (задел под wire-транспорт).
- Story получает `Result` и ветвится по `code` (а не `AppException`).
- Старый вход по Def удалён в этом треке.

## Отклонения от плана

- Формулировка задачи «`moduleApi.dispatch(ucDef.command(input))`» реализована с явными `caller, trace` (решение выше); `transport.md` §4 и D-49 поправлены.
- `warn` о расхождении контракта срабатывает в `ModuleApi.restore`, in-proc путь его не зовёт (ответ без сериализации).

## Новый долг

- **DEBT-37** — отказ UC DMG в боте показывается веткой legacy (`ucErrorNotify` → `toLegacyError`).
- DEBT-36 (Фаза 2) — повтор команды по `requestId` не отсеивается.

## Ограничения

- `call-uc` для wish вживую не прогонялся: даже query пишет `data/oplog`; путь покрыт `tsc` и тестами `ModuleApi` поверх `ApiApp`.
- HTTP-транспорт и MCP — за рамками (отдельные треки).

## Финал: гейт качества (2026-10-27)

| Прогон | pass | fail | файлов |
|---|---|---|---|
| `CI=true bun test` (весь репозиторий) | 4146 | 0 | 445 |
| `CI=true bun test` в `platform/dmg-core` | 867 | 0 | — |
| `tsc --noEmit` | зелёный | | |
| `biome check` | 0 ошибок | | 56 предупреждений — как до трека, в чужом коде |
| `arch:check` | нарушений нет | | |

Промежуточных состояний и регрессов нет.

**Тесты не исчезли.** Удалённые сценарии перенесены:
- `ModuleFromDef.handle/serves`: свой UC, UC чужого модуля (тип) — в тестах `dispatch`; стёртый тип — `OPERATION_NOT_FOUND` вместо исключения; `serves` удалён вместе с методом.
- `ApiApp.run`: Ok, Err, неизвестный UC — в тестах `ApiApp.dispatch`.
- `ApiApp.execute(Def)`: маппинг `toLegacyError` (код, `kind`, текст, `denyMessage`) — новый `legacy-error.test.ts`; показ в UI — тесты `ucErrorNotify`.
- `U7BotUiStory.executeUc` (субъект, след, `warn` без `requestId`) — тесты `dispatchUc`.
