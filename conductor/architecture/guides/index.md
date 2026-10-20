# Гайды по видам артефактов

**Назначение:** как написать артефакт DMG по эталону — модулю `wish` (трек `golden-wish`). Один файл на вид, формат — [_template.md](./_template.md). Ссылки на эталон и ID правил проверяет `scripts/guides-check.test.ts` (в `bun run check`).

---

| Вид | Гайд | Фаза трека |
|---|---|---|
| state | [state.md](./state.md) | 1 |
| aggregate | [aggregate.md](./aggregate.md) | 2 |
| events | — | 3 |
| errors | — | 4 |
| policy | — | 5 |
| repo / dcs / dqs | — | 6 |
| facade | — | 7 |
| use case (command, query) | — | 8–9 |
| event reaction | — | 10–11 |
| module | — | 12 |
| job | — (эталона нет) | 12 |

Без отдельного гайда: тесты — [testing.md](../testing.md); поля `F.*` и `shared/` — [manifests.md](../manifests.md) §3; генераторы — [naming.md](../naming.md) §5; UI — [ui-manifests.md](../ui-manifests.md).
