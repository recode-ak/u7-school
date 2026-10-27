# Гайды по видам артефактов

**Назначение:** как написать артефакт DMG по образцу — учебному модулю пакета ([src/testing/example](../../src/testing/example/example.arch.ts): `todo` — задачи, `users` — пользователи). Один файл на вид, формат — [_template.md](./_template.md). Ссылки и ID правил во всей документации пакета проверяет `scripts/docs-check.test.ts` (в `check` пакета).

Раскладка примера: домен — `example/<m>/`, прикладной слой — `example/app/<m>/`, `ArchApp` — `example.arch.ts`. В проекте корни задаёт секция `gen` `dmg-core.json` ([naming.md](../naming.md) §5). Заготовки создаёт генератор `dmg-core gen <вид> …` (раздел «Команда» каждого гайда).

---

| Вид | Гайд | Образец |
|---|---|---|
| state | [state.md](./state.md) | `todo/task/task.state.ts` |
| aggregate | [aggregate.md](./aggregate.md) | `todo/task/task.ar.ts` |
| events | [events.md](./events.md) | `todo/task/task.events.ts` |
| errors | [errors.md](./errors.md) | `todo/task/task.errors.ts` |
| policy и доменные правила | [policy.md](./policy.md) | `todo/task/task.policy.ts`, `task.rules.ts` |
| repo / dcs / dqs | [repo.md](./repo.md) | `app/todo/task/task.repo.ts`, `todo/task-release.dcs.ts` |
| facade (без манифеста, D-42) | [facade.md](./facade.md) | `app/todo/todo.facade.test.ts` |
| use case (command, query) | [use-case.md](./use-case.md) | `todo/task/uc/*`, `app/todo/task/uc/*` |
| event reaction | [event-reaction.md](./event-reaction.md) | `release-removed-user-tasks.er.ts` |
| module | [module.md](./module.md) | `todo/todo.module.ts`, `todo/contract.ts` |
| job | [job.md](./job.md) | `archive-done-tasks.job.ts` |

Без отдельного гайда: тесты — [testing.md](../testing.md); поля `F.*` и `shared/` — [manifests.md](../manifests.md) §3; структура и имена — [naming.md](../naming.md).
