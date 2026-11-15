# Итог: `delegation` — делегирование в `dmg-core`

## Базовая линия (Фаза 0, 2026-11-15)

| Репо | Команда | Результат |
|---|---|---|
| dmg-core (`4df6cbc`, v0.3.2) | `bun run check` | зелёный: 1655 pass / 0 fail, 144 файла; `docs:covers`, `docs:jsdoc` — чисто |
| dmg-core | `bun run e2e` | ok (профиль monorepo) |
| u7-school (`ae30ad72`, `#v0.3.2`) | `bun run check` | зелёный: 3511 pass / 0 fail, 335 файлов |
| u7-school | `CI=true bun test` | 3511 pass / 0 fail, 335 файлов |
| u7-school | `bun run arch:check` | нарушений нет |

## Пилот ролей

Роль `dmg-access-auditor` (волна 4, `conductor/architecture/agent-roles.md` §4) — `.agents-core/roles/dmg-access-auditor.md`, Sonnet. Учёт на каждый вызов: повлиял ли отчёт на решение, сколько замечаний принято, правился ли промпт.

| Фаза | Вызов | Замечаний (принято / всего) | Повлиял | Промпт правился | Оценка |
|---|---|---|---|---|---|
| Ф0 | пробный запуск на diff Ф0 (только роли и `conductor/`) | — | нет | нет | «Триггера нет» — триггер распознан верно |
| Ф1 | аудит diff допуска (`64af7d9`) | 2 / 4 warn (+3 info) | да: сквозной тест через фасад, тест «переопределённый `checkCaller`» | нет | обхода нет; два непринятых warn — по замыслу D-89 (старые записи без `readOnly`, `personal` по умолчанию); сквозной тест пересёкся с `dmg-reviewer` |

Запуск в сессии, где роль создана: Claude Code читает `.claude/agents/` на старте сессии, поэтому до перезапуска роль вызывается как `general-purpose` с промптом «действуй по `.claude/agents/dmg-access-auditor.md`»; в новой сессии — `subagent_type: dmg-access-auditor`.

## Фаза 1: допуск заместителя

- Пакет: `64af7d9` (срез), `484db75` (`verified`). `check` — 1678 pass / 0 fail (база 1655); `docs:covers --strict` — чисто.
