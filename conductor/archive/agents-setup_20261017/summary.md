# Итог: agents-setup_20261017

**Цель:** подготовить мультиагентный процесс из [agents.md](../../architecture/agents.md) в двух средах — Claude Code (основная) и pi (внешний исполнитель). Роли пишутся один раз, гейт после субагента запускается автоматически, работа передаётся между средами через conductor и git. Трек 0 из migration.md.

## Гейт закрытия

- `CI=true bun test` — 2869 pass, 0 fail. Красных тестов нет, триаж не нужен.
- Покрытие скриптов трека — 95,5% строк (`agent-gate.ts` 96,6%, `agents-sync.ts` 95,5%, `subagent-config.ts` 100%, `subagent-gate.ts` 90%).
- `bun run check` (agents:check + biome + tsc + тесты) — зелёный.

## Сделано по фазам

1. **Единый источник ролей и генератор** — `.agents-core/roles/` + `common.md`; `scripts/agents-sync.ts` собирает `.claude/agents/` и `.pi/agents/`, `agents:check` входит в `check`.
2. **Тексты ролей** — `domain-author`, `api-author`, `migrator`, `reviewer` (только чтение); общий блок: условия остановки, запреты, формат отчёта.
3. **Гейт по затронутым пакетам** — `scripts/agent-gate.ts` (пакеты из `git status` + транзитивно зависимые); хук `SubagentStop` в `.claude/settings.json` для авторов.
4. **pi** — расширение `.pi/extensions/subagent/` на основе официального примера, гейт после субагента (`scripts/subagent-gate.ts`), модель субагентов из `.pi/subagent.json`.
5. **Оркестратор и передача** — разделы 4.0 и 4.1 скилла `conductor-implement`; `agents.md` §8, `index.md`, `tech-stack.md` по факту.

## Файлы

- `.agents-core/` — `README.md`, `common.md`, `roles/*.md`
- `.claude/agents/*.md`, `.pi/agents/*.md` — сгенерированные копии
- `.claude/settings.json` — хук гейта
- `.pi/extensions/subagent/{index,agents}.ts`, `.pi/subagent.json`
- `scripts/agents-sync.ts`, `scripts/agent-gate.ts`, `scripts/subagent-gate.ts`, `scripts/subagent-config.ts` + тесты
- `.pi/skills/conductor-implement/SKILL.md` (`.claude/skills` — симлинк на `.pi/skills`)
- `package.json` — `agents:sync`, `agents:check`
- `conductor/architecture/agents.md`, `conductor/architecture/index.md`, `conductor/tech-stack.md`

## Решения

- **Генерация копий, а не симлинки ролей:** форматы сред отличаются frontmatter и именами инструментов; `agents:check` ловит ручные правки копий.
- **Логика гейта — в одном скрипте:** хук Claude Code и расширение pi только вызывают `agent-gate.ts`.
- **Гейт видит только незакоммиченное:** чужие коммиты принимаются полным `check` и reviewer по diff.
- **Граница передачи между средами — фаза или трек.** Передача посреди задачи (wip-коммит + пометка «Передача») — исключение.

## Отклонения от плана

- Добавлены задачи: модель субагентов pi (`.pi/subagent.json`) и правило о `$T`-сокращениях вывода pi — по итогам пробного прогона; правило перенесено в глобальный `~/.pi/agent/AGENTS.md`.
- Пробная передача показала: pi отступил от «осталось» в пометке и закрыл задачу сам. В раздел 4.1 добавлено правило «осталось обязательно», граница передачи — фаза или трек.

## Ограничения

- Тексты `domain-author` и `api-author` помечены «доработать на golden-wish» — эталона ещё нет.
- Режим оркестратора на реальном срезе не проверен — первый прогон будет в треке перехода.
- `arch:check` и генераторы `bun run gen` — в треках core-dmg и generators.
