# Summary: aggregate-meta_20261029

## Итог

- **ФР-1.** D-57 в `decisions.md` пакета: ожидаемая версия — поле входа UC (вариант B); VO `meta` рассмотрен и отвергнут (dmg-core 6e877f3, b64a0b4).
- **ФР-2.** `F.expectedVersion(label)` — `expectedVersion?: number`, целое ≥ 0, описание из метки (dmg-core 53e66d1, dbfbbe0).
- **ФР-3.** Шаг `expectVersion(ar, expected)` в `UseCaseFromDef`: расхождение — `Err(VERSION_CONFLICT)` без фиксации и событий, `undefined` — сверки нет (dmg-core 0156ec3).
- **ФР-4.** `CommandMeta.version` удалён, `meta` команды — только `requestId` (dmg-core 53e66d1). При релизе пакета отметить как ломающее изменение.
- **ФР-5.** Учебный `completeTask` с `expectedVersion` (6ed31b6); генератор не менялся — сверка по выбору UC; гайд `use-case`, `transport.md` §2, `errors-result.md`, `llms.txt` (275661f).
- **ФР-6.** `wish`: `cancelWish` принимает `expectedVersion` и сверяет её (12c98c5, TR-31).
- Форма state, `view()` и записей не изменилась; данные `data/` не трогались.

## Базовая линия (2026-10-29)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`a86771b1`) | `CI=true bun test` | 3304 pass, 0 fail (342 файла) |
| dmg-core (`c949ba0`) | `CI=true bun test` | 1316 pass, 0 fail (130 файлов) |
| dmg-core (`c949ba0`) | `bun run e2e` | `e2e: ok` |

## Гейт качества (2026-10-29)

| Где | Команда | Результат |
|---|---|---|
| u7-school (`e9be966c`) | `bun run check` | зелёный; `CI=true bun test` — 3308 pass, 0 fail (342 файла) |
| dmg-core (`dbfbbe0`) | `CI=true bun test` | 1330 pass, 0 fail (130 файлов) |
| dmg-core (`dbfbbe0`) | `bun run e2e` | `e2e: ok` |

- Прирост: u7-school +4 теста (`cancelWish` с ожидаемой версией), dmg-core +14 (схема поля, шаг `expectVersion`, учебный модуль). Регрессов нет, число тестовых файлов не изменилось.

## Тактические решения

- **TR-31** (`debt.md`) — вход `cancelWish`: поле `expectedVersion` в каждом варианте союза цели, а не обёртка.

## Долг

- Новых записей в `debt.md` нет. Передача версии в кнопках бота (`ui-manifests`) — за рамками трека; без неё бот вызывает `cancelWish` без сверки.
- `migration.md` не меняется: трек не переносит модули.
