# Архитектура

**Назначение:** вход в техническую документацию u7-school. Платформа DMG (Domain Manifest Graph) документирована в пакете `dmg-core` — [node_modules/dmg-core/docs/index.md](../../node_modules/dmg-core/docs/index.md). Здесь — проектное: раскладка монорепо, переход, UI, процесс агентов, решения проекта.

> Статус: **переход на DMG завершён**, релизы v0.3.0–v0.3.1 на prod (2026-11-14); состояние — раздел «Состояние» ниже. Эталон проекта — модуль `wish`; гайды по видам артефактов — в пакете ([guides/](../../node_modules/dmg-core/docs/guides/index.md)), образец — учебный модуль пакета. UI-слой — концепция в [ui-manifests.md](./ui-manifests.md), реализация позже.

---

## Раскладка монорепо

| Ось ([layers.md](../../node_modules/dmg-core/docs/reference/layers.md)) | Пакеты u7-school |
|---|---|
| Платформа | `dmg-core` (репо `~/dev/tools/dmg/dmg-core`, в проекте — `node_modules/dmg-core`, D-61), приложение `@u7-scl/app` (корень сборки `U7App`, `school/`, файловые адаптеры `infra/`); `@u7-scl/core` — только `ui` и `shared`, кандидат на удаление при `dmg-ui` |
| Домен | `@u7-scl/domain` (`domain/src/<m>`; вход модуля — `@u7-scl/domain/<m>/contract`; общий домен — `domain/src/shared`: VO, общие для модулей домена и `@u7-scl/app`, импорт `@u7-scl/domain/shared`) |
| Прикладной слой | `modules/<m>/src` (1:1 с модулем домена) |
| Входные адаптеры | `runners/*`: бот `u7-bot`, позже web и транспорты; операции — через `appApi` |

Правила с ID и их привязка к пакетам проекта — [rules.md](./rules.md).

## Состояние

- **Модули на Def (DMG):** `wish` (эталон), `peer-review`, `stream`, `questionnaire`, `course`, `user`, `dossier` (пустой модуль без поведения — `modules/dossier/README.md`). Legacy-кода нет; история перехода — `summary.md` трека `legacy-removal` в `conductor/archive/`.
- **Корень сборки (D-50, D-52):** `@u7-scl/app` (`platform/app`) — `U7App` по `AppEnv`: `AppContext` DMG, модули через `ApiApp` пакета, одна шина, планировщик Job пакета (D-71), резолвер `Caller` (`U7CallerResolver`, субъект `UserAr`); `school/` — конфигурация школы (с зоной `timeZone`), `zone/` — `LocalZone`, перевод времени в зону и обратно (D-90), `infra/` — файловые адаптеры портов пакета. Раннер `u7-bot` и `scripts/` получают приложение из `U7App`.
- **Лог операций** (D-43, D-86 пакета): `data/oplog`, патч полей в `writes`, персональные поля помечены `F.sensitive` в state, VO и схемах операций (в логе — `[redacted]`), Telegram ID в `trace` — непрозрачный `VisitorId` (`runners/u7-bot/src/core/visitor-id.ts`), срок 90 дней; чтение — `bun run oplog` ([oplog.md](../../node_modules/dmg-core/docs/reference/oplog.md)). Новое поле с ПД — сразу `F.sensitive`; схема операции, написанная не из полей state/VO, помечается сама.
- **Граф `dependsOn`** строится из `ModuleDef` (`scripts/domain-arch.ts`); `arch:check` сверяет код с реестром [code.md](../debt/code.md).
- **Остаток** (владельцы — в [реестрах долга](../debt/README.md) и [roadmap.md](../roadmap.md)): схемы с `F.timestamp` читают ISO-строку и число, пишут число — данные мигрируют лениво до трека `timestamp-data` (комментарии «legacy-запись» в репозиториях — про формат данных); `@u7-scl/core` — только `ui` и `shared`, уходит с `dmg-ui`; `call-uc` — ручной вход до `dmg-cli` (C-DEBT-42).
- **Деплой и релиз** — README, раздел «Деплой»; релиз с миграцией данных — по своему документу выкатки, каждый шаг с данными — с подтверждения Нурболата.

## Начни отсюда

| Задача | Читай |
|---|---|
| Понять устройство DMG | [layers.md](../../node_modules/dmg-core/docs/reference/layers.md) → [domain-modeling.md](../../node_modules/dmg-core/docs/reference/domain-modeling.md) |
| Создать файл / объект | [naming.md пакета](../../node_modules/dmg-core/docs/reference/naming.md), генератор в проекте — [naming.md](./naming.md) → [rules.md](./rules.md) |
| Написать артефакт по образцу | [guides/](../../node_modules/dmg-core/docs/guides/index.md) + эталон `wish` |
| Работать с ботом | [ui/](./ui/bot-architecture.md) |
| Работать агентом | [agents.md](./agents.md), [agent-roles.md](./agent-roles.md), скилы `architecture` и `dmg-architecture` |
| Отдать шаг DeepSeek | [deepseek.md](./deepseek.md) |

## Правка платформы `dmg-core`

Пакет живёт в своём репо `~/dev/tools/dmg/dmg-core` (GitHub `recode-ak/dmg-core`) и подключён по тегу: `git+ssh://git@github.com/recode-ak/dmg-core.git#vX.Y.Z` (D-61, с релиза v0.3.0); `node_modules/dmg-core` — только для чтения.

Платформа (`dmg-core`, в будущем `dmg-ui`) развивается параллельно с u7-school: что нужно проекту и принадлежит платформе, правится в платформе, а не обходится в проекте. Агенты вправе править репо пакета по этому порядку; коммит в репо пакета делается отдельно, его SHA указывается в коммите u7-school.

1. Правка в репо пакета — по его TDD и документации (`docs/`, решения пакета — `docs/decisions.md`, долг — `debt.md` в корне репо).
2. В репо пакета зелёные `bun run check` и `bun run e2e`; коммит там.
3. Версия: `version` в `package.json` пакета → тег `vX.Y.Z` → push `main` и тега (порядок — `RELEASING.md` пакета, «Обновление пакета у потребителя»). Push пакета — с подтверждения Нурболата, как и push u7-school.
4. В u7-school — `#vX.Y.Z` во всех `package.json`, где объявлен `dmg-core` (`git grep -l '"dmg-core": "git+ssh'`), → `bun install`; при изменении доставляемых документов, скилов и ролей — `bun run dmg:sync` и `bun run agents:sync`; `bun run check` зелёный; коммит, в сообщении — тег и SHA пакета.

Правка, нужная u7-school, но меняющая контракт пакета, — сначала решение в `docs/decisions.md` пакета. Подключение по тегу — с релиза v0.3.0 (D-61).

## Документы проекта

**Решения и правила**
- [vision.md](./vision.md) — видение: один граф системы, типы UI, процессы, документация продукта, развёртывание и масштабы, последовательность работ
- [decisions.md](./decisions.md) — решения проекта D-NN (платформенные — [в пакете](../../node_modules/dmg-core/docs/decisions.md))
- [rules.md](./rules.md) — как каталог правил пакета применяется в проекте
- [naming.md](./naming.md) — генератор в проекте: раскладка `dmg-core.json`, новый прикладной пакет
- [conductor/debt/](../debt/README.md) — правила и три реестра долга: `code.md` (`C-DEBT-<n>`), `tests.md` (`T-DEBT-<n>`), `product.md` (`D-DEBT-<n>`)

**Процесс**
- [agents.md](./agents.md) — роли агентов, контуры качества, связь с conductor, среды Claude Code и pi
- [process.md](../../node_modules/dmg-core/docs/process.md) — общее видение процесса (уровни постановки, роли, срез, SDD и без него), в пакете `dmg-core`
- [agent-roles.md](./agent-roles.md) — новые роли агентов: состав, место в процессе, волны внедрения, критерии годности
- [deepseek.md](./deepseek.md) — делегирование шагов ролей в DeepSeek: кому что, промпт, запуск и учёт
- [team-roles.md](./team-roles.md) — роли людей и агентов (черновик): `dmg-*` — агент, без префикса — человек; реестр команды, передача, решение вне роли
- [feature-modeling.md](./feature-modeling.md) — моделирование фичи (черновик): от описания функциональности к доменной модели и карте треков, уровень над spec трека
- [feature-model.md](./feature-model.md) — формат модели фичи (черновик): разделы, событийный штурм → Def, `.md` и `.json`
- [docs-strategy.md](./docs-strategy.md) — доменная и техническая документация

**UI (Telegram-бот)**
- [ui-manifests.md](./ui-manifests.md) — манифесты UI (концепция): матрёшка, спецификация экранов из кода, граф UI
- [ui/bot-architecture.md](./ui/bot-architecture.md) — архитектура бота
- [ui/bot-ui-story.md](./ui/bot-ui-story.md) — Story
- [ui/bot-controller.md](./ui/bot-controller.md) — Controller
- [ui/bot-test.md](./ui/bot-test.md) — тестирование бота; тестовые миры — [../guides/test-worlds.md](../guides/test-worlds.md)
