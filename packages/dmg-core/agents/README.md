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
- Копия роли для среды = тело роли + `common.md` пакета (+ общий блок проекта, если его дописывает сборщик проекта).

## Доставка в проект: `dmg-core init` / `sync`

```bash
bunx dmg-core init          # создать dmg-core.json (если нет) и выполнить sync
bunx dmg-core sync          # обновить копии после обновления пакета
bunx dmg-core sync --check  # для check проекта: код 1, если копии устарели или правлены
```

Что и куда класть, решает проект в `dmg-core.json` (все поля необязательны, `init` пишет значения по умолчанию):

```json
{
  "skills": { "names": ["dmg-architecture"], "dirs": [".claude/skills"] },
  "roles": {
    "names": ["domain-author", "api-author", "reviewer"],
    "targets": [{ "dir": ".claude/agents", "format": "claude" }]
  },
  "instructions": "AGENTS.md"
}
```

- `skills.names` / `roles.names` — что взять из пакета (по умолчанию всё); `skills.dirs` — каталоги скилов сред.
- `roles.targets` — цели: `format: "claude" | "pi"` — готовые роли среды с `common.md` пакета в конце; `format: "neutral"` — роли в формате выше для сборщика ролей проекта, `common` — путь, куда положить `common.md` пакета (сборщик дописывает его ко всем ролям, включая проектные).
- `instructions` — файл инструкций агентов, куда вставляется блок `<!-- dmg-core:begin/end -->` со ссылкой на `node_modules/dmg-core/llms.txt`; `null` — не вставлять.
- Каждая копия несёт метку `<!-- dmg-core@<версия>: сгенерировано … -->`. `sync` трогает только файлы с меткой: свои копии без источника удаляет, файл проекта на месте копии не перезаписывает (ошибка). Программный API — `dmg-core/cli` (`Marker.strip` снимает метку в сборщике проекта).
