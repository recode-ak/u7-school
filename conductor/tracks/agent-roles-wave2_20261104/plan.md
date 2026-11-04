# Plan: agent-roles-wave2_20261104

Каждая задача кода идёт по TDD: red → запуск → green. Правка платформы — в репо `~/dev/tools/dmg/dmg-core` отдельным коммитом, его SHA — в коммите u7-school (`conductor/architecture/index.md`, «Правка платформы `dmg-core`»). Порядок доставки ролей: `bun install` → `bun run dmg:sync` → `bun run agents:sync`.

Черновик — роль `tech-lead` (2026-11-04): расхождения spec с кодом внесены в [spec.md](./spec.md) (п. 3, 3а, 5, 8).

## Фаза 1: Роли в пакете `dmg-core` [checkpoint: 233ac950]

- [x] Task: Базовая линия: `CI=true bun test` в u7-school и в пакете — числа в `summary.md` 5f1970fd
- [x] Task: Тесты пакета на шесть ролей `dmg-*` (red) dmg-core@3eb2461
    - [x] `src/cli/dmg-core-cli.test.ts` — список ролей настоящего пакета
    - [x] `src/cli/main.test.ts` — `dmg-reviewer.md`
    - [x] `scripts/docs-check.test.ts` — путь `agents/roles/dmg-reviewer.md`
    - [x] Запуск: тесты красные
- [x] Task: Переименовать `domain-author`, `api-author`, `reviewer` → `dmg-*` (файлы, `name:`, ссылки между ролями, `scripts/jsdoc-check.ts`); тесты зелёные dmg-core@3eb2461
- [x] Task: Перенести каркас `dmg-tech-lead`, `dmg-test-designer`, `dmg-data-keeper` без специфики u7-school (модель — Sonnet); специфику выписать для `.agents-core/common.md` dmg-core@3eb2461
- [x] Task: `docs/process.md` из `conductor/architecture/dmg-process.md` без проекта и conductor; `docs/index.md`, `llms.txt`, `covers:` dmg-core@3eb2461
- [x] Task: `agents/README.md` (таблица шести ролей, порядок среза), `README.md`, D-NN в `docs/decisions.md`, версия `0.1.1` dmg-core@3eb2461
- [x] Task: `bun run check` пакета, коммит в репо пакета, SHA dmg-core@3eb2461
- [x] Task: Conductor - User Manual Verification 'Фаза 1: Роли в пакете' (Protocol in workflow.md)

**Критерии приёмки:** в `agents/roles/` шесть ролей `dmg-*`; `grep -rE "wish|v0\.2\.6|data/|conductor|u7|backup|AGENTS|chronicle" agents/roles` пуст; `check` пакета зелёный (включая `docs:covers`); версия `0.1.1`, решение в `decisions.md`; тестов не меньше базовой линии.

## Фаза 2: Подключение в u7-school [checkpoint: ef47d87c]

- [x] Task: `bun install` → `bun run dmg:sync` → удалить проектные `.agents-core/roles/{tech-lead,test-designer,data-keeper}.md` → `bun run agents:sync` 3ae06948
- [x] Task: Специфику u7-school из Фазы 1 — в `.agents-core/common.md`; ссылки на роли в `.agents-core/README.md`, `common.md`, `migrator`, `documentarian` 3ae06948
- [x] Task: Зашитые имена ролей 3ae06948
    - [x] Red: `scripts/subagent-gate.test.ts` на `dmg-domain-author`, `dmg-api-author`
    - [x] Green: `GATED_AGENTS` и matcher `SubagentStop` в `.claude/settings.json` — одним коммитом
    - [x] Фикстуры `scripts/agents-sync.test.ts`, `scripts/agent-gate.test.ts`
- [x] Task: `bun run check`, коммит с SHA пакета 3ae06948
- [x] Task: Conductor - User Manual Verification 'Фаза 2: Подключение в u7-school' (Protocol in workflow.md)

**Критерии приёмки:** в `.agents-core/roles`, `.claude/agents`, `.pi/agents` по 8 ролей (6 `dmg-*`, `migrator`, `documentarian`); `dmg:check` и `agents:check` зелёные; `git diff dmg-core.json` пуст; grep старых имён по `scripts`, `.claude/settings.json`, `.agents-core`, `.claude/agents`, `.pi/agents` пуст.

## Фаза 3: Пилотный срез на учебном модуле

- [x] Task: Подготовка
    - [x] Два временных worktree пакета (`claude`, `pi`); в каждом `dmg-core.json` с целями `.claude/agents` / `.pi/agents` и `sync`
        - `~/dev/tools/dmg/dmg-core-pilot-{claude,pi}`, ветки `pilot/{claude,pi}` от `de89c2f`; самоссылка `node_modules/dmg-core → ..` (роли ведут в `node_modules/dmg-core/…`, в репо пакета его нет — решение Нурболата); в pi-worktree — копия `.pi/extensions/subagent`, `.pi/subagent.json`, `.pi/settings.json`; `check` в worktree зелёный (1397)
    - [x] Задание среза: [pilot-task.md](./pilot-task.md); Claude Code — headless `claude -p` из основной сессии (решение Нурболата): `todo`, изменение `state` (например, «отложить задачу до даты») — одно для обеих сред
- [x] Task: Прогон в Claude Code: сессия-оркестратор в worktree, конвейер `dmg-tech-lead` → `dmg-test-designer` → `dmg-domain-author`/`dmg-api-author` → `check` → `dmg-data-keeper` → `dmg-reviewer`; отчёты и расход
- [x] Task: Прогон в pi автономно: один `pi -p` с заданием среза; основная сессия только запускает и читает итог (сессия, diff, отчёты), по ходу не вмешивается
- [x] Task: Итог «Пилот волны 2» в `summary.md`: роль × среда, критерии 1–6, расход, сбои автономности pi
- [x] Task: Правки промптов по итогу — в пакет (коммит, SHA) → `dmg:sync` → `agents:sync` в u7-school
    - Пакет `6cfe5f2`: правки 5 ролей и `common.md`, `docs/process.md` §4 (гейт по области автора, красный шаг `check` скрывает следующие), `domain-graph.test.ts` — вхождение вместо точных списков `todo`
    - DEBT-49 (u7-school): расширение pi `subagent` привязано к скриптам u7-school
- [ ] Task: Удалить worktree — с подтверждения Нурболата
- [ ] Task: Conductor - User Manual Verification 'Фаза 3: Пилотный срез' (Protocol in workflow.md)

**Критерии приёмки:** обе среды прошли конвейер до отчёта `dmg-reviewer` или сбой описан; по каждой роли — вывод о критерии 6; код среза в пакет не попал; правки промптов доставлены, `dmg:check` зелёный.

## Фаза 4: Документы и скилы

- [ ] Task: Новые имена в `agents.md`, `agent-roles.md`, `migration.md`, `workflow.md`, `deepseek.md`, `rules.md`, `.pi/skills/conductor-{implement,newtrack}`
- [ ] Task: `dmg-process.md` → ссылка на `docs/process.md` пакета (или удалить с правкой ссылок в `index.md`, `agent-roles.md`, `migration.md`); в `agents.md`, `agent-roles.md` — только привязка к проекту
- [ ] Task: Закрыть пилот: `migration.md` §5, §6 (перенос сделан; следующий — `questionnaire` на ролях пакета), `agent-roles.md` §1 п. 6, §4 (волна 2), §5 (пилот — только волна 3+), `agents.md` (строка «Пилот ролей»)
- [ ] Task: Conductor - User Manual Verification 'Фаза 4: Документы и скилы' (Protocol in workflow.md)

**Критерии приёмки:** grep старых имён по живым файлам пуст (исключения — spec п. 5); ссылки на `dmg-process.md` живые; `migration.md` §5, §6 актуальны.

## Фаза 5: Подсказка `dmg-data-keeper` в гейте

- [ ] Task: Red: тесты `dataKeeperHint` в `scripts/agent-gate.test.ts` (`state`, `repo`, `-repo`, `content-snapshot` — подсказка; `*.test.ts`, `.md`, `get-module-snapshot*` — нет; код выхода не меняется)
- [ ] Task: Green: `dataKeeperHint` в `scripts/agent-gate.ts` рядом с `packageDocsWarning`, вызов в `import.meta.main`
- [ ] Task: Ревью diff — `dmg-reviewer`
- [ ] Task: Conductor - User Manual Verification 'Фаза 5: Подсказка в гейте' (Protocol in workflow.md)

**Критерии приёмки:** новые тесты есть и зелёные; `bun run check` зелёный.

## Фаза 6: Финал

- [ ] Task: Гейт закрытия: `CI=true bun test` в обоих репо, сравнение с базовой линией, триаж в `summary.md`; `git status data/` пуст
- [ ] Task: Сверка критериев spec 1–8
- [ ] Task: Conductor - User Manual Verification 'Фаза 6: Финал' (Protocol in workflow.md)

## Покрытие spec

| Критерий | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Фаза | 1 | 1 | 2 | 4 | 1, 4 | 5 | 3 | 6 |

## Риски

- Пилот до фазы документов: скилы conductor ещё зовут старые имена — между фазами 2 и 4 роли вызываются только по новым.
- `file:`: без `bun install` `dmg:check` видит старый `node_modules/dmg-core`.
- pi автономно может застрять на вопросе — в задании: не останавливаться, выбирать по рекомендации, записывать допущения.
