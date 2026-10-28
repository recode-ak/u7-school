# Срез: тесты UC учебного модуля на `MemoryRepo`

Трек: [dmg-cleanup_20261028](../plan.md), Фаза 2, задача «Перевод тестов UC примера». Спецификация — [spec.md](../spec.md) ФР-2. Предыдущий срез — [memory-repo.md](./memory-repo.md) (API фейка и отчёт).

## Где работать

- Репо пакета: `~/dev/tools/dmg/dmg-core` (не `node_modules`).
- Тесты: `src/testing/example/app/todo/task/uc/{create,complete,assign,get,list}-task.uc.test.ts`, `src/testing/example/app/users/user/uc/get-user.uc.test.ts`.
- Новые фейки портов (решение Нурболата): рядом с портом, файл `<агрегат>.repo.fake.ts`, класс `<Агрегат>RepoFake` — `src/testing/example/app/todo/task/task.repo.fake.ts` (`TaskRepoFake implements TaskRepo`), `src/testing/example/app/users/user/user.repo.fake.ts` (`UserRepoFake implements UserRepo`). Наследник `MemoryRepo` из `#core/testing/...`; `findById` — через `restored`, прочие `find*` — `unanswered`, ответ задаёт тест присваиванием.
- Не трогать: код UC, тесты ER/Job (следующая задача — но фейк `TaskRepoFake` они будут переиспользовать), smoke модуля и контрактные тесты репозиториев, `app.fixture.ts`, документацию.
- Не коммитить, `conductor/` не трогать.

## Что сделать

Тесты UC перестают писать JSON во временный каталог: вместо `TaskJsonRepo` + `mkdtemp` — `TaskRepoFake` с `seed`; проверки состояния — через `saved`/`restored`; «ничего не записано» — `saved` пуст.

**Сценарии сохраняются 1:1.** Это перенос, не перепроектирование: каждый `it` старого файла остаётся (то же имя, тот же смысл проверки). Новые сценарии не добавлять, старые не удалять и не объединять. Если сценарий без настоящего репозитория теряет смысл (проверяет выборку или файл) — не удаляй, а эскалируй в отчёте.

## Порядок

1. Перед правкой: выпиши список `describe`/`it` всех 6 файлов (команда вроде `grep -n "it(\|describe(" …`) — это опорный список.
2. Фейки портов (`*.repo.fake.ts`) — без отдельных тестов: их поведение покрыто тестами `MemoryRepo`; если появится собственная логика сверх `restored`/`unanswered` — нужен тест.
3. Переводи файлы по одному, после каждого — `bun test <файл>` зелёный.
4. Сверка: тот же список `it` после перевода; в отчёт — таблица «файл | было it | стало it».
5. `bun run check` пакета зелёный.

## Правила

`docs/testing.md` §4 (моки типизированы, без `any` и кастов), API-03 (порт принимает и возвращает Ar). Простые типы, без type-level трюков.

## Критерии приёмки

- 6 файлов на фейках, без `mkdtemp`/`tmpdir`/JSON-репозитория; число и имена `it` совпадают.
- `bun run check` пакета зелёный.
- Отчёт: таблица сверки, отклонения, эскалации.

## Отчёт автора

migrator (Opus), 2026-10-28. Пакет `dmg-core` `7a559c2`.

| файл | было it | стало it |
|---|---|---|
| create-task | 2 | 2 |
| complete-task | 7 | 7 |
| assign-task | 10 | 10 |
| get-task | 5 | 5 |
| list-tasks | 3 | 3 |
| get-user | 6 | 6 |

Имена `it` совпадают дословно (сверил orchestrator). `check` пакета — 1257 pass / 0 fail.

- Фейки: `task/task.repo.fake.ts` (`TaskRepoFake`), `users/user/user.repo.fake.ts` (`UserRepoFake`); своей логики нет — тестов нет.
- Отклонение: тип снапшота — `StateOf<typeof TaskArDef>` вместо импорта `todo/state`: DOM-01 (biome) запрещает прямой импорт state в `example/app/**` кроме тестов и `infra/**`. `biome.json` не трогали.
- Отклонение: в get-user «query ничего не пишет» добавлена проверка `saved` пуст (прежняя осталась).
- Ожидаемо по ФР-2: в list-tasks и create-task отбор «неархивные, владельца» делает ответ теста; выборку покрывает контрактный тест `todo/infra/task.json-repo.test.ts`.

## Открытые вопросы

- Считать ли `*.repo.fake.ts` адаптером (исключение в DOM-01, как `infra/**`)? Пока обход через `StateOf` работает; вопрос — к задаче документации (naming.md).

## Отчёт ревьюера
