# Срез: `MemoryRepo<A>` в `dmg-core/testing`

Трек: [dmg-cleanup_20261028](../plan.md), Фаза 2, задача «`MemoryRepo<A>` в `dmg-core/testing`». Спецификация — [spec.md](../spec.md) ФР-2.

## Где работать

- Репо пакета: `~/dev/tools/dmg/dmg-core` (не `node_modules/dmg-core` в u7-school).
- Новые файлы: `src/testing/memory-repo.ts`, `src/testing/memory-repo.test.ts`; экспорт — `src/testing/index.ts`.
- Чужое не трогать: тесты UC/ER/Job примера, `app.fixture.ts` (`MemoryTasks`), гайды и `testing.md` — это следующие задачи плана.
- Не коммитить (коммит делает orchestrator).

## Что сделать

Фейк репозитория для тестов UC/ER/Job: вместо JSON-файла во временном каталоге — память.

- Наследник `VersionedRepository<A>` (`src/app/uow/repository.ts`): `save` идёт через базовую сверку версии (D-36), то есть фейк ловит `VersionConflict` как настоящий репозиторий.
- Снапшоты в памяти (`ar.snapshot()` при записи); восстановление Ar из снапшота — функция, которую даёт тест/наследник (например `TaskAr.restore`). Ar после чтения — новый объект, не ссылка на записанный.
- `seed(...)` — начальные записи (снапшоты состояния) до вызова UC.
- Просмотр записанного: какие агрегаты сохранены через `save` (в т. ч. проверка «ничего не записано»). `seed` записью UC не считается.
- `failOn(uuid)` — `save` агрегата с этим uuid бросает ошибку (сбой записи; замена `FailingRepo` в тесте Job).
- `find*` фейк **не реализует**: метод порта модуля (`findById`, `findDone`, …) получает готовый ответ, заданный тестом — по образцу `StubFacade.answer` (`src/testing/stub-facade.ts`). Корректность выборки проверяет контрактный тест настоящего репозитория, не фейк. Удобство `findById` по uuid из `seed`/записанного — на усмотрение автора, если это не превращается в реализацию выборки; решение обосновать в отчёте.
- Фейк должен подставляться в порт модуля типа `TaskRepo` (`src/testing/example/app/todo/task/task.repo.ts`) без `any` и кастов. Как именно (наследник с методами порта, фабрика, generic по порту) — выбери самый простой вариант, покажи в отчёте пример использования для `TaskRepo`.

Ограничения: без новых зависимостей, без type-level трюков; ООП — класс с API и зоной ответственности; комментарии и JSDoc на русском, как в `stub-facade.ts`.

## TDD (по шагам)

1. Тесты `memory-repo.test.ts` (агрегат — учебный `TaskAr` или тестовый, как удобнее): round trip (save → find через ответ/seed → тот же снапшот, новый объект), конфликт версии (`VersionConflict`), `seed`, записанное (включая «ничего не записано»), `failOn`, заданный ответ `find*`. Запусти — **red**.
2. Реализация, экспорт из `dmg-core/testing`. Запусти — **green**.
3. В конце — `bun run check` в репо пакета зелёный.

## Правила

Проверить по `docs/rules.md` пакета применимые ID (типизированные моки без `any` — `testing.md` §4; API-03 — порт принимает и возвращает Ar).

## Критерии приёмки

- Тесты из шага 1 есть и зелёные; `bun run check` пакета зелёный.
- `MemoryRepo` экспортирован из `dmg-core/testing`.
- В отчёте: API класса, пример для `TaskRepo`, отклонения от брифа и почему.

## Отчёт автора

api-author (Opus), 2026-10-28. Пакет `dmg-core` `da9e9a6`.

- `src/testing/memory-repo.ts`: `MemoryRepo<A extends MemoryAr<S>, S extends MemorySnapshot>` — наследник `VersionedRepository<A>`; `constructor(aggregate, restore)`, `seed(...s): this`, `failOn(uuid): this`, `saved` (снапшоты из `save`, без `seed`), `restored(uuid)` / `restoredOrThrow(uuid)` — новый Ar из памяти, `protected unanswered<P, R>(method)` — метод порта без ответа бросает понятную ошибку.
- `find*` — присваиванием типизированного поля наследника (`tasks.findDone = async () => […]`), а не `answer(name, fn)` как в `StubFacade`: иначе generic по порту, `keyof` и каст. Форма согласована с Нурболатом.
- `findById` — через `restored(uuid)` (чтение по ключу, не выборка).
- Тесты: `memory-repo.test.ts`, 11 шт.; red — `Cannot find module './memory-repo'`; green — 11 pass. `check` пакета — 1257 pass / 0 fail.

## Отчёт ревьюера

reviewer (Opus), 2026-10-28 — ревью всей Фазы 2 (срезы memory-repo, uc-tests-fake, er-job-tests-fake, gen-uc-test-fake; пакет `b001e0e..a32f3e4`, u7-school `9c108539..ab658e4c`). Блокеров (`error`) нет; сценарии тестов примера 1:1, решения Нурболата соблюдены. Проверены DOM-01, API-03, TST-03/04/05, ERR-04, `testing.md` §4.

| ID | файл:строка | суть | severity | решение |
|---|---|---|---|---|
| — | `src/testing/memory-repo.ts:26-35` | JSDoc-пример: `MemoryTaskRepo`/`TaskState` вместо `TaskRepoFake`/`StateOf` | warn | исправлено, dmg-core `3b9d7cd` |
| — | spec НФТ / `docs/decisions.md` пакета | новый API `dmg-core/testing` и `.repo.fake.ts` без D-NN | question | к Нурболату |
| DOM-01/ARC | `naming.md:59`, `gen/kinds/app-aggregate.ts` | фейк в рабочем `src`, импорт `dmg-core/testing` из нетестового кода не запрещён линтером | question | к Нурболату |
| TST-05 | `er/release-removed-user-tasks.er.test.ts:124` | имя «…файл не создан» устарело | info | к Нурболату |
| — | `memory-repo.test.ts:16-29` | копия `TaskRepoFake` под именем `MemoryTaskRepo` | info | оставлено |
| TST-04 | `uc/create-task.uc.test.ts:28-29` | ответ строится из `saved`, а не `restored` | info | оставлено |
| — | `memory-repo.ts:52-54` | `saved` отдаёт внутренний массив | info | оставлено |
| — | `gen/kinds/operation.ts:640-648` | фейк из `gen uc` для порта с `find*` не компилируется до дописывания | info | задокументировано, оставлено |
| — | u7-school `debt.md` DEBT-40 | у `wish` нет `wish.repo.fake.ts` | info | создаст `gen uc` при первом касании |
| — | `guides/aggregate.md:15`, `state.md:16`, `README.md:73` | перечни `gen aggregate` без фейка | info | оставлено |
