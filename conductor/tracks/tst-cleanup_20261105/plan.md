# Plan: tst-cleanup_20261105

## Точка продолжения

> Обновляется в каждом коммите шага. При возврате — читать этот блок и `git log main..tst-cleanup`.

- **Сделано:** Ф0; Ф1 (Б-1…Б-13, TST-09 / D-67, `ui/bot-test.md` §2 п. 5); Ф2 `wish`, `stream` (мёртвые экспорты `status.ts` удалены, Б-13); Ф2 `questionnaire` (мёртвый код `QuestionnaireEngine.getQuestionText/getAnswerText/getChoices` и экспорт `inviteKeyboard` удалены, Б-13; новая закономерность Б-14 — `test-bloat.md` §2) — домен 213 → 126, модуль 113 → 39, бот 134 → 88; покрытие собственных исходников не упало; `check` 4223 pass / 29 fail (TR-57, новых нет).
- **Дальше:** Ф2 `peer-review` — таблицы приняты (`inventory/peer-review-*-delete.md`), покрытие «до» в `.cache/cov/peer-review-*.before.txt`; применение: домен ‖ бот, затем модуль (`inventory/prompt-peer-review-*-apply.md`); после — мёртвый код `hasParticipant`, `authorLine` (Б-13), решение по `onlyLives` (вход UC не читается). Отложено до `course-dmg`: `wish-questionnaire.e2e.test.ts:460` (слить в `wish-flow.integration.test.ts:251`), `student-dmg.e2e.test.ts:122`, `:251`; `questionnaire-ux.e2e.test.ts` целиком (после `course-dmg` 4 из 5 — дубли, см. `questionnaire-bot-delete.md` «Итог»); `modules/questionnaire/src/questionnaire.module.test.ts:169` с `probe`-модулем (покрытие — красный `wish-questionnaire.e2e.test.ts:253`).
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
- [x] Task: `questionnaire`
- [ ] Task: `peer-review`
- [ ] Task: `user`, `dossier`

## Фаза 3: Итог

- [ ] Task: Число тестов до/после, расход — `summary.md`; поправка базовой линии `course-dmg` (Opus)
- [ ] Task: Журнал `test-bloat.md` — отметки «почищено»; кандидат в `tracks.md` — снять или сузить до `course`
