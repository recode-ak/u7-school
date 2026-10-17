# Архитектура

**Назначение:** единственное место технической документации проекта: целевая архитектура DMG (Domain Manifest Graph), правила, процессы агентов, план перехода, UI-гайды и паттерны немигрированного кода.

> Статус: **контур утверждён, переход не начат.** Немигрированный код сопровождается по [legacy.md](./legacy.md). UI-слой — концепция в [ui-manifests.md](./ui-manifests.md), реализация позже.

---

## Суть

Каждая доменная сущность описывается **один раз** манифестом (`*Def`). Из манифестов выводятся контракты для потребителей:

| Потребитель | Что получает |
|---|---|
| **Программист (DX)** | типы, базовые классы без boilerplate, `Result` с исчерпывающими ошибками |
| **Транспорт** (фронт↔бэк, сервис↔сервис) | автороутинг, автовалидация, OPTIONS с контрактом модуля |
| **PO / аналитик** | генерируемая доменная документация: модули, агрегаты, статусы, каскады, ошибки |
| **LLM (MCP)** | UC как tools, доменный граф как resources |
| **Контрактные тесты** | проверка, что код соответствует декларациям |

## Начни отсюда

| Задача | Читай |
|---|---|
| Понять устройство | [layers.md](./layers.md) → [domain-modeling.md](./domain-modeling.md) |
| Создать файл / объект | [naming.md](./naming.md) → [rules.md](./rules.md) |
| Объявить контракт | [manifests.md](./manifests.md), [errors-result.md](./errors-result.md) |
| Править немигрированный модуль | [legacy.md](./legacy.md) |
| Работать с ботом | [ui/](./ui/bot-architecture.md) |
| Работать агентом | [agents.md](./agents.md) |

## Документы

**Решения и устройство**
- [decisions.md](./decisions.md) — реестр решений D-NN
- [layers.md](./layers.md) — оси, пакеты, импорты, доменный API, доступ к entity
- [domain-modeling.md](./domain-modeling.md) — модуль-владелец, границы модулей, ошибки и данные между модулями
- [naming.md](./naming.md) — сокращения, файловая структура, имена

**Контракты**
- [manifests.md](./manifests.md) — семейство `define*`, граф L0/L1/L2, декларация + верификация
- [errors-result.md](./errors-result.md) — `Result`, модель ошибок, UoW, исполнение UC
- [transport.md](./transport.md) — HTTP (JSON-команда), MCP, in-proc
- [caller.md](./caller.md) — кто вызывает: `guest`, `user`, `delegate`, `system`
- [ui-manifests.md](./ui-manifests.md) — манифесты UI (концепция): матрёшка, спецификация экранов из кода, граф UI

**Качество и процесс**
- [rules.md](./rules.md) — **каталог правил с ID** и способом проверки
- [testing.md](./testing.md) — тестирование
- [typescript.md](./typescript.md) — стиль TypeScript
- [docs-strategy.md](./docs-strategy.md) — доменная и техническая документация
- [agents.md](./agents.md) — роли агентов, контуры качества, связь с conductor
- [migration.md](./migration.md) — треки перехода, что исправляется, сосуществование
- [legacy.md](./legacy.md) — паттерны немигрированного кода (удаляется после перехода)

**UI (Telegram-бот)**
- [ui/bot-architecture.md](./ui/bot-architecture.md) — архитектура бота
- [ui/bot-ui-story.md](./ui/bot-ui-story.md) — Story
- [ui/bot-controller.md](./ui/bot-controller.md) — Controller
- [ui/bot-test.md](./ui/bot-test.md) — тестирование бота
