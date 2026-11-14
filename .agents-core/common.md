## Правила проекта u7-school

Дополняют общие правила `dmg-core` выше. Процесс и роли — `conductor/architecture/agents.md`.

### Перед началом

- Бриф среза — `conductor/tracks/<track>/slices/<slice>.md` (или текст вызова orchestrator).
- Прочитай `.claude/skills/architecture/SKILL.md`: он выбирает режим (UI или DMG) и ведёт в документы. Документация платформы — `node_modules/dmg-core/docs/` (пакет правится в своём репо, не в `node_modules`); проектные документы — `conductor/architecture/`.
- Всё на русском: отчёт, комментарии в коде, документация. Код и имена API — как есть.

### Запрещено

- Править `plan.md`, `tracks.md` и другие файлы `conductor/`, кроме брифа, если orchestrator прямо поручил.
- Трогать `data/`: читать живые данные, писать, удалять, запускать seed и миграции.

### Остановись и верни эскалацию, если

- задача требует любого действия с `data/`;
- появляется вызов фасада, меняющий чужой модуль, а бриф не фиксирует для него выбранное место (D-41, `conductor/architecture/decisions.md`).

### Документы и эталоны проекта

- Spec и план трека — `conductor/tracks/<track>/{spec,plan}.md`, бриф среза — `conductor/tracks/<track>/slices/<slice>.md`. План готовится в `conductor-newtrack`, брифы — в `conductor-implement` в начале фазы; конвейер ролей — `conductor/architecture/agents.md` §3, стратегические вопросы — §9.
- Проектные документы — `conductor/architecture/`: `index.md` (раскладка монорепо и состояние), `naming.md` (генератор в проекте); долг — `conductor/debt/` (`README.md` — правила и форматы реестров, `code.md` — `C-DEBT-<n>`: Место, Признак, Корень).
- Эталон проекта — модуль `wish` (`domain/src/wish`, `modules/wish/src`); формат брифа — `conductor/architecture/agents.md` §5, свежие образцы — `slices/` текущих треков.
- Эталон поведения при переносе — релиз в worktree `../u7-school-v0.2.6` (только чтение).
- Репо пакета `dmg-core` — `~/dev/tools/dmg/dmg-core` (GitHub `recode-ak/dmg-core`); версия у потребителя — тег `#vX.Y.Z` в `package.json`.
- Лишние тесты (TST-08) — реестр `conductor/debt/tests.md` (каталог признаков `Б-1…Б-19` — `conductor/debt/README.md` §3.1): замеченный вне задачи случай пиши в отчёт строкой «Кандидат в чистку тестов: файл — что дублирует», в реестр его переносит orchestrator.

### Данные проекта (dmg-test-designer, dmg-data-keeper)

- Хранилище — JSON-файлы в `data/` (`DB_DIR`). Тесты репозиториев — на `DB_DIR=./data/fixtures` или во временном каталоге; фикстуры формата записей — `data/fixtures/`.
- Правило живых данных — раздел «Сервер и данные пользователей» `AGENTS.md`; бэкап перед выкаткой — `bun run backup`, порядок и восстановление — `docs/backup.md`.

### Ревью в проекте (dmg-reviewer)

- Эталон проекта для сверки — модуль `wish` (вместе с учебным модулем пакета).

### Команды проекта

- `check` проекта — `bun run check`.
- Генератор — `bun run gen …` = `dmg-core gen …` из документации пакета; раскладка проекта и заготовка нового прикладного пакета — `conductor/architecture/naming.md`.
- Неожиданная ошибка инструмента — сначала `chronicle search "<дословный текст ошибки>"`.
