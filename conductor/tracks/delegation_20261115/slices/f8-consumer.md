# Срез Ф8: u7-school на `dmg-core` v0.4.0 (ФР-11)

**Порядок** — `conductor/architecture/index.md`, «Правка платформы `dmg-core`», п. 4. Тег `v0.4.0` → `c254383` (пакет). Поведение бота не меняется: правок UC, домена и резолвера нет.

## Границы

| Файл | Что |
|---|---|
| все `package.json` с `"dmg-core": "git+ssh…#v0.3.2"` (`git grep -l '"dmg-core": "git+ssh'`) | `#v0.4.0` |
| `bun.lock` | `bun install` (клон в кеше bun уже знает тег — ловушка K-20261114-w39q закрыта) |
| `.pi/skills/dmg-architecture/`, `.agents-core/roles/dmg-*.md`, `.agents-core/dmg-core-common.md` | `bun run dmg:sync`, затем `bun run agents:sync` — только то, что пакет доставляет |
| `AGENTS.md` | «Модули пишутся на `dmg-core@0.4.0`» |
| `conductor/tech-stack.md` | `git+ssh…#v0.4.0` |
| `scripts/oplog.ts` | подсказка: `--actor <id>` в строке использования и пример в шапке (по образцу `--subject`) |

## Не трогать

`domain/`, `modules/`, `platform/app/src/u7-caller-resolver.ts` — `git diff --stat <база> -- domain modules platform/app/src/u7-caller-resolver.ts` пуст. Если `tsc` или тесты требуют правки там — остановись и доложи (эскалация).

## Критерии приёмки

- одна версия `#v0.4.0` во всех `package.json`;
- `bun run check`, `CI=true bun test`, `bun run arch:check` зелёные, тестов ≥ 3511.

## Отчёты

### migrator (Sonnet)

11 `package.json` → `#v0.4.0`, `bun.lock` → `c254383`, `dmg:sync` + `agents:sync` (шапки версии, строка скила про `guides/delegation.md`), `AGENTS.md`, `tech-stack.md`, `scripts/oplog.ts` (`--actor`). `check` 3511 pass, `arch:check` чисто. Отклонение: заметил чужую правку `conductor/roadmap/dmg-ui-entry.md` (§13 «Многоязычность») — не из среза, в коммит не взята.

### dmg-reviewer (Sonnet)

Замечаний нет.
