# Job — гайд (заготовка)

**Назначение:** периодическая операция модуля — контракт `<N>JobDef = defineJob(...)` (`packages/domain/src/<m>/<a>/job/<n>.job.ts`) и реализация `<N>Job extends JobFromDef` (`packages/<m>/src/<a>/job/<n>.job.ts`).

> **Эталона нет:** у `wish` Job нет. Ориентир — [manifests.md](../manifests.md) (`defineJob`: `schedule`, `scans`, `calls`, `emits`) и учебный модуль `dmg-core`. Гайд дописывается по формату [_template.md](./_template.md) в первом модуле с Job.

---

## 1. Когда применять

- Действие по расписанию, без вызывающего и без события: обход агрегатов (`scans`), напоминания, архивация. Ответ на событие — ER ([event-reaction.md](./event-reaction.md)); действие человека — UC ([use-case.md](./use-case.md)).

## 2. Команда

`bun run gen job <m>.<a> <имя> --write` — пара Def + реализация с тестами, строки в `<M>ModuleDef.jobs` и в карте модуля ([module.md](./module.md)).

## 3. Ориентир

- [archive-done-tasks.job.ts (Def)](../../../packages/dmg-core/src/testing/example/todo/task/job/archive-done-tasks.job.ts), [archive-done-tasks.job.ts (реализация)](../../../packages/dmg-core/src/testing/example/app/todo/task/job/archive-done-tasks.job.ts).
- Запуск — `ModuleFromDef.runJob`, след — `Trace.forJob`; в legacy-приложении — общий планировщик `ApiApp` (`legacyJob`).

## 4. Чеклист правил

- API-01 — Job техничен: отбор и решение — домен (метод Ar, DCS).
- MAN-04, MAN-05 — только события из `emits`, вызовы из `calls`.
