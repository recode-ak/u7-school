# dmg-core

Платформа DMG (Domain Manifest Graph) для TypeScript и Bun. Каждая доменная сущность объявляется один раз манифестом (`XxxDef.define`), а из него выводятся типы, базовые классы, проверки архитектуры, граф модулей и транспорт. Домен чистый и синхронный, модули связаны только по `dependsOn`, поэтому каждый можно вынести в отдельный сервис.

Документация на русском. Образец всех артефактов — учебный модуль [`src/testing/example`](src/testing/example/example.arch.ts) (модули `todo` и `users`).

## Цели пакета

Платформа решает три боли: описание одной сущности в пяти-шести местах, скрытые связи между модулями и логику, размазанную по слоям вместо домена.

**Что даёт из манифеста** (D-01). Один `*Def` порождает всё остальное, поэтому расхождений между кодом и декларацией не бывает:

| Потребитель | Что получает |
|---|---|
| Программист | типы, базовые классы без boilerplate, `Result` с исчерпывающими ошибками |
| Транспорт (фронт↔бэк, сервис↔сервис) | автороутинг, автовалидацию, контракт модуля по запросу |
| PO / аналитик | доменную документацию: модули, агрегаты, статусы, каскады, ошибки |
| LLM (MCP) | UC как tools, доменный граф как resources |
| Контрактные тесты | проверку, что код соответствует декларациям (`ArchChecker`) |

**Как устроен код, который из этого вырастает:**

- **Четыре оси** (D-02): платформа (`dmg-core`, пакет приложения) → домен → прикладной слой (1:1 с модулем домена) → входные адаптеры. Импорты идут только в одну сторону ([layers.md](docs/layers.md)).
- **Домен един, чист и синхронен** (D-03): вся предметка и все контракты (UC, ER, Job, фасады, модули) живут в домене, без IO; асинхронность — только `Loader<T>`.
- **Модуль готов к выносу в сервис** (D-28): межмодульно — только фасады и события по `dependsOn` (DAG). Модулю в другом репозитории нужны лишь контракты зависимостей, а сервис из одного модуля — то же приложение с одним `dependsOn`.
- **Декларация + верификация** (D-12): каждая декларация проверяется типом, рантайм-ассертом или контрактным тестом, а правила архитектуры (ARC, DOM, ERR, API, CODE) — линтером и `ArchChecker` с ID нарушений ([rules.md](docs/rules.md)).
- **Штатный отказ — `Result`, а не `throw`** (D-13): ошибка знает свой `code` и нейтральный `kind`, транспортный маппинг остаётся в адаптерах.

Итог: доменная логика собрана в одном месте, границы модулей проверяются автоматически, а транспорт, документация и MCP-инструменты не пишутся руками. Реестр решений — [decisions.md](docs/decisions.md).

## Установка

Нужен Bun ≥ 1.2. `valibot` и `@valibot/to-json-schema` — peer-зависимости:

```sh
bun add dmg-core valibot @valibot/to-json-schema
bunx dmg-core init
```

`init` создаёт `dmg-core.json` и доставляет в проект скилы и роли агентов (по умолчанию — для Claude Code в `.claude/`). Ещё он добавляет в `AGENTS.md` ссылку на [`llms.txt`](llms.txt) — индекс документации для агентов. После обновления пакета выполни `dmg-core sync`; `dmg-core sync --check` в `check` проекта падает, если копии устарели.

## Быстрый старт

1. **Модуль.** `bunx dmg-core gen module todo --write` создаёт паспорт модуля в домене (`src/domain/todo/`) и прикладной слой (`src/app/todo/`). Без `--write` команда только печатает план. Каталоги и импорт домена задаёт секция `gen` в `dmg-core.json` ([naming.md](docs/naming.md) §5).
2. **Агрегат и операции.** `gen aggregate todo.task` добавляет state, события, ошибки, Ar, Policy и репозиторий. `gen uc todo.task complete-task` создаёт пару «контракт в домене ↔ реализация в прикладном слое», `er` и `job` работают так же, а `dcs` / `dqs` создают доменные сервисы. В заготовках остаются `TODO` — по ним видно, что заполнить. Как именно, подскажет гайд вида ([индекс](docs/guides/index.md)) и тот же артефакт в учебном модуле.
3. **Проверка архитектуры.** Опиши приложение для `ArchChecker` — модули и их раскладку, как в [`example.arch.ts`](src/testing/example/example.arch.ts), — и вызови отчёт из `check` проекта:

   ```ts
   import { reportArchCheck } from 'dmg-core/arch';
   import { MyArch } from './my.arch';

   process.exit(reportArchCheck([MyArch], console.log));
   ```

   Каждое нарушение начинается с ID правила (`ARC-06: …`). Расшифровка ID — в [каталоге правил](docs/rules.md); путь к нему отчёт печатает сам.
4. **Lint-правила.** Правила DOM, ERR, API и CODE — GritQL-плагины biome в [`biome-plugins/`](biome-plugins). Подключи их в `biome.json` проекта на свои каталоги, например домен не читает часы:

   ```json
   { "overrides": [{ "includes": ["src/domain/**", "!**/*.test.ts"], "plugins": ["./node_modules/dmg-core/biome-plugins/dom-14-no-clock.grit"] }] }
   ```

   Какой плагин на какие пути — по каталогу правил ([rules.md](docs/rules.md)).
5. **Тесты.** Хелперы — в `dmg-core/testing`: `testAppContext`, `expectOk`, контракт идемпотентности реакций и другие ([testing.md](docs/testing.md)).

## Подпути

| Импорт | Что |
|---|---|
| `dmg-core` | ядро и Def-классы (`XxxDef.define`) — единственное, что импортирует домен |
| `dmg-core/app` | прикладной слой: UC/ER/Job по Def, модуль, UoW, фасады, репозитории |
| `dmg-core/graph` | нормализация Def, `DefIndex` и граф модулей |
| `dmg-core/arch` | `ArchChecker`, `Violation`, `reportArchCheck` |
| `dmg-core/testing` | хелперы тестов и учебный модуль (`ExampleArch`) |
| `dmg-core/cli` | `DmgCoreCli`: `init`, `sync`, `gen` как API (CLI — `bunx dmg-core`) |

## Документация

- [Вход](docs/index.md): суть DMG, карта документов
- [Слои](docs/layers.md), [моделирование домена](docs/domain-modeling.md), [структура, имена и генератор](docs/naming.md)
- [Манифесты](docs/manifests.md), [ошибки и Result](docs/errors-result.md), [Caller и Trace](docs/caller.md), [транспорт](docs/transport.md)
- [Каталог правил](docs/rules.md), [решения](docs/decisions.md), [тестирование](docs/testing.md), [стиль TypeScript](docs/typescript.md)
- [Гайды по видам артефактов](docs/guides/index.md)
- Для агентов: [`llms.txt`](llms.txt), скил [`dmg-architecture`](skills/dmg-architecture/SKILL.md), [роли](agents/README.md)

## Лицензия

MIT — [LICENSE](LICENSE).
