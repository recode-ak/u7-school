# Срез: Фаза 1 — команда и ответ

Платформа `dmg-core`, выполнено в сессии-оркестраторе (Opus), без авторов-субагентов.

## Границы

- `src/domain/contracts/command.ts` — `Command<D>`, `CommandMeta`, `DefOfCommand`.
- `src/domain/contracts/use-case-def.ts` — `command`, `serializeResult`, `restoreResult`.
- `src/kernel/result/serialized-result.types.ts`, `src/kernel/errors/error-def.ts` — `ErrorDef.serialize` / `restore`.
- Документы: `transport.md` §1–2, `errors-result.md` §2, `manifests.md`.

## Критерии приёмки

- Команда — простые данные, JSON без потерь; `uc` — литерал имени Def; по команде выводятся `InputOf`/`OutputOf`/`UseCaseErrorOf`.
- Круговой путь `Result` через JSON восстанавливает тот же `Result`; код или payload вне контракта → `SERVER_INTERNAL`.

## Отчёт reviewer (`feeb6ae..858001f`)

error — нет.

| Замечание | severity | Решение |
|---|---|---|
| ERR-07: подмена чужого кода на `SERVER_INTERNAL` без сигнала | warn | Решение Нурболата: `SERVER_INTERNAL` + `warn` в `moduleApi` (задача Фазы 3 дополнена) |
| `restore` не проверяет payload | warn | `ErrorDef.restore` проверяет схему (`v.is`), вне схемы → `undefined` → `SERVER_INTERNAL`; тесты |
| Ограничение «output переживает JSON» не записано | warn | `transport.md` §1 |
| Документы не описывают сериализацию ошибок | warn | `errors-result.md` §2, `transport.md` §1, строка в `manifests.md` |
| Проверка формы ответа от HTTP (`unknown`) | question | За рамками трека (HTTP-адаптер); in-proc форма типизирована |
| `command` вне `AnyUseCaseDef` — сборка команды в обобщённом коде | info | Задача `ModuleFacade` Фазы 2 дополнена |
| CODE-03: утверждение типа без пояснения | info | Комментарий добавлен |
| CODE-01: тест `serialized-result.test.ts` | info | Переименован в `use-case-def.result.test.ts` |
| `transport.md`: `uc` в kebab-case | info | Исправлено на `completeTask` |
