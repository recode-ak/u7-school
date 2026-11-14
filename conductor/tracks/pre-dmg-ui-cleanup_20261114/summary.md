# Summary: уборка перед dmg-ui

> Заполняется по фазам; итоговый вид — при закрытии трека.

## Фаза 0. Базовая линия (2026-11-14, `d980980d`)

| Команда | Итог |
|---|---|
| `CI=true bun run check` | зелёный: 3211 pass, 0 fail, 9116 expect, 312 файлов |
| `CI=true bun run test:bot` | зелёный: 1207 pass, 0 fail, 5476 expect, 107 файлов |

### Повторы в тестах

Общая часть команды (из корня репо):

```bash
G='grep -rE --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=data --exclude-dir=.cache'
$G -- '<шаблон>' . | wc -l    # вхождений
$G -l -- '<шаблон>' . | wc -l # файлов
```

| Повтор | Шаблон | Вхождений | Файлов |
|---|---|---|---|
| `Trace.fromRequest({ requestId` | `Trace\.fromRequest\(\{ requestId` | 77 | 48 |
| `mkdtemp` | `mkdtemp` | 129 | 51 |
| `repoWith` (определения) | `(function\|const) repoWith\b` | 11 | 11 |
| `press` (определения) | `(function\|const) press\b` | 16 | 15 |
| `buttonsOf` / `findBtn` (определения) | `(function\|const) (buttonsOf\|findBtn)\b` | 16 | 16 |
| `waitMessageFor` / `waitUntil` (определения) | `(function\|const) (waitMessageFor\|waitUntil)\b` | 11 | 11 |
| `makeLogger` (определения) | `(function\|const) makeLogger\b` | 5 | 5 |
| `subHandler` (определения) | `(function\|const) subHandler\b` | 3 | 3 |
| `makeUiApp` (определения) | `(function\|const) makeUiApp\b` | 5 | 5 |

Числа в плане (46, 50, 11, 11, 9, 11, 5, 4, 5) — оценка при постановке; базой считаются числа этой таблицы: сравнение в Ф4 и Ф7 — теми же командами.
