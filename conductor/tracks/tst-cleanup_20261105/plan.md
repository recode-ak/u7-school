# Plan: tst-cleanup_20261105

## Точка продолжения

> Обновляется в каждом коммите шага. При возврате — читать этот блок и `git log main..tst-cleanup`.

- **Сделано:** Ф0; Ф1 (закономерности Б-1…Б-13, правила TST-09 / D-67, `ui/bot-test.md` §2 п. 5); Ф2 `wish` (348 → 237 домен+модуль, e2e −1); Ф2 `stream` — домен 416 → 263, модуль 226 → 112, бот 335 → 252; покрытие строк не упало; `check` 4432 pass / 29 fail (TR-57, новых нет).
- **Дальше:** Ф2 `questionnaire` — сначала инвентаризация (Ф1 её не делала: промпт по образцу `inventory/prompt-stream-*.md`, но сразу с Б-ID), затем таблица и удаление как у `stream`; перед этим снять покрытие в `.cache/cov/`. Отложено до `course-dmg`: `wish-questionnaire.e2e.test.ts:460` (слить в `wish-flow.integration.test.ts:251`), `student-dmg.e2e.test.ts:122`, `:251`. Отложено «удалить с кодом» (Б-13): `domain/src/stream/status.test.ts:13`, `:28` — мёртвые экспорты `status.ts`, решение — к Нурболату.
- **Открытые вопросы к Нурболату:** нет.

---

Работа — в worktree `../u7-school-tst-cleanup` (ветка `tst-cleanup`); `main` не трогать ([spec.md](./spec.md)). Исполнитель flash — `bun run scripts/pi-role.ts <role> <prompt> --label <имя>`, один шаг — один `--label`; после запуска — проверка отчёта orchestrator, строка расхода в `summary.md`.

## Фаза 0: Трек и базовая линия

- [x] Task: Worktree, spec, plan, базовая линия числа тестов в `summary.md` (Opus)

## Фаза 1: Закономерности (wish, stream)

- [x] Task: Инвентаризация `wish` — домен, модуль, тесты бота (flash, только чтение): `inventory/wish.md`
- [x] Task: Проверка формата инвентаризации (Opus); при необходимости — правка промпта
- [x] Task: Инвентаризация `stream` — `stream-domain`, `stream-app`, `stream-bot` (flash, только чтение)
- [x] Task: Синтез (Opus, только по таблицам): новые закономерности с признаками поиска — `test-bloat.md` §2; правило — в `testing.md` пакета или проектный документ (по согласованию)
- [x] Task: Рекомендации для `course` и тестов бота по курсу — раздел `test-bloat.md` (Opus, по таблицам и выборочному чтению)

## Фаза 2: Чистка модулей

На модуль (`wish`, `stream`, `questionnaire`, `peer-review`, `user`, `dossier`): таблица удаления «тест → закономерность → где покрыт» (flash) → приёмка таблицы (Opus) → удаление по таблице (flash) → гейт: `bun test --coverage` затронутых исходников не ниже, `check` зелёный, `git diff --numstat` только тестовые файлы.

- [x] Task: `wish`
- [x] Task: `stream`
- [ ] Task: `questionnaire`
- [ ] Task: `peer-review`
- [ ] Task: `user`, `dossier`

## Фаза 3: Итог

- [ ] Task: Число тестов до/после, расход — `summary.md`; поправка базовой линии `course-dmg` (Opus)
- [ ] Task: Журнал `test-bloat.md` — отметки «почищено»; кандидат в `tracks.md` — снять или сузить до `course`
