# Срез: Фаза 2 — исполнение

Платформа `dmg-core` и `core`, выполнено в сессии-оркестраторе (Opus), без авторов-субагентов.

## Границы

- `dmg-core/src/app/module/module-from-def.ts` — реализации UC по имени, `dispatch(command, caller, trace)`.
- `dmg-core/src/kernel/errors/core-errors.ts` — базовая ошибка `OPERATION_NOT_FOUND` (`not_found`, `{ module, uc }`; решение Нурболата).
- `dmg-core/src/domain/contracts/use-case-def.ts` — `UseCaseDef.commandOf` (единственное место сборки команды).
- `dmg-core/src/app/facade/module-facade.ts` — `FacadeModule = { def, dispatch }`, `handle` — сахар над командой, `serves` по Def модуля.
- `core/src/api/app/api-app.ts` — `ApiApp.dispatch(module, command, caller, trace)`.
- Документы: `errors-result.md`, `transport.md` §2, `decisions.md` D-49, гайды `facade`, `module`, `use-case`, `rules.md` API-04, `caller.md`, `layers.md`.

## Сохраняется до Фазы 3

`ModuleFromDef.handle(def, …)`, `serves`, `ApiApp.run/execute` по Def — их зовут раннеры и `scripts/`; перевод — задачи Фазы 3.

## Критерии приёмки

- Команда после `JSON.stringify/parse` исполняется модулем и приложением по адресу.
- Неизвестный модуль или UC — `Err` `OPERATION_NOT_FOUND` с адресом, не исключение.
- Команда UC чужого модуля в типизированном модуле — ошибка компиляции.
- Фасад передаёт модулю команду, типы `handle` (только `SystemCallable<M>`) не ослаблены.

## Применимые правила

API-04, API-05, ERR-01, ERR-02, CODE-01, CODE-03, TST.

## Отчёт reviewer (`fd4851a..78e745e`)

error — нет.

| Замечание | severity | Решение |
|---|---|---|
| Уникальность имён UC в модуле и имён модулей не проверяется — `dispatch` по имени молча возьмёт один | warn | Исключение сборки: `ModuleFromDef` (дубль имени UC в Def модуля), `ApiApp.addDmgModules` (дубль имени модуля); тесты |
| JSDoc `ModuleFromDef`: «фасад поверх `handle`» | warn | «поверх `dispatch`» |
| CODE-03: guard `answers` — сужение типа на непроверенном допущении | info | JSDoc: осознанное сужение, уникальность проверена при сборке |
| JSDoc `ModuleFacade`: двусмысленный `handle` | info | «поверх `handle` фасада» |
| TST-04: имя теста «после JSON — тот же ответ» | info | Переименован: «вход доходит до UC» |
| `meta` команды не исполняется (идемпотентность в transport.md §2) | question | Решение Нурболата: одно поле `requestId` (и след, и ключ идемпотентности), `idempotencyKey` убран; отсев — DEBT-36 (`d06cf5bc`) |
| ERR-01: UC без реализации в фасаде — теперь `OPERATION_NOT_FOUND`, а не исключение | info | Недостижимо при `ModuleMap`; без изменений |
| CODE-03: `as never` в заглушке теста фасада | info | Допустимо, обоснование в комментарии |
| Удалён лишний импорт в тесте Ф1 | info | Без изменений |

Кандидат в машинную проверку (ArchChecker): уникальность имён UC в модуле и модулей в приложении — сейчас рантайм-проверка при сборке.
