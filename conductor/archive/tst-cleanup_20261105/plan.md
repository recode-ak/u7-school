# Plan: tst-cleanup_20261105

## Точка продолжения

> Обновляется в каждом коммите шага. При возврате — читать этот блок и `git log main..tst-cleanup`.

- **Сделано:** Ф0–Ф3; Ф1 (Б-1…Б-13, TST-09 / D-67, `ui/bot-test.md` §2 п. 5); Ф2 `wish`, `stream` (мёртвые экспорты `status.ts` удалены, Б-13); Ф2 `questionnaire` (мёртвый код `QuestionnaireEngine.getQuestionText/getAnswerText/getChoices` и экспорт `inviteKeyboard` удалены, Б-13; новая закономерность Б-14 — `test-bloat.md` §2) — домен 213 → 126, модуль 113 → 39, бот 134 → 88; покрытие собственных исходников не упало; Ф2 `peer-review` — домен 184 → 72, модуль 141 → 73, бот 127 → 104; мёртвый код `hasParticipant`, `authorLine` и вход `onlyLives` у `GetMyCampaignsUcDef` удалены (Б-13, TR-38 п. 3); новые Б-15, Б-16 (`test-bloat.md` §2); покрытие собственных исходников не упало; Ф2 `user`, `dossier` — домен 70 → 33, модуль 103 → 67, бот 15 → 10; мёртвый код `UserPolicy.canRead/canEdit/isSubscriber/isGuest/isStudent` и ветка `telegramId === undefined` в `notify.story.ts`, поля `total`/`appliedFilters` ответа `list-users` удалены (Б-13); `dossier` и `userFacade.notify` — задел, код остаётся; `check` 3943 pass / 29 fail (TR-57, новых нет).
- **Дальше:** трек закрыт (Ф3: итог −952 теста — `summary.md` «Итог трека»; журнал `test-bloat.md`; кандидат по `course` — в `tracks.md`). Остаётся слияние в `main` после закрытия `course-dmg` — по «Поправке базовой линии» в `summary.md`. Отложено до `course-dmg`: `wish-questionnaire.e2e.test.ts:460` (слить в `wish-flow.integration.test.ts:251`), `student-dmg.e2e.test.ts:122`, `:251`; `questionnaire-ux.e2e.test.ts` целиком (после `course-dmg` 4 из 5 — дубли, см. `questionnaire-bot-delete.md` «Итог»); `modules/questionnaire/src/questionnaire.module.test.ts:169` с `probe`-модулем (покрытие — красный `wish-questionnaire.e2e.test.ts:253`).
- **Открытые вопросы к Нурболату:** нет. (Решено 2026-11-06: Б-17 и кандидат type-tests (трек [type-tests_20261111](../type-tests_20261111/)); `total`/`appliedFilters` у `list-users` удалены.)

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
- [x] Task: `peer-review`
- [x] Task: `user`, `dossier`

## Фаза 3: Итог

- [x] Task: Число тестов до/после, расход — `summary.md`; поправка базовой линии `course-dmg` (Opus)
- [x] Task: Журнал `test-bloat.md` — отметки «почищено»; кандидат в `tracks.md` — снять или сузить до `course`
