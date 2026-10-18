# .agents-core — единый источник ролей агентов

Роли пишутся один раз в `roles/<role>.md`; `bun run agents:sync` собирает из них копии под каждую среду:

- `.claude/agents/<role>.md` — Claude Code;
- `.pi/agents/<role>.md` — pi.

Копии не правятся руками: `bun run agents:check` (входит в `bun run check`) падает при расхождении. Процесс и роли — `conductor/architecture/agents.md`.

## Общий блок

`common.md` дописывается в конец каждой роли: условия остановки, запреты, формат отчёта. В роли — только её специфика.

## Формат `roles/<role>.md`

```markdown
---
name: reviewer            # совпадает с именем файла
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
