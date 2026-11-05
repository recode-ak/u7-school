# Plan: tst-cleanup_20261105

## Точка продолжения

> Обновляется в каждом коммите шага. При возврате — читать этот блок и `git log main..tst-cleanup`.

- **Сделано:** Ф0 — трек, базовая линия.
- **Дальше:** Ф1 — инвентаризация `wish` (`--label T1-inv-wish`, промпт `inventory/prompt-wish.md`).
- **Открытые вопросы к Нурболату:** нет.

---

Работа — в worktree `../u7-school-tst-cleanup` (ветка `tst-cleanup`); `main` не трогать ([spec.md](./spec.md)). Исполнитель flash — `bun run scripts/pi-role.ts <role> <prompt> --label <имя>`, один шаг — один `--label`; после запуска — проверка отчёта orchestrator, строка расхода в `summary.md`.

## Фаза 0: Трек и базовая линия

- [x] Task: Worktree, spec, plan, базовая линия числа тестов в `summary.md` (Opus)

## Фаза 1: Закономерности (wish, stream)

- [ ] Task: Инвентаризация `wish` — домен, модуль, тесты бота (flash, только чтение): `inventory/wish.md`
- [ ] Task: Проверка формата инвентаризации (Opus); при необходимости — правка промпта
- [ ] Task: Инвентаризация `stream` — `stream-domain`, `stream-app`, `stream-bot` (flash, только чтение)
- [ ] Task: Синтез (Opus, только по таблицам): новые закономерности с признаками поиска — `test-bloat.md` §2; правило — в `testing.md` пакета или проектный документ (по согласованию)
- [ ] Task: Рекомендации для `course` и тестов бота по курсу — раздел `test-bloat.md` (Opus, по таблицам и выборочному чтению)

## Фаза 2: Чистка модулей

На модуль (`wish`, `stream`, `questionnaire`, `peer-review`, `user`, `dossier`): таблица удаления «тест → закономерность → где покрыт» (flash) → приёмка таблицы (Opus) → удаление по таблице (flash) → гейт: `bun test --coverage` затронутых исходников не ниже, `check` зелёный, `git diff --numstat` только тестовые файлы.

- [ ] Task: `wish`
- [ ] Task: `stream`
- [ ] Task: `questionnaire`
- [ ] Task: `peer-review`
- [ ] Task: `user`, `dossier`

## Фаза 3: Итог

- [ ] Task: Число тестов до/после, расход — `summary.md`; поправка базовой линии `course-dmg` (Opus)
- [ ] Task: Журнал `test-bloat.md` — отметки «почищено»; кандидат в `tracks.md` — снять или сузить до `course`
