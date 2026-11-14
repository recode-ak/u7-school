# Spec: Перенос ролей волны 2 в `dmg-core`

## Обзор

Пилот ролей волны 1 (`stream-dmg`, `summary.md`, итог 2026-11-04) признал `tech-lead`, `test-designer`, `data-keeper` годными по критериям 1–5 ([agent-roles.md](../../architecture/agent-roles.md) §5). Каркас трёх ролей переезжает в пакет `dmg-core` (`agents/roles/`), специфика u7-school — в общий блок проекта `.agents-core/common.md`. Заодно все роли пакета получают префикс `dmg-*` (agent-roles.md §1 п. 6), черновик `dmg-process.md` переезжает в пакет как `docs/process.md`. Трек — рефакторинг процесса, поведение приложения не меняется. Идёт перед треком `questionnaire` (migration.md §6).

## Функциональные требования

1. **Перенос каркаса.** В `dmg-core/agents/roles/` — `dmg-tech-lead.md`, `dmg-test-designer.md`, `dmg-data-keeper.md` без специфики u7-school (эталон `wish`, worktree `../u7-school-v0.2.6`, пути `data/`, `data/fixtures/`, `conductor/…`, `backup`, `AGENTS.md`). Специфика — в `.agents-core/common.md`. Модель `tech-lead` (Sonnet) сохраняется.
2. **Префикс у всех ролей пакета.** `domain-author`, `api-author`, `reviewer` → `dmg-domain-author`, `dmg-api-author`, `dmg-reviewer`. Проектные роли (`migrator`, `documentarian`) — без префикса.
3. **Доставка.** `dmg-core.json` не меняется (`roles.names` не задан — берутся все роли пакета). Порядок: `bun install` → `bun run dmg:sync` (кладёт шесть ролей в `.agents-core/roles/`, свои старые копии с меткой удаляет) → удаление проектных исходников трёх ролей → `bun run agents:sync` (копии в `.claude/agents/` и `.pi/agents/`, старые копии с меткой удаляются).
3а. **Зашитые имена ролей в коде:** `scripts/subagent-gate.ts` (`GATED_AGENTS`) и тест, matcher хука `SubagentStop` в `.claude/settings.json` — в одной фазе с переименованием (иначе гейт молча перестаёт срабатывать); фикстуры `scripts/agents-sync.test.ts`, `scripts/agent-gate.test.ts`; тесты пакета `src/cli/dmg-core-cli.test.ts`, `src/cli/main.test.ts`, `scripts/docs-check.test.ts`.
4. **Версия пакета `0.1.1`:** запись в `decisions.md` пакета, `agents/README.md` (таблица ролей, порядок среза) и `README.md` актуальны. Без публикации; подключение `file:` (D-61), SHA коммита пакета — в коммите u7-school.
5. **Новые имена во всех живых ссылках:** `agents.md`, `agent-roles.md`, `migration.md` (§5, §6), `workflow.md`, `dmg-process.md`, `deepseek.md`, `rules.md`, `index.md`, скилы `conductor-newtrack` и `conductor-implement` (`.pi/skills`; `.claude/skills` — симлинк) и прочие живые документы; в пакете — `docs/decisions.md`, `docs/index.md`, `llms.txt`, `scripts/jsdoc-check.ts`. Не правятся исторические записи: `conductor/archive/`, `research/`, TR-записи `debt.md`, D-21 в `decisions.md`, `roadmap/` (там `reviewer` — переменная примера).
6. **`dmg-process.md` → `dmg-core/docs/process.md`** — без специфики проекта и conductor. `agents.md` и `agent-roles.md` ссылаются на документ пакета и оставляют только привязку к проекту. `migration.md` §5: перенос процесса и префикс сделаны этим треком, а не в конце перехода.
7. **Пилот ролей волны 1 закрыт:** строка «Пилот ролей» на каждый вызов не обязательна — правка `agents.md` и `agent-roles.md` §5: раздел ведётся только для ролей на пилоте (волна 3+).
8. **Подсказка `data-keeper` в гейте:** `scripts/agent-gate.ts` (чистая функция рядом с `packageDocsWarning`) пишет в stdout подсказку вызвать `dmg-data-keeper`, если изменённые не-тестовые `.ts` в `domain/` или `modules/` — `state.ts`/`*.state.ts`, `repo.ts`/`*.repo.ts`/`*-repo.ts` или `content-snapshot*.ts` (снимок контента лежит в живых данных потоков); `get-module-snapshot*` (чтение) — не триггер. Код выхода не меняется. По TDD.
9. **Пилотный срез на учебном модуле пакета** (критерий 6 agent-roles.md §5) — для двух сред, каждая в своём временном worktree `dmg-core` с ролями, доставленными `dmg-core sync` (`.claude/agents`, `.pi/agents`):
   - срез учебного модуля `todo`, меняющий `state` (чтобы сработал триггер `data-keeper`); конвейер: `dmg-tech-lead` (бриф) → `dmg-test-designer` (red) → `dmg-domain-author`/`dmg-api-author` (green) → `check` пакета → `dmg-data-keeper` → `dmg-reviewer`;
   - **Claude Code** — оркестратор Claude, участие Нурболата и основной сессии допустимо;
   - **pi** — максимально автономно: один запуск `pi -p` с заданием среза, основная сессия только запускает и читает итог, без вмешательства по ходу;
   - итог — раздел «Пилот волны 2» в `summary.md` трека: по каждой роли и среде критерии 1–5 и 6 (осмысленный отчёт без специфики u7-school), расход, найденные правки промптов; правки вносятся в роли пакета до закрытия трека;
   - код среза в пакет не коммитится; worktree удаляются после записи итога (с подтверждения Нурболата).

## Нефункциональные требования

- Без новых npm-зависимостей.
- `bun run check` зелёный в u7-school и в `dmg-core` (включая `dmg:check`, `agents:check`, `docs:covers`).
- Данные `data/` не затрагиваются.

## Критерии приёмки

1. В `dmg-core/agents/roles/` шесть ролей `dmg-*`; grep по их телам не находит специфики u7-school.
2. `dmg-core` `0.1.1`, `bun run check` пакета зелёный, решение в `decisions.md`.
3. В `.claude/agents/` и `.pi/agents/` — роли `dmg-*` (6), `migrator`, `documentarian`; старых имён нет; `dmg:check` и `agents:check` зелёные.
4. В живых документах и скилах нет старых имён ролей (grep, кроме исключений п. 5 требований).
5. `docs/process.md` есть в пакете, `dmg-process.md` удалён или сведён к ссылке; `migration.md` §5/§6 актуальны.
6. `agent-gate.ts` даёт подсказку по триггеру `data-keeper`, тест есть.
7. Пилотный срез пройден в Claude Code и pi; в `summary.md` — итог по ролям и средам; каждая роль дала осмысленный отчёт на учебном модуле (критерий 6) или есть решение Нурболата по ней.
8. `bun run check` u7-school зелёный, число тестов не меньше базовой линии.

## За рамками

- Волны 3–4 (`user`, `ux`, `product`, `architect`, `access-auditor`), перенос `documentarian` в пакет.
- Публикация `dmg-core`.
