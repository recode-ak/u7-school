# Роли агентов DMG

Роли для агентных сред (Claude Code, pi), которые пишут модули на `dmg-core`. Источник — этот каталог пакета; в проект их доставляет `dmg-core init` / `sync`, проект может дописать свой общий блок (процесс, гейт, запреты).

| Роль | Что делает |
|---|---|
| [domain-author](./roles/domain-author.md) | домен среза: state, Ar, Policy, события, ошибки, DCS/DQS, все Def и их тесты |
| [api-author](./roles/api-author.md) | прикладной слой среза: UC/ER/Job по готовым Def, репозитории, сборка модуля и тесты |
| [reviewer](./roles/reviewer.md) | ревью diff среза по правилам с проверкой `review`; код не правит |

Порядок среза: `domain-author` → `api-author` → `check` проекта → `reviewer`. Общий блок всех ролей — [common.md](./common.md).

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

- `tools` — обязателен, только нейтральные имена: `read`, `edit`, `write`, `bash`, `grep`, `find` (среда переводит их в свои: `Read`/`read`, `Glob`/`find` и т. д.); минимум инструментов на роль.
- `model` — допустимые ключи `claude` и `pi`; значение передаётся в среду как есть.
- Копия роли для среды = тело роли + `common.md` пакета + общий блок проекта (если есть).
