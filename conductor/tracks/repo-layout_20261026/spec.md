# Спецификация: repo-layout — раскладка монорепо по осям архитектуры

## Обзор

Раскладка `packages/*` + `apps/*` не показывает оси архитектуры (платформа → домен → прикладной слой → входные адаптеры). Трек раскладывает workspace-пакеты по каталогам осей. Чистый перенос: поведение не меняется.

## Решения

- **Каталоги:**

  | Каталог | Пакеты |
  |---|---|
  | `platform/` | `dmg-core`, `app`, `core` (legacy) |
  | `domain/` | `@u7-scl/domain` (сейчас `packages/domain`) |
  | `modules/` | `course`, `dossier`, `peer-review`, `questionnaire`, `stream`, `user`, `wish` |
  | `runners/` | `u7-bot`, `u7-cli` |
  | `authoring/` | `w3school`, `video-summarizer` |

- **`ui/` — позже**, вместе с UI-слоем; пустой каталог не создаём.
- **Меняются только каталоги.** Имена пакетов и импорты (`@u7-scl/*`, `dmg-core`, `#*`) остаются прежними.
- **Домен — `domain/src/<m>`**: структура пакета с `src` сохраняется.
- **Один источник путей модулей** — секция `gen` в `dmg-core.json`; `DomainArch.layout` (`scripts/domain-arch.ts`) строится по её шаблонам `{m}`. Платформа не меняется.
- **История не переписывается**: `conductor/archive/` и git-история не трогаются, обновляются только живые документы.
- **Порядок:** трек идёт до `dmg-core-oop`.

## Функциональные требования

1. Пакеты перенесены через `git mv` (история файлов сохраняется).
2. Корневой `package.json`: `workspaces` — `platform/*`, `domain`, `modules/*`, `runners/*`, `authoring/*`; скрипты по пакетам (`test:p`/`test:a`, `lint:*`, `tslint:*`, `check:*`) заменены единым видом с путём пакета.
3. Пути обновлены в `tsconfig.json`, `biome.json` корня (overrides ARC/DOM, исключение `dmg-core`), `dmg-core.json` (`gen`), `pm2.config.cjs`, скриптах деплоя и релиза, `scripts/*` (`extract-check`, `arch-check`, `lint-rules` и др.), путях фикстур в `lint-fixtures/`.
4. `DomainArch.layout` читает `gen` из `dmg-core.json`; тест сверяет пути `layout` с путями генератора.
5. Живые документы: `AGENTS.md`, `conductor/` (`workflow.md`, `tech-stack.md`, `architecture/*`, `guides/*`), скилы и роли (`.claude`, `.pi`, `.agents-core` → `agents:sync`), README пакетов, `TRACK-DMG-CORE-OOP.md`, `TODO.md`.

## Нефункциональные требования

- `data/` не затрагивается: переносится только код.
- Без деплоя и пуша; без новых зависимостей.

## Критерии приёмки

- `bun run check` зелёный, тестов не меньше 3974.
- Вне `conductor/archive/` и `data/` нет ссылок на `packages/` и `apps/` (проверяет тест-страж; исключения — явный список).
- `bun run gen module x` (без `--write`) печатает `modules/x/src` и `domain/src/x`.
- Ручная проверка: `bun run dev:fixtures` поднимает бота на фикстурах.

## За рамками

- `ui/` и вынос рендереров; переименование пакетов; изменения API `dmg-core`; правки архива треков.
