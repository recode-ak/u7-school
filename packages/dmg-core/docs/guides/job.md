# Job — гайд

**Назначение:** периодическая операция модуля — контракт `<N>JobDef = defineJob(...)` (`<domain>/<m>/<a>/job/<n>.job.ts`) и реализация `<N>Job extends JobFromDef` (`<app>/<m>/<a>/job/<n>.job.ts`).

---

## 1. Когда применять

- Действие по расписанию, без вызывающего и без события: обход агрегатов (`scans`), напоминания, архивация. Ответ на событие — ER ([event-reaction.md](./event-reaction.md)); действие человека — UC ([use-case.md](./use-case.md)).
- Job техничен (API-01): отбор — выборкой репозитория, решение — методом Ar или DCS.

## 2. Команда

`dmg-core gen job <m>.<a> <имя> --write` — пара Def + реализация с тестами, строки в `<M>ModuleDef.jobs` и в карте модуля ([module.md](./module.md)).

## 3. Образец

- [archive-done-tasks.job.ts (Def)](../../src/testing/example/todo/task/job/archive-done-tasks.job.ts): `schedule` (`dailyAt`, UTC), `scans: [TaskArDef]`, `emits: [TaskEvents.archived]`.
- [archive-done-tasks.job.ts (реализация)](../../src/testing/example/app/todo/task/job/archive-done-tasks.job.ts): `run(job)` → выборка `findDone` → `job.forEach` (UoW на запись) → `TaskAr.archive` → `uow.register`.
- [archive-done-tasks.job.test.ts](../../src/testing/example/app/todo/task/job/archive-done-tasks.job.test.ts): архив выполненных, повторный прогон пуст, сбой одной записи не прерывает обход (`failed: 1` и лог).
- Запуск — `ModuleFromDef.runJob`, след — `Trace.forJob` ([todo.module.test.ts](../../src/testing/example/app/todo/todo.module.test.ts)).

## 4. Чеклист правил

- API-01 — Job техничен: отбор и решение — домен (метод Ar, DCS).
- API-06 — Job идемпотентен; ошибка одной записи не прерывает обход; пороги — экспортируемые константы; расписания UTC.
- MAN-04, MAN-05 — только события из `emits`, вызовы из `calls`; MAN-13 — `scans` — агрегаты своего модуля.

## 5. Типичные ловушки

- Один UoW на весь обход → сбой одной записи откатывает остальные; `job.forEach` даёт UoW на каждую запись.
- Отбор «что пора обработать» `if`-ом в Job → выборка порта или метод-вопрос Ar.
- `Date.now()` внутри цикла → `this.now()`; порог — экспортируемая константа.

## 6. Как тестировать

Обработка подходящих записей и пропуск остальных; повторный прогон ничего не пишет; сбой одной записи — остальные обработаны, отчёт `failed` и `logger.error`; запуск через модуль — `runJob`. Репозиторий — во временном каталоге ([testing.md](../testing.md)).
