# Паттерны немигрированного кода (legacy)

**Назначение:** как устроен и как сопровождать код модулей, ещё не переведённых на Def. Удаляется по завершении перехода ([migration.md](./migration.md) §5). Полные старые гайды — в истории git (`conductor/code_styleguides/`, до коммита удаления).

---

## 1. Как сопровождать

- Правка в немигрированном модуле делается **по образцу соседнего кода этого модуля**, а не по новой архитектуре: смешение двух стилей в одном модуле хуже любого из них.
- Новые нарушения направления не добавляются: domain не импортирует api, entity не читается в новых местах, где можно спросить Ar.
- Новый модуль или крупная фича — сразу по новой архитектуре (после трека core); до него — согласовать с Нурболатом.

## 2. Структура модуля

```
modules/<m>/src/
  domain/   entity.ts (схемы), <entity>/a-root.ts, policy.ts, events.ts,
            <entity>/commands/<name>-cmd.ts (Schema + Cmd + CmdMeta + CmdError),
            <m>-ds.ts, facade.ts (интерфейс), module.ts (ModuleMeta, UcMeta-union)
  api/      <entity>/<name>-uc.ts, er/<name>-er.ts, job/<name>-job.ts,
            errors.ts (атомарные <Name>UcError, union <M>ModuleError), module.ts (ApiModule)
  infra/    <entity>-json-repo.ts, <m>-in-proc-facade.ts
```

Пакеты экспортируют слои (`@u7-scl/<m>/domain`, `/api`, `/infra`), внутри — `#`-импорты, flat-импорты запрещены.

## 3. Объекты

| Объект | Как устроен |
|---|---|
| Aggregate | `new XxxAr(state)` валидирует схему; мутации через `updateState`/`safeUpdate` (обновляют `updatedAt`); геттер `state` — копия |
| Command | `<name>-cmd.ts`: схема из `Schema.entries`, `CmdMeta` (`ucName`, `title`, `type`, `errors`, `requiresAuth`), union ошибок |
| UseCase | дублирует поля `CmdMeta`; права — инлайн `Policy.canX()` + `throwAccessDenied()`; ошибки — `throw*`; `resolve.<name>` для репо и фасадов |
| Domain Service (Ds) | один на модуль, stateless, без репозиториев; возвращает изменённые агрегаты, UC их сохраняет |
| Policy | plain-object, синхронные методы `(actor, target?) → boolean` |
| Errors | `AppError { name, kind, level, message, payload }`, `kind → HTTP` |
| EventReaction | `ErMeta` + `eventNames`; ошибки не бросаются (шина гасит `console.error`); мультиподписка — exhaustive `switch` + `never` |
| Facade | интерфейс в domain (минимальный, удобный клиенту, отдаёт entity), `InProc`-реализация в infra через `ApiModule.execute` |
| Repo | interface, `Promise`/`MaybePromise`, `undefined` вместо `null`, только CRUD |
| Module | domain: `ModuleMeta`; api: `ApiModule` со списком UC; сборка — `createApiApp` |

> Совпадение имён: legacy `ApiApp` (`@u7-scl/core`, `api/app/api-app`) и `InProcEventBus` (`infra/in-proc-event-bus`) — не те же классы, что `ApiApp` и `InProcEventBus` из `dmg-core/app`. В DMG-коде — только из `dmg-core/app`.

## 4. Платформенные механизмы, которые сохраняются

- **Job-планировщик:** `JobSchedule` (UTC: `interval`, `dailyAt`, `weeklyAt`, `monthlyAt`), порты `JobScheduler` / `JobExecutor` / `JobRunRepo` (персистентность `lastRunAt`, догон пропущенного прогона). Правила Job — API-06.
- **Резолверы:** двухуровневые `AppResolver` / `ModuleResolver`, замыкаются в `app`.
- **Тестовые миры:** `conductor/guides/test-worlds.md`.

## 5. Тесты legacy

- Ошибки проверяются по `e.error.name` и `kind`, не только по классу `AppException`.
- Моки зависимостей — `as unknown as <реальный тип>`.
- Модуль — smoke-тест на реальных JSON-репозиториях.

## 6. Выход из legacy: алиасы и мосты

- Legacy-алиасы переименованы: `#domain-legacy/*`, `#api-legacy/*`, `#ui-legacy/*`, `#shared-legacy/*`, `#infra-legacy/*` (в `imports` каждого пакета). Имена `#domain/*`, `#api/*` и т.д. свободны под новую архитектуру. Алиас платформы — `#core/*` (пакет `dmg-core`).
- При миграции модуля его импорты переводятся с `#X-legacy/*` на новые пути; когда в пакете не осталось `-legacy`-импортов, запись удаляется из `imports`. Проверка: `grep -rn -- "-legacy/" modules/<m>/src` пусто.
- Для перенесённых в `@u7-scl/domain` модулей алиас `#domain-legacy/*` удалён; старый `modules/<m>/src/domain` — только barrel с `DEBT` до последнего трека миграции (см. [migration.md](./migration.md) §6).
- Мосты DMG↔legacy (`platform/core/src/legacy-bridge/`, трек `dmg-core-extract`) удаляются последними — вместе с legacy-шиной, `AppError`, legacy-`Job`. События DMG legacy-подписчики видят всегда; legacy-события подписчикам DMG — только по карте `inbound` в `legacyEventBus` на Def из контракта внешнего модуля (D-37). Часы — `legacyClock()`.
- **Вызов UC из stories (бывший errors-result §4).** UC DMG — команда модулю по его Def (D-49): `this.dispatchUc(<M>ModuleDef, ucDef.command(input), actor)` → `appApi.dispatch` → `Result`; субъект (`UserCaller`) и след (`Trace.fromRequest`, канал `telegram`) строит `U7BotUiStory.dispatchUc`. Story ветвится по `error.code`, неожиданный отказ — `ucErrorNotify` (warn-реплика по `kind` ошибки DMG: поля `INPUT_VALIDATION`, `denyMessage` отказа Policy, `label` из Def; `internal`/`unauthorized` — общий текст и error-лог). `appApi.execute` по строковому имени не менялся; story переводится на команды вместе с миграцией UC, который она вызывает.
- Финал перехода: удалить `-legacy`-алиасы, legacy-слои `core`, мосты, этот файл (migration.md §5).
