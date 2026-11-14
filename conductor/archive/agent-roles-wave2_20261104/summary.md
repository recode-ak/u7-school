# Summary: agent-roles-wave2_20261104

## Базовая линия (2026-11-04)

| Репо | Команда | pass | fail | файлов |
|---|---|---|---|---|
| u7-school (`87f4845d`) | `CI=true bun test` | 3947 | 0 | 386 |
| dmg-core (`09005e1`) | `CI=true bun test` | 1397 | 0 | 132 |

## Фаза 1: роли в пакете

Коммиты пакета `3eb2461`, `de89c2f` (`dmg-core` 0.1.1, D-62 пакета): шесть ролей `dmg-*`, `docs/process.md` (`covers: agents/**`), `agents/README.md`, `docs/index.md`, `llms.txt`. `check` пакета зелёный, 1397 pass (= базовой линии). Grep специфики u7-school по `agents/roles` пуст.

Решение пакета — D-62: D-61 занят в u7-school (`file:`), по решению Нурболата номер не дублируется.

Специфика u7-school, снятая с ролей (→ `.agents-core/common.md`, Фаза 2):
- tech-lead: план — `conductor-newtrack`, бриф — `conductor-implement`; spec/plan — `conductor/tracks/<track>/`; проектные документы `conductor/architecture/`: `naming.md`, `migration.md`, `legacy.md`, `debt.md` (DEBT-ID, glob'ы «Места записей», TR); эталон `wish` (`domain/src/wish`, `modules/wish/src`), образец брифа `conductor/archive/golden-wish_20261020/slices/wish.md`; конвейер — `agents.md` §3, стратегическое — §9; репо пакета — путь из `file:` у `dmg-core` в `package.json`.
- test-designer: бриф `conductor/tracks/<track>/slices/<slice>.md`; эталон `wish`; поведение релиза — worktree `../u7-school-v0.2.6` (только чтение); тесты репозиториев — `DB_DIR=./data/fixtures`.
- data-keeper: фикстуры `data/fixtures/`; хранилище — JSON-файлы `data/`; правило данных — «Сервер и данные пользователей» `AGENTS.md`; бэкап — `docs/backup.md`, `bun run backup`.

## Пилот волны 2 (Фаза 3, 2026-11-04)

Сравнение сред и рекомендации — [research/agent-roles-pilot-2026-11.md](../../research/agent-roles-pilot-2026-11.md).

Срез «Отложить задачу до даты» в учебном модуле `todo` пакета (pilot-task.md). Worktree `~/dev/tools/dmg/dmg-core-pilot-{claude,pi}` от `de89c2f`. Артефакты лежат в `pilot/` каждого worktree: бриф, отчёты ролей, допущения, `result.md`.

### Среды и расход

| | Claude Code | pi |
|---|---|---|
| Запуск | `claude -p`, оркестратор Sonnet, `acceptEdits` с узким списком Bash | `pi -p`, оркестратор и роли на `deepseek-flash` |
| Вызовов ролей | 6, без повторов | 9: повторный вызов `test-designer`, два доп. вызова по итогам ревью и data-keeper |
| Время | ≈ 13 мин | ≈ 43 мин |
| Расход | $2.66 (Sonnet $2.09, Opus $0.57) | оркестратор $0.15; субагенты: 0.63M вход / 0.16M выход / 6.7M кэш (стоимость в сессии не записана) |
| Итоговый `check` | red: 2 теста `src/graph/domain-graph.test.ts`; `docs:*` не запущены (не было в списке прав) | red: те же 2 теста; остальное зелёное, 1415 pass |
| Конвейер до `dmg-reviewer` | пройден | пройден |

Оба красных теста — одна причина в пакете: `domain-graph.test.ts:247,302` перечисляет точный состав эталона `todo`. Любой новый UC учебного модуля требует правки `src/`, то есть выхода за границы среза.

### Роль × среда

| Роль | Claude Code | pi | Критерий 6 |
|---|---|---|---|
| `dmg-tech-lead` | бриф полный; нашёл `domain-graph.test.ts`, но предложил его править как «рекомендованный» вариант за границами; 5 из 6 вопросов с очевидным ответом оставил открытыми | бриф полный; не нашёл тесты вне модуля, закрепляющие его состав | да / да |
| `dmg-test-designer` | тесты не прошли `tsc` и biome — поправил api-author | не обновил тест-перечисление `task.errors.test.ts`, не прогнал biome; один повторный вызов | да / да |
| `dmg-domain-author` | верная эскалация по чужим тестам | верная эскалация, но без рекомендации по умолчанию | да / да |
| `dmg-api-author` | без замечаний | верная эскалация; заметил ошибку в инструкции оркестратора; ложная ссылка `(D-58)` в JSDoc | да / да |
| `dmg-data-keeper` | ценное: откат после первой отсрочки теряет её (репозиторий переписывает файл целиком) → бэкап | ценное: рекомендовал тест round-trip (принят); наблюдение вне среза не помечено как «не действие» | да / да |
| `dmg-reviewer` | 0 `error`; два `major` по документам вне границ (`docs/guides/events.md:26`, `module.md:29`); тест дочитан не до конца | 0 `error`, 1 `question`; не сверил ссылку `D-58` | да / да |

**Критерий 6:** все шесть ролей в обеих средах дали осмысленный отчёт на учебном модуле. Специфики u7-school в отчётах нет. Критерии 1–5 по одному прогону — предварительно: польза есть у каждой роли, шум малый, дублей с `dmg-reviewer` не замечено.

### Сбои автономности pi

- Расширение `.pi/extensions/subagent` не переносится в другой репо: импортирует `scripts/subagent-config.ts` и `scripts/subagent-gate.ts` u7-school, а гейт вызывает проектный `scripts/agent-gate.ts`. В worktree подложены копии и заглушка гейта (`bun run check`).
- `pi -p` из фоновой команды без `< /dev/null` висит, ожидая stdin.
- Без вмешательства по ходу: вопросов человеку не задавал, решения записал в `assumptions.md` (A1–A12). Отступление от задания: `git add -N` → `git restore --staged` для diffstat (индекс восстановлен). Отформатировал мою заглушку `scripts/agent-gate.ts` (A1).

### Сбои среды Claude Code (не промпты)

- `claude -p --permission-mode bypassPermissions` отклонён классификатором auto mode. В режиме `acceptEdits` с узким списком роли видели Bash «запрещённым» за пределами списка, а `docs:covers` и `docs:jsdoc` не запускались.
- Пустой `pilot/claude-run.json` (редирект вывода) ронял `biome check .`.

### Правки по итогу пилота

Пакет `6cfe5f2`:
- `common.md`: перед отчётом — `check` целиком, красный шаг скрывает следующие, эскалация — с рекомендацией.
- `dmg-tech-lead`: тесты, закрепляющие состав модуля; правка вне границ — не рекомендация.
- `dmg-test-designer`: перечисления состава модуля дописывает сам; линтер и типы по своим тестам.
- `dmg-reviewer`: дочитывать файлы, сверять `D-NN`, severity «вне границ».
- `dmg-data-keeper`: наблюдение вне среза — «не действие».
- `docs/process.md` §4: гейт после автора — по его области, полный `check` — до ревью; цепочка `&&` в `check` не меняется.
- `domain-graph.test.ts`: вхождение вместо точного состава `todo`. Тест детерминизма JSON поймал, что в Bun `toMatchObject` с `expect.arrayContaining` портит общий объект `graph`, поэтому проверки разделены. Со срезом pi-пилота: 1417 pass, 0 fail.

Долг: DEBT-49 в u7-school — расширение pi `subagent` не переносится; ждёт решения о доставке pi-расширения пакетом.

## Гейт закрытия (Фаза 6, 2026-11-04)

| Репо | pass | fail | файлов | к базовой линии |
|---|---|---|---|---|
| u7-school | 3959 | 0 | 386 | +12 (тесты `dataKeeperHint`) |
| dmg-core | 1397 | 0 | 132 | без изменений |

`git status data/` пуст; `dmg:check`, `agents:check` зелёные. Падений нет, триажа не требуется.

Критерии spec: 1 — шесть `dmg-*` в `agents/roles/`, grep по `u7-school|conductor|wish` пуст; 2 — `dmg-core` 0.1.1, D-62; 3 — `.claude/agents` и `.pi/agents`: шесть `dmg-*`, `migrator`, `documentarian`; 4 — grep старых имён вне `debt.md`/`decisions.md` пуст; 5 — `process.md` в пакете, `dmg-process.md` удалён, `migration.md` §5/§6 обновлены; 6 — `dataKeeperHint` + тесты (`70731b08`), ревью без `error`; 7 — пилот, раздел выше; 8 — число тестов не меньше базовой линии.
