# Plan: agents-setup_20261017

## Фаза 1: Единый источник ролей и генератор [checkpoint: ddcacf5]

- [x] Task: Формат источника и таблицы соответствия [f75cca9]
    - [x] Формат frontmatter `.agents-core/roles/<role>.md`: `name`, `description`, `tools` (нейтральные имена), `model: { claude?, pi? }`
    - [x] Соответствие инструментов: `read→Read`, `edit→Edit`, `write→Write`, `bash→Bash`, `grep→Grep`, `find→Glob` (Claude Code); pi — как есть
- [x] Task: Генератор `scripts/agents-sync.ts` [a9a4095]
    - [x] Тесты (Red): разбор frontmatter; перевод инструментов и модели под каждую среду; неизвестный инструмент — ошибка с именем файла; `--check` находит расхождение, лишний и недостающий файл
    - [x] Реализация (Green): чистые функции «источник → текст копии» + тонкий слой записи/сравнения; без новых зависимостей
    - [x] Рефакторинг, покрытие >80% (93%)
- [x] Task: Подключение [d44d0c4]
    - [x] `agents:sync` и `agents:check` в `package.json`; `agents:check` — в `check`
    - [x] Шапка сгенерированных файлов «не править, источник `.agents-core/roles/<role>.md`» (сделана в a9a4095: по ней sync отличает свои копии)
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: Тексты ролей [checkpoint: 3210d3f]

- [x] Task: `reviewer` — только чтение; diff среза по правилам с проверкой `review` из `rules.md`; отчёт `ID | файл:строка | суть | severity`; код не исправляет [93aec10]
- [x] Task: `migrator` — перенос с сохранением поведения; `legacy.md`, `migration.md`; тесты переносятся, не удаляются [0c04a1a]
- [x] Task: `domain-author` — Ar, Policy, DCS/DQS, Def, unit-тесты домена; пометка «доработать на golden-wish» [55ebb3f]
- [x] Task: `api-author` — UC/ER/Job, репозитории, фасады, wiring; пометка «доработать на golden-wish» [c10518a]
- [x] Task: Общий блок ролей: условия остановки (agents.md §7), запрет коммитов и правки `plan.md`, формат отчёта, загрузка скилла `architecture` [c1ccb56]
- [x] Task: `bun run agents:sync`; роли видны в `/agents` Claude Code [c10518a]
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Гейт по затронутым пакетам и хук Claude Code [checkpoint: 48d9dbd]

- [x] Task: Скрипт `scripts/agent-gate.ts` [f0ef107]
    - [x] Тесты (Red): изменённые пути → пакеты; транзитивные зависимые по workspace-зависимостям; корневые конфиги → полный `check`; только `.md` → пропуск; нет изменений → пропуск; зелёный → exit 0; красный → exit 2 и хвост вывода в stderr
    - [x] Реализация (Green): чистые функции (пути → план прогона) + тонкий слой запуска
    - [x] Рефакторинг, покрытие >80% (89,7%)
- [x] Task: Хук `SubagentStop` в `.claude/settings.json` (через скилл `update-config`) [9b252cd]
- [x] Task: Пробный прогон: субагенту — заведомо красная правка; гейт возвращает ошибку, субагент исправляет (2026-10-18, без коммита: пробный файл удалён)
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: pi — субагенты и гейт

- [x] Task: Перенести официальный пример subagent-расширения в `.pi/extensions/subagent/` (проверить лицензию), по умолчанию `agentScope: "project"` [681b3c2]
- [x] Task: Гейт после субагента [6e72a59]
    - [x] Тесты (Red): «результат субагента + вывод гейта → итоговый ответ» (зелёный, красный, пропуск)
    - [x] Реализация: вызов `agent-gate.ts`, логику не дублировать
- [x] Task: Модель субагентов в `.pi/subagent.json` (по умолчанию `deepseek/deepseek-flash`) [e9f86a6a]
- [x] Task: Пробный прогон в pi (выполняет Нурболат): субагент запускается, результат гейта виден в ответе (2026-10-18: красный TS2322 → исправление migrator → зелёный; пробный файл удалён)
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Оркестратор и передача между средами

- [ ] Task: Режим оркестратора в `conductor-implement`: бриф среза, раздача ролям, гейт сам, единственный писатель `plan.md` и коммитов; простые legacy-задачи — без субагентов; полный `check` перед коммитом
- [ ] Task: Передача: шаг старта (`plan.md` + `git log`, приёмка чужой работы); шаг остановки (коммит + состояние незавершённой задачи в `plan.md`)
- [ ] Task: Обновить `agents.md` §8 и `index.md` по факту; `tech-stack.md` — агентная инфраструктура
- [ ] Task: Пробная передача: задача начата в одной среде, принята в другой
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)
