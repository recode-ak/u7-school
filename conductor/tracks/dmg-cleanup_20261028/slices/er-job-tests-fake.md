# Срез: тесты ER и Job учебного модуля на `TaskRepoFake`

Трек: [dmg-cleanup_20261028](../plan.md), Фаза 2, задача «Перевод тестов ER и Job примера». Спецификация — [spec.md](../spec.md) ФР-2. Образец — предыдущий срез [uc-tests-fake.md](./uc-tests-fake.md) (уже переведённые тесты UC и `task.repo.fake.ts`), API фейка — [memory-repo.md](./memory-repo.md).

## Где работать

- Репо пакета: `~/dev/tools/dmg/dmg-core` (не `node_modules`), абсолютные пути при записи.
- Тесты: `src/testing/example/app/todo/task/er/release-removed-user-tasks.er.test.ts` (`test(...)`, в т. ч. `expectIdempotentReaction`), `src/testing/example/app/todo/task/job/archive-done-tasks.job.test.ts` (`it(...)`).
- Фейк — готовый `TaskRepoFake` (`src/testing/example/app/todo/task/task.repo.fake.ts`); класс `FailingRepo` в тесте Job заменить на `failOn(uuid)`.
- Не трогать: код ER/Job, тесты UC, `task.repo.fake.ts` (если нужна правка — эскалация), smoke модуля, контрактные тесты репозиториев, документацию. Не коммитить, `conductor/` не трогать.

## Что сделать

Как в срезе UC: без `mkdtemp`/`tmpdir`/`TaskJsonRepo`; начальное состояние — `seed`, после — `restored`/`saved`; ответы `find*` (`findActiveByParticipant`, `findDone`) — присваиванием в тесте.

**Сценарии 1:1:** каждый `test`/`it` остаётся с тем же именем и смыслом; новых не добавлять, старых не удалять. Если сценарий теряет смысл без настоящего репозитория — не удаляй, эскалируй в отчёте.

## Порядок

1. Список `describe`/`test`/`it` обоих файлов до правки.
2. Перевод по файлу, после каждого `bun test <файл>` зелёный.
3. Сверка списков; `bun run check` пакета зелёный.

## Правила

`docs/testing.md` §4, API-03; без `any` и кастов, простые типы.

## Критерии приёмки

- Оба файла на фейке, `FailingRepo` удалён; число и имена тестов совпадают.
- `bun run check` пакета зелёный.
- Отчёт: таблица сверки, отклонения, эскалации.

## Отчёт автора

migrator (Opus), 2026-10-28. Пакет `dmg-core` `1df1d03`.

- ER: 4 теста, Job: 3 теста — имена совпадают дословно (сверил orchestrator); `expect` 22 → 24 (добавлены проверки `saved`). `check` пакета — 1257 pass / 0 fail.
- `FailingRepo` → `failOn(uuid)`; начальное состояние — `seed`, ответы `findActiveByParticipant`/`findDone` — присваиванием в тесте.
- Имя теста ER «задач нет — Ok, файл не создан» оставлено (1:1), проверка — `saved` пуст.
- «Повторный прогон» Job теперь проверяет логику Job при заданном ответе (ответ фильтрует `isDone()`); выборку покрывает контрактный тест репозитория.

## Открытые вопросы

- Переименовать «файл не создан» в «ничего не записано»? Мелочь, на ревью.

## Отчёт ревьюера
