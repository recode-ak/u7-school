# Архитектура

**Назначение:** вход в техническую документацию u7-school. Платформа DMG (Domain Manifest Graph) документирована в пакете `dmg-core` — [packages/dmg-core/docs/index.md](../../packages/dmg-core/docs/index.md) (после выноса пакета — `node_modules/dmg-core/docs/`). Здесь — проектное: раскладка монорепо, переход, legacy, UI, процесс агентов, решения проекта.

> Статус: **переход идёт.** Эталонный модуль `wish` переведён на DMG (трек golden-wish); гайды по видам артефактов — в пакете ([guides/](../../packages/dmg-core/docs/guides/index.md)), образец — учебный модуль пакета. Состояние переноса — [migration.md](./migration.md) §6. Немигрированный код сопровождается по [legacy.md](./legacy.md). UI-слой — концепция в [ui-manifests.md](./ui-manifests.md), реализация позже.

---

## Раскладка монорепо

| Ось ([layers.md](../../packages/dmg-core/docs/layers.md)) | Пакеты u7-school |
|---|---|
| Платформа | `dmg-core` (`packages/dmg-core`), приложение `@u7-scl/app`; legacy `@u7-scl/core` и мосты `packages/core/src/legacy-bridge` |
| Домен | `@u7-scl/domain` (`packages/domain/src/<m>`; вход модуля — `@u7-scl/domain/<m>/contract`) |
| Прикладной слой | `packages/<m>/src` (1:1 с модулем домена) |
| Входные адаптеры | `apps/*`: бот `u7-bot`, позже web и транспорты; операции — через `appApi` |

Правила с ID и их привязка к пакетам проекта — [rules.md](./rules.md).

## Начни отсюда

| Задача | Читай |
|---|---|
| Понять устройство DMG | [layers.md](../../packages/dmg-core/docs/layers.md) → [domain-modeling.md](../../packages/dmg-core/docs/domain-modeling.md) |
| Создать файл / объект | [naming.md пакета](../../packages/dmg-core/docs/naming.md), генератор в проекте — [naming.md](./naming.md) → [rules.md](./rules.md) |
| Написать артефакт по образцу | [guides/](../../packages/dmg-core/docs/guides/index.md) + эталон `wish` |
| Править немигрированный модуль | [legacy.md](./legacy.md) |
| Работать с ботом | [ui/](./ui/bot-architecture.md) |
| Работать агентом | [agents.md](./agents.md), скилы `architecture` и `dmg-architecture` |

## Документы проекта

**Решения и правила**
- [decisions.md](./decisions.md) — решения проекта D-NN (платформенные — [в пакете](../../packages/dmg-core/docs/decisions.md))
- [rules.md](./rules.md) — как каталог правил пакета применяется в проекте
- [naming.md](./naming.md) — генератор в проекте: раскладка `dmg-core.json`, новый прикладной пакет

**Переход и процесс**
- [migration.md](./migration.md) — треки перехода, что исправляется, сосуществование
- [legacy.md](./legacy.md) — паттерны немигрированного кода (удаляется после перехода)
- [debt.md](./debt.md) — реестр долга `DEBT-<n>` и тактических решений `TR-<n>`
- [agents.md](./agents.md) — роли агентов, контуры качества, связь с conductor, среды Claude Code и pi
- [docs-strategy.md](./docs-strategy.md) — доменная и техническая документация

**UI (Telegram-бот)**
- [ui-manifests.md](./ui-manifests.md) — манифесты UI (концепция): матрёшка, спецификация экранов из кода, граф UI
- [ui/bot-architecture.md](./ui/bot-architecture.md) — архитектура бота
- [ui/bot-ui-story.md](./ui/bot-ui-story.md) — Story
- [ui/bot-controller.md](./ui/bot-controller.md) — Controller
- [ui/bot-test.md](./ui/bot-test.md) — тестирование бота; тестовые миры — [../guides/test-worlds.md](../guides/test-worlds.md)
