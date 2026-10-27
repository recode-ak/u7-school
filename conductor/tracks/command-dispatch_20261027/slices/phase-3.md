# Срез: Фаза 3 — клиент и потребители

Платформа `dmg-core`, `core` и раннеры. Выполняется в сессии-оркестраторе (Opus), без авторов-субагентов.

## Решения Нурболата (2026-10-27)

- **Caller и Trace — явные аргументы:** `moduleApi.dispatch(command, caller, trace)`, как у `ModuleFromDef.dispatch`. Пример в `transport.md` §4 поправить.
- **In-proc ответ — `Result` как есть**, без `serializeResult`/`restoreResult`.
- **`restore` с `warn` — сейчас, в `ModuleApi`:** `restore(command, wire)` восстанавливает ответ по Def модуля. Если ошибка не из контракта, получается `SERVER_INTERNAL`, а в лог идёт `warn` с исходным `code` (ERR-07). Пока его зовут только тесты, это задел под wire-транспорт.

## Границы

- `dmg-core/src/app/client/module-api.ts` — `ModuleApi<M, U>` (`def`, транспорт, `dispatch`, `restore`) и тип транспорта `CommandTransport<U>` (`dispatch(module, command, caller, trace)`), экспорт из `dmg-core/app`.
- `core/src/api/app/api-app.ts` — `ApiApp` подходит как `CommandTransport` структурно (его `dispatch(module, …)` уже есть).
- Задача 2: `runners/u7-bot/src/core/u7-bot-ui-story.ts` (`executeUc` → `moduleApi`), истории wish, `scripts/call-uc.ts`. Перевод `ApiApp.run/execute` по Def и `ModuleFromDef.handle/serves` — после перевода потребителей.
- Документы: `transport.md` §4, `errors-result.md`, гайд `facade`/`module` (вход клиента), `decisions.md` D-49 (пример).

## Критерии приёмки

- `new ModuleApi(WishModuleDef, apiApp).dispatch(Def.command(input), caller, trace)` даёт `Result<OutputOf<D>, UseCaseErrorOf<D>>`; команда UC другого модуля — ошибка компиляции.
- Модуль берётся по адресу транспорта (`def.name`), имени модуля в команде нет.
- `restore`: ok и ошибка контракта восстанавливаются, чужой `code` → `SERVER_INTERNAL` и один `warn` с исходным `code`; `SERVER_INTERNAL` с сервера без `warn`.
- Круговой тест: команда → JSON → `ApiApp.dispatch` → `serializeResult` → JSON → `ModuleApi.restore`.

## Применимые правила

API-04, API-05, ERR-01, ERR-02, ERR-07, CODE-01, CODE-03, TST.
