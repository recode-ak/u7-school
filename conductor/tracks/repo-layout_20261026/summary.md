# Итоговый отчёт — трек repo-layout_20261026

**Трек:** раскладка монорепо по осям архитектуры.
**Цель:** заменить `packages/*` + `apps/*` каталогами осей: `platform/`, `domain/`, `modules/`, `runners/`, `authoring/`. Это чистый перенос: имена пакетов `@u7-scl/*` и импорты не менялись.

## Гейт качества (триаж тестов)

`bun run check` (biome + tsc + тесты + `arch:check` + `agents:check` + `extract:check`):

| | pass | fail |
|---|---|---|
| Старт трека | 3974 | 0 |
| Конец трека | 3981 | 0 |

Прирост: +4 теста `DomainArch.layout` (Фаза 1) и +3 теста стража (Фаза 2). Красных тестов нет, поэтому нет ни промежуточных состояний, ни регрессов. Тесты не удалялись. Предупреждений biome 56, как на старте; все они старые.

## Фазы

### Фаза 1 — единый источник путей модулей (`7464abe`)

`DomainArch.layout` (`scripts/domain-arch.ts`) строит пути по шаблонам `{m}` из секции `gen` в `dmg-core.json`. Ручные пути убраны. Тест сверяет `layout` с шаблонами для каждого модуля `DOMAIN_MODULES`.

### Фаза 2 — перенос пакетов (`df7ea7c`, одним коммитом)

- `git mv` по таблице spec, вместе с фикстурами `lint-fixtures/`.
- Тест-страж `scripts/repo-layout.test.ts`:
  - каталогов `packages/` и `apps/` нет;
  - нет отслеживаемых файлов по старым путям;
  - нет текстовых ссылок на старые пути (по `git ls-files`).
- Конфиги переведены на новые пути: `workspaces`, `tsconfig.json`, `biome.json`, `dmg-core.json` (`gen`), `pm2.config.cjs`, `.gitignore`, `.biomeignore`.
- Скрипты переведены на новые пути:
  - `scripts/*`: `arch-check`, `domain-check`, `extract-check`, `lint-rules`, `call-uc`, `distribute-lesson`, `_app-factory`;
  - `runners/u7-bot/scripts/*`;
  - синтетические пути в тестах `agent-gate`, `domain-check`, `gen-e2e`.
- Скрипты по пакетам: `test:p`/`test:a`, `lint:*`, `tslint:*`, `check:*` заменены на `test:w`/`lint:w`/`tslint:w`/`check:w <путь>`, например `bun run test:w modules/wish`.

### Фаза 3 — документация (`f573f23d`)

- Обновлены живые документы: `workflow.md` (раздел «Команды разработки»), `AGENTS.md`, `conductor/` (`architecture/*`, `guides/*`, `roadmap/*`, `index.md`), README, `TODO.md`, `TRACK-DMG-CORE-OOP.md`.
- Скилы и роли обновлены в `.agents-core` и `.pi`, затем синхронизированы через `agents:sync`.
- Раздел «Модули проекта» в корневом README перестроен по осям.
- Пример `gen` в `platform/dmg-core/docs/naming.md` теперь совпадает с раскладкой проекта.
- Из стража убрано временное исключение для `.md`.
- `bun run gen module x` (dry-run) печатает `domain/src/x/…` и `modules/x/src/…`.

## Решения

- **Страж — тест, а не разовый grep.** Он не даст вернуть старые пути.
- **Страж не проверяет:**
  - историю: `conductor/archive/`, `CHANGELOG.md` и папку этого трека — после архивации она уходит в архив;
  - `data/`;
  - внешний контент: `authoring/w3school/output/` (скачанные уроки) и шаблоны `conductor-setup`.
- **Явные исключения стража:** тесты `dmg-core`, которые берут произвольные шаблоны раскладки (`gen/layout`, `gen/validate`, `cli/dmg-core-cli`), и сам страж.
- **Один параметризованный скрипт вместо пар `:p`/`:a`.** У пакетов теперь пять корней, и путь пакета однозначен.

## Отклонения от плана

- Задача «Скрипты по пакетам» из Фазы 3 сделана в Фазе 2: после переноса старые скрипты перестали работать.
- В Фазе 3 дополнительно обновлены `conductor/roadmap/*` и корневой README. Будущие пакеты в roadmap (`onboarding`, `task`, `metrics`, `passport`) теперь указаны в `modules/`.

## Ограничения и замечания для релиза

- **Сервер.** После `git pull` игнорируемые git файлы в старых `apps/*` и `packages/*` (`.env.*` бота, `.cache/`, `coverage/`) останутся на месте. Сами каталоги не исчезнут, и тест-страж на сервере упадёт. При релизе:
  1. проверить игнорируемые файлы в старых каталогах;
  2. перенести нужные (локально это `runners/u7-bot/.env.*`);
  3. удалить старые каталоги.

  Прод pm2 берёт `.env.production` из корня, этот файл не затронут.
- В `node_modules/@u7-scl/` остались висячие ссылки `onboarding`, `probe`. Они были и до трека.
- Битые относительные ссылки в `.md` появились до трека:
  - `modules/stream/src/analysis.md` → `./user-stories.md`;
  - `conductor/roadmap/schools-system.md` → трек `school-hub` (он в архиве).
- Ручная проверка `bun run dev:fixtures` (бот на фикстурах) — за Нурболатом.
