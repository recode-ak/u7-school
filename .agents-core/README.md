# .agents-core — единый источник ролей агентов

Роли платформы (`dmg-tech-lead`, `dmg-test-designer`, `dmg-domain-author`, `dmg-api-author`, `dmg-data-keeper`, `dmg-reviewer`) и их общий блок — из пакета `dmg-core` (формат — `node_modules/dmg-core/agents/README.md`): `bun run dmg:sync` по `dmg-core.json` кладёт их в `roles/` и `dmg-core-common.md` с меткой версии (руками не править, `dmg:check` в `check`). Проектное — роли `roles/migrator.md`, `roles/documentarian.md` и `roles/dmg-access-auditor.md` (пилот волны 4) (`conductor/architecture/agent-roles.md`) и общий блок проекта `common.md` (привязка ролей пакета к u7-school). `bun run agents:sync` собирает все роли из `roles/` в копии под каждую среду:

- `.claude/agents/<role>.md` — Claude Code;
- `.pi/agents/<role>.md` — pi.

Копии не правятся руками: `bun run agents:check` (входит в `bun run check`) падает при расхождении. Процесс и роли — `conductor/architecture/agents.md`.

## Общий блок

Копия роли = тело роли + общий блок пакета (`dmg-core-common.md`: остановка, запреты, отчёт) + `common.md` проекта (бриф conductor, `data/`, команды проекта, ревью в проекте). В роли — только её специфика. Метка `dmg-core sync` в копии среды не попадает.

## Формат `roles/<role>.md`

```markdown
---
name: migrator            # совпадает с именем файла
description: Что делает роль и когда её вызывать
tools: [read, grep, find, bash]
model:                    # необязательно; без него — модель среды
  claude: sonnet
  pi: claude-sonnet-4-5
---

Промпт роли.
```

- `tools` — обязателен, только нейтральные имена из таблицы ниже (минимум инструментов на роль).
- `model` — допустимые ключи `claude` и `pi`; значение передаётся в среду как есть.

## Соответствие инструментов

| Нейтральное | Claude Code | pi |
|---|---|---|
| `read` | `Read` | `read` |
| `edit` | `Edit` | `edit` |
| `write` | `Write` | `write` |
| `bash` | `Bash` | `bash` |
| `grep` | `Grep` | `grep` |
| `find` | `Glob` | `find` |
