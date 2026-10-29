# Архитектура

**Назначение:** вход в техническую документацию u7-school. Платформа DMG (Domain Manifest Graph) документирована в пакете `dmg-core` — [node_modules/dmg-core/docs/index.md](../../node_modules/dmg-core/docs/index.md). Здесь — проектное: раскладка монорепо, переход, legacy, UI, процесс агентов, решения проекта.

> Статус: **переход идёт.** Эталонный модуль `wish` переведён на DMG (трек golden-wish); гайды по видам артефактов — в пакете ([guides/](../../node_modules/dmg-core/docs/guides/index.md)), образец — учебный модуль пакета. Состояние переноса — [migration.md](./migration.md) §6. Немигрированный код сопровождается по [legacy.md](./legacy.md). UI-слой — концепция в [ui-manifests.md](./ui-manifests.md), реализация позже.

---

## Раскладка монорепо

| Ось ([layers.md](../../node_modules/dmg-core/docs/layers.md)) | Пакеты u7-school |
|---|---|
| Платформа | `dmg-core` (репо `~/dev/tools/dmg/dmg-core`, в проекте — `node_modules/dmg-core`, D-55), приложение `@u7-scl/app`; legacy `@u7-scl/core`, legacy-ядро приложения `@u7-scl/app-legacy` (TR-33) и мосты `platform/core/src/legacy-bridge` |
| Домен | `@u7-scl/domain` (`domain/src/<m>`; вход модуля — `@u7-scl/domain/<m>/contract`) |
| Прикладной слой | `modules/<m>/src` (1:1 с модулем домена) |
| Входные адаптеры | `runners/*`: бот `u7-bot`, позже web и транспорты; операции — через `appApi` |

Правила с ID и их привязка к пакетам проекта — [rules.md](./rules.md).

## Начни отсюда

| Задача | Читай |
|---|---|
| Понять устройство DMG | [layers.md](../../node_modules/dmg-core/docs/layers.md) → [domain-modeling.md](../../node_modules/dmg-core/docs/domain-modeling.md) |
| Создать файл / объект | [naming.md пакета](../../node_modules/dmg-core/docs/naming.md), генератор в проекте — [naming.md](./naming.md) → [rules.md](./rules.md) |
| Написать артефакт по образцу | [guides/](../../node_modules/dmg-core/docs/guides/index.md) + эталон `wish` |
| Править немигрированный модуль | [legacy.md](./legacy.md) |
| Работать с ботом | [ui/](./ui/bot-architecture.md) |
| Работать агентом | [agents.md](./agents.md), [agent-roles.md](./agent-roles.md), скилы `architecture` и `dmg-architecture` |

## Правка платформы `dmg-core`

Пакет живёт в своём репо `~/dev/tools/dmg/dmg-core` и подключён как `file:` (D-55); `node_modules/dmg-core` — только для чтения.

Платформа (`dmg-core`, в будущем `dmg-ui`) развивается параллельно с u7-school: что нужно проекту и принадлежит платформе, правится в платформе, а не обходится в проекте. Агенты вправе править репо пакета по этому порядку; коммит в репо пакета делается отдельно, его SHA указывается в коммите u7-school.

1. Правка в репо пакета — по его TDD и документации (`docs/`, решения пакета — `docs/decisions.md`, долг — `debt.md` в корне репо).
2. В репо пакета зелёные `bun run check` и `bun run e2e`; коммит там.
3. В u7-school — `bun install` (новые файлы пакета подтягиваются только так), при изменении доставляемых документов, скилов и ролей — `bun run dmg:sync` и `bun run agents:sync`; `bun run check` зелёный; коммит, в сообщении — SHA коммита пакета.

Правка, нужная u7-school, но меняющая контракт пакета, — сначала решение в `docs/decisions.md` пакета. С релиза — тег пакета и `git+ssh` вместо `file:` (D-55).

## Документы проекта

**Решения и правила**
- [decisions.md](./decisions.md) — решения проекта D-NN (платформенные — [в пакете](../../node_modules/dmg-core/docs/decisions.md))
- [rules.md](./rules.md) — как каталог правил пакета применяется в проекте
- [naming.md](./naming.md) — генератор в проекте: раскладка `dmg-core.json`, новый прикладной пакет

**Переход и процесс**
- [migration.md](./migration.md) — треки перехода, что исправляется, сосуществование
- [legacy.md](./legacy.md) — паттерны немигрированного кода (удаляется после перехода)
- [debt.md](./debt.md) — реестр долга `DEBT-<n>` и тактических решений `TR-<n>`
- [agents.md](./agents.md) — роли агентов, контуры качества, связь с conductor, среды Claude Code и pi
- [agent-roles.md](./agent-roles.md) — новые роли агентов: состав, место в процессе, волны внедрения, критерии годности
- [docs-strategy.md](./docs-strategy.md) — доменная и техническая документация

**UI (Telegram-бот)**
- [ui-manifests.md](./ui-manifests.md) — манифесты UI (концепция): матрёшка, спецификация экранов из кода, граф UI
- [ui/bot-architecture.md](./ui/bot-architecture.md) — архитектура бота
- [ui/bot-ui-story.md](./ui/bot-ui-story.md) — Story
- [ui/bot-controller.md](./ui/bot-controller.md) — Controller
- [ui/bot-test.md](./ui/bot-test.md) — тестирование бота; тестовые миры — [../guides/test-worlds.md](../guides/test-worlds.md)
