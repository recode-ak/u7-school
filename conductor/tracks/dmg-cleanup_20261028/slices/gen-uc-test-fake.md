# Срез: шаблон теста UC в `gen` на фейке

Трек: [dmg-cleanup_20261028](../plan.md), Фаза 2, задача «Шаблон теста UC в `gen` на фейке». Спецификация — [spec.md](../spec.md) ФР-2. Образцы: [memory-repo.md](./memory-repo.md) (API `MemoryRepo`), [uc-tests-fake.md](./uc-tests-fake.md) (фейк порта `task.repo.fake.ts` и переведённые тесты UC учебного модуля).

## Где работать

- Репо пакета: `~/dev/tools/dmg/dmg-core` (не `node_modules`), абсолютные пути при записи.
- `src/gen/kinds/app-aggregate.ts` (+ тест): генерирует ещё и фейк порта — `src/<a>/<a>.repo.fake.ts`, класс `<A>RepoFake extends MemoryRepo<…> implements <A>Repo` (соглашение Нурболата: рядом с портом, суффикс `.fake`), `findById` через `restored`. Тип снапшота — как в учебном `task.repo.fake.ts` (`StateOf<typeof <A>ArDef>`: правило DOM-01 запрещает импорт state вне `infra/**` и тестов). Импорт `MemoryRepo` — из `dmg-core/testing`.
- `src/gen/kinds/operation.ts` (+ тест): шаблоны `createTest`/`updateTest` используют `<A>RepoFake` вместо `<A>JsonRepo` во временном каталоге: без `mkdtempSync`/`tmpdir`/`rmSync`/`afterEach`; начальное состояние update-теста — `seed`, проверки — `restored`/`saved`. Сценарии шаблонов те же.
- Если при генерации UC фейка нет (агрегат создан старой версией `gen`) — реши сам: создать фейк при генерации UC или эскалировать; обоснуй в отчёте.
- Не трогать: шаблоны ER/Job (`testDeps` — без репозитория), JSON-репозиторий и его контрактный тест в шаблоне, учебный модуль, документацию. Не коммитить, `conductor/` не трогать.

## TDD

1. Тесты генератора (`app-aggregate.test.ts`, `operation.test.ts`, при необходимости `e2e.test.ts`, снапшоты): ожидания нового вывода — **red**, запуск.
2. Шаблоны — **green**.
3. `bun run check` и `bun run e2e` пакета зелёные (e2e генерирует модуль у потребителя и гоняет тесты заготовок — значит, фейк и тест UC должны компилироваться и проходить на установленном пакете).

## Правила

`docs/naming.md` пакета (раскладка `gen`), `docs/testing.md` §4, API-03; простые типы, без `any` в сгенерированном коде (существующий `as Deps` в шаблоне — оставить как есть).

## Критерии приёмки

- `gen aggregate` создаёт `<a>.repo.fake.ts`; тесты UC из `gen uc` — на фейке, без временного каталога.
- `check` и `e2e` пакета зелёные.
- Отчёт: изменённые файлы, пример сгенерированного фейка и теста update (сокращённо), отклонения, эскалации.

## Отчёт автора

api-author (Opus), 2026-10-28. Пакет `dmg-core` `f61a212`.

- `app-aggregate.ts`: `gen aggregate` создаёт `src/<a>/<a>.repo.fake.ts` — `<A>RepoFake extends MemoryRepo<<A>Ar, StateOf<typeof <A>ArDef>> implements <A>Repo`, `findById` через `restored`.
- `operation.ts`: тесты create/update — на фейке, без `node:fs/os/path` и `afterEach`; update — `repo.seed(ar.snapshot())`, проверка `saved`; NOT_FOUND — `saved` пуст.
- Отклонение: `gen uc` сам создаёт фейк, если файла нет (агрегат от старого `gen`), с подсказкой дописать `find*` через `unanswered`; иначе тест заготовки не компилируется.
- Отклонение: правка `pair-rule.test.ts` — фейк исключён из сравнения пары контракт ↔ реализация.
- red: 9 падений; green. `check` пакета — 1261 pass / 0 fail; `e2e: ok` (сверил orchestrator).

## Отчёт ревьюера
