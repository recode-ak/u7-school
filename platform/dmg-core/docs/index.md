# DMG — Domain Manifest Graph

**Назначение:** вход в документацию платформы `dmg-core`: суть подхода и карта документов. Образец во всех документах — учебный модуль пакета [src/testing/example](../src/testing/example/example.arch.ts) (модули `todo` и `users`).

---

## Суть

Каждая доменная сущность описывается **один раз** манифестом (`*Def`). Из манифестов выводятся контракты для потребителей:

| Потребитель | Что получает |
|---|---|
| **Программист (DX)** | типы, базовые классы без boilerplate, `Result` с исчерпывающими ошибками |
| **Транспорт** (фронт↔бэк, сервис↔сервис) | автороутинг, автовалидация, контракт модуля по запросу |
| **PO / аналитик** | генерируемая доменная документация: модули, агрегаты, статусы, каскады, ошибки |
| **LLM (MCP)** | UC как tools, доменный граф как resources |
| **Контрактные тесты** | проверка, что код соответствует декларациям (`ArchChecker`) |

Приложение на DMG делится на четыре оси — платформа, домен, прикладной слой, входные адаптеры ([layers.md](./layers.md)). Домен чистый и синхронный; модули связаны только по `dependsOn` и готовы к выносу в отдельный сервис (D-28).

## Начни отсюда

| Задача | Читай |
|---|---|
| Понять устройство | [layers.md](./layers.md) → [domain-modeling.md](./domain-modeling.md) |
| Создать файл / объект | [naming.md](./naming.md) → [rules.md](./rules.md) |
| Написать артефакт по образцу | [guides/](./guides/index.md) |
| Объявить контракт | [manifests.md](./manifests.md), [errors-result.md](./errors-result.md) |
| Работать агентом | скил `dmg-architecture` ([SKILL.md](../skills/dmg-architecture/SKILL.md)), роли [agents/](../agents/README.md) |

## Документы

**Устройство и решения**
- [decisions.md](./decisions.md) — реестр решений платформы D-NN
- [layers.md](./layers.md) — оси, импорты, доменный API, доступ к entity, прикладной слой, адаптеры
- [domain-modeling.md](./domain-modeling.md) — модуль-владелец, границы модулей, ошибки и данные между модулями
- [naming.md](./naming.md) — сокращения, файловая структура, имена

**Контракты**
- [manifests.md](./manifests.md) — Def-классы (`XxxDef.define`), граф L0/L1/L2, декларация + верификация
- [errors-result.md](./errors-result.md) — `Result`, модель ошибок, UoW, исполнение UC
- [caller.md](./caller.md) — кто вызывает: `guest`, `user`, `delegate`, `system`; след `Trace`
- [transport.md](./transport.md) — HTTP (JSON-команда), MCP, in-proc

**Качество**
- [rules.md](./rules.md) — **каталог правил с ID** и способом проверки
- [testing.md](./testing.md) — тестирование
- [guides/](./guides/index.md) — гайды по видам артефактов на учебном модуле
- [typescript.md](./typescript.md) — стиль TypeScript
