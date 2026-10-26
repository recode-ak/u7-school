# Гайды по видам артефактов

**Назначение:** как написать артефакт DMG по эталону — модулю `wish` (трек `golden-wish`). Один файл на вид, формат — [_template.md](./_template.md). Ссылки на эталон и ID правил проверяет `scripts/guides-check.test.ts` (в `bun run check`).

---

| Вид | Гайд | Фаза трека |
|---|---|---|
| state | [state.md](./state.md) | 1 |
| aggregate | [aggregate.md](./aggregate.md) | 2 |
| events | [events.md](./events.md) | 3 |
| errors | [errors.md](./errors.md) | 4 |
| policy | [policy.md](./policy.md) | 5 |
| repo / dcs / dqs | [repo.md](./repo.md) | 6 |
| facade (без манифеста, D-42) | [facade.md](./facade.md) | 7, 8 |
| use case (command, query) | [use-case.md](./use-case.md) | 8–9 |
| event reaction | [event-reaction.md](./event-reaction.md) | 10–11 |
| module | [module.md](./module.md) | 12 |
| job | [job.md](./job.md) (заготовка, эталона нет) | 12 |

Без отдельного гайда: тесты — [testing.md](../testing.md); поля `F.*` и `shared/` — [manifests.md](../manifests.md) §3; генераторы — [naming.md](../naming.md) §5; UI — [ui-manifests.md](../ui-manifests.md).
