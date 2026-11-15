# Итог: `timestamp-data` — даты только числом

## Базовая линия (Фаза 0, 2026-11-15)

| Репо | Команда | Результат |
|---|---|---|
| dmg-core (`edd0dc0`) | `bun run check` | зелёный: 1648 pass / 0 fail, 144 файла; `docs:covers` — 3 warn (domain.md ×2, project.md) |
| u7-school (`8d3591b`) | `CI=true bun run check` | зелёный: 3456 pass / 0 fail, 332 файла |
| u7-school | `CI=true bun test` | 3456 pass / 0 fail, 332 файла |

### Счёт ISO-дат (точка сравнения для Ф5)

Шаблон — `YYYY-MM-DDTHH:MM`.

| Где | Счёт |
|---|---|
| `data/courses/*.json` | 2369: `steps.json` 1865, `lessons.json` 494, `modules.json` 8, `courses.json` 2 |
| `.ts` (без `node_modules`) | 61 файл / 160 строк; вне `Date.parse`/`new Date` — 116 строк |

## Фаза 1: dmg-core v0.3.2

- Тег `v0.3.2` → `4df6cbc` (push 2026-11-15). Коммиты среза: `a6043b1` (схема + тесты), `6a3e238` (D-16, `guides/state.md`), `5302112` (дубли «отвергает ISO» из образца убраны, TST-09), `adb4b8f` (`verified`), `4df6cbc` (версия). В релиз вошли и невыпущенные D-87/D-88.
- `check` пакета: 1655 pass / 0 fail (база 1648); `e2e` — ok; `docs:covers --strict` — чисто.
- CHANGELOG в пакете нет — пункт плана неприменим.
- Пункт 4 `RELEASING.md` (установка из git в пустой каталог) отдельно не выполнялся: установку по тегу проверит переход u7-school в Ф6.
