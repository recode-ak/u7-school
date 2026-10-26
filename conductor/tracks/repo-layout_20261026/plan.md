# План: repo-layout

## Фаза 1: Единый источник путей модулей

- [x] Task: `DomainArch.layout` по `gen` из `dmg-core.json` 7464abe
    - [x] Тест (красный): `DomainArch.layout(m)` совпадает с шаблонами `gen.domain`/`gen.app` с подстановкой `{m}` для каждого модуля `DOMAIN_MODULES`
    - [x] Реализация: `scripts/domain-arch.ts` читает `dmg-core.json`, ручные пути убраны
    - [x] `bun run check`, коммит
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Перенос пакетов

- [ ] Task: Тест-страж раскладки
    - [ ] Тест (красный): `scripts/repo-layout.test.ts` — нет каталогов `packages/` и `apps/`, нет текстовых ссылок `packages/…` и `apps/…` вне `conductor/archive/` и `data/` (по `git ls-files`; исключения — явный список)
- [ ] Task: Перенос одним коммитом (промежуточное состояние не собирается)
    - [ ] `git mv` по таблице spec
    - [ ] `workspaces`, `tsconfig.json`, `biome.json`, `dmg-core.json` (`gen`), `pm2.config.cjs`, `scripts/*` (`deploy`, `release`, `backup`, `extract-check`, `lint-rules`, `arch-check`), `runners/u7-bot/scripts/*`, пути `lint-fixtures/`
    - [ ] `bun install`; страж зелёный по коду и конфигам
    - [ ] `bun run check` (не меньше 3974 pass), коммит
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Скрипты и документация

- [ ] Task: Скрипты по пакетам
    - [ ] Вместо `test:p`/`test:a`, `lint:*`, `tslint:*`, `check:*` — `test:w <путь>` и т. п. (`bun run test:w modules/wish`)
    - [ ] `workflow.md`, раздел «Команды разработки»
- [ ] Task: Живые документы
    - [ ] `AGENTS.md`, `conductor/` (`tech-stack.md`, `architecture/*`, `guides/*`, `product.md` — если есть пути), README пакетов, `TRACK-DMG-CORE-OOP.md`, `TODO.md`
    - [ ] Скилы и роли (`.claude`, `.pi`, `.agents-core`) → `bun run agents:sync`
    - [ ] Страж зелёный полностью, без временных исключений
    - [ ] `bun run check`, коммит
- [ ] Task: Финал
    - [ ] `bun run gen module x` без `--write` печатает новые пути
    - [ ] Ручная проверка: `bun run dev:fixtures` поднимает бота
    - [ ] `summary.md`: триаж тестов по гейту workflow
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)
