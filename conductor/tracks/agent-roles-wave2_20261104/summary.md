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
