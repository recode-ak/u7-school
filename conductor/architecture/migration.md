# План перехода

**Назначение:** порядок треков, что исправляет переход, сосуществование старого и нового. Каждый пункт — отдельный трек conductor (создаётся при старте).

---

## 1. Принципы

- **Strangler:** старое и новое работают параллельно; модуль за модулем, гейт зелёный после каждого шага.
- **Переносить и перепроектировать — отдельно.** Сначала механический перенос (поведение не меняется), затем перевод на Def.
- **Данные в `data/`** — только отдельным треком (D-16), с `bun run backup` и подтверждением Нурболата.
- **Без деплоя до конца перехода.** Релиз выйдет после критерия §5. До этого работа идёт в автономном режиме ([agents.md](./agents.md) §9), а промежуточная работоспособность не требуется: модуль можно переводить целиком, без мостов ради прода. Затем отдельный трек — **ревизия**: сравнение с релизом `v0.2.6` (worktree `../u7-school-v0.2.6`), разбор `TR` и перепроектирование.

## 2. Порядок треков

| # | Трек | Суть | Исполнитель |
|---|---|---|---|
| 0 | **agents-setup** | роли агентов для Claude Code и pi из одного источника, хук гейта в обеих средах, режим оркестратора и передача между средами в `conductor-implement` ([agents.md](./agents.md) §8) | orchestrator |
| 1 ✅ | **core-dmg** | `Result`, Def-классы (`XxxDef.define`), `F.*`, `Timestamp`, `ReadonlyAr`, Aggregate v2, UoW, `Caller` и `callers`, `normalize(def)`, `*FromDef`, `appApi.run`, граф-движок, `arch:check`, линт-правила ARC/DOM/CODE | orchestrator + Нурболат |
| 1б ✅ | **dmg-core-extract** | платформа DMG — отдельный пакет `dmg-core` (npm), развязка от legacy, самодостаточные конфиги, готовность модулей к выносу в сервисы ([D-28](./decisions.md)); пакет готов к выносу, сам вынос — по чек-листу в spec трека после релиза. Трек: `conductor/archive/dmg-core-extract_20261020` | orchestrator + Нурболат |
| 2 ✅ | **generators** | `bun run gen` для всех видов артефактов по [naming.md](./naming.md) | orchestrator + Нурболат |
| 3 ✅ | **domain-package** | трек: `conductor/archive/domain-package_20261020`, реестр долга — [debt.md](./debt.md). Пакет-каркас `@u7-scl/domain` создан в треке generators; наполнить: механически перенести domain-слои снизу вверх: user (+ `User` из app) → course → questionnaire → stream → wish → peer-review → dossier. Старые пути `@u7-scl/<m>/domain` временно реэкспортируют | migrator |
| 4 ✅ | **golden-wish** | перевести `wish` на Def, `Result`, Policy, entity-правило, UoW, Timestamp. Эталон; по нему написаны гайды артефактов — [guides/](../../node_modules/dmg-core/docs/guides/index.md). Трек: `conductor/archive/golden-wish_20261020` | orchestrator + Нурболат |
| 5 | **peer-review** | первый модуль конвейером агентов; Ф0 — пилот ролей волны 1 ([agent-roles.md](./agent-roles.md) §4) | агенты |
| 6 | остальные модули | сверху вниз по графу (§2.1): `stream` (бывший `stream-student`) → `questionnaire` → `course` → `user`; `dossier` — в любой момент | агенты |
| 7 | **timestamp-data** | пакетная миграция живых данных, удаление «чтения строки» | orchestrator, с подтверждением |
| 8 | **delegation** | агрегат `Delegation` в user, построение `delegate` в транспорте ([caller.md](../../node_modules/dmg-core/docs/caller.md) §3) | агенты |
| 9 | **ui-manifests** | Def-манифесты UI, эталонный UI-срез, генерация спецификации экранов; `ui-spec.md` удаляются по мере перевода контроллеров ([ui-manifests.md](./ui-manifests.md)) | orchestrator + Нурболат |
| 10+ | потребители графа | CLI `domain`, `docs:domain`/`docs:tech`, `docs:llm`, http + OPTIONS, mcp | по roadmap |

Треки 1 и 3 независимы; 1б и 2 — после 1; Фазы 1–3 трека 1б выполняются до 2 и 4, Фазы 4–6 — после 4 (golden-wish). Трек 1 выполнен (кроме выноса, он в 1б): 2 (generators) выполнен — `bun run gen` готов (с Ф5 трека 1б — `dmg-core gen` пакета); 3 (domain-package) выполнен и заархивирован; 4 (golden-wish) выполнен — разблокированы Фазы 4–6 трека 1б и трек 5.

### 2.1. Порядок модулей: сверху вниз по графу

Граф `dependsOn` (домен, `ModuleDef`): `user` и `dossier` — без зависимостей; `course`, `questionnaire` → `user`; `stream` → `user`, `course`; `peer-review` → `user`, `questionnaire`, `stream`; `wish` (на Def) → все четыре.

Переводим **от потребителей к поставщикам**: первым — модуль, от которого не зависит ни один legacy-модуль. Причина — цена мостов:

- **Прямой мост** (модуль на Def зовёт legacy-зависимость) уже есть и проверен на `wish`: внешний `ModuleDef` + адаптер над legacy-фасадом (TR-11), legacy-события — через `legacyEventBus` (`inbound`). Он дешёвый и снимается, когда зависимость переезжает.
- **Обратный мост** (legacy-модуль зовёт модуль на Def) не существует: legacy-код импортирует чужие entity, Ar и фасады напрямую (DEBT-34). Его пришлось бы строить на каждого клиента.

Снизу вверх (`user` первым) — обратный мост для `course`, `questionnaire`, `stream`, `peer-review` и entity `User` во всём репозитории (DEBT-4). Сверху вниз обратных мостов между модулями нет: к моменту перевода поставщика все его клиенты уже на Def. `peer-review` — вершина: `stream` связан с ним только событием `stream.completed` (идёт через `inbound`). `user` — последний, вместе с ним уходят `U7CallerResolver` над legacy `userFacade` (TR-33) и DEBT-4. UI (stories бота) — клиент всех модулей при любом порядке: переводится на `dispatch` в треке своего модуля.

## 3. Что исправляет переход

| Сейчас | Становится |
|---|---|
| `_state` мутируется до валидации (`safeUpdate`) | черновик → валидация → фиксация, отказы через `Result` |
| `new Ar(state)` и для создания, и для восстановления | `Ar.create(): Result<Ar>` и `Ar.restore()` |
| геттер `state` клонирует на каждое чтение, все читают поля | `snapshot()` только для репозитория, доменный API |
| domain импортирует api (`commands → api/errors`, Ds бросает UC-ошибки) | контракты и ошибки в domain |
| события — интерфейсы со строками, payload без схемы | `EventDef.define` со схемой и FQN |
| `CompleteStudentUc`: `switch` по исходу, снятие роли, выбор текста | `studentAr.complete(outcome)`; роль — ER модуля user; текст — UI |
| Policy → `boolean`, текст отказа в UC | правила с `denyMessage` в Def |
| фасад: `try/catch` по `kind`, `as Stream` | `Result` и `ReadonlyAr` |
| `StreamDs` — запись и UI-чтение вместе | DCS и DQS |
| `ApiModule`: список UC + union-мета + имя | карта Def → класс, пропуск — ошибка компиляции |
| ER: сбой гасится `console.error` | `Result`, логирование, журнал сбоев |
| `getDocType()` у инстансов | статический граф |

## 4. Сосуществование

- Старые `UseCase`/`EventReaction`/`Job`, `throw*`, Ds работают до миграции своего модуля; паттерны — [legacy.md](./legacy.md).
- UC legacy — `appApi.execute` по строковому имени (бросает); UC DMG — команда `appApi.dispatch(moduleDef, …)` (`Result`, D-49).
- Схемы с `F.timestamp` читают ISO-строку и число, пишут число — данные мигрируют лениво до трека 7.

## 5. Критерий завершения

Все модули в `@u7-scl/domain`, нет реэкспортов в старых пакетах, нет `throw*` для штатных отказов, нет строковых дат, все проверки [rules.md](./rules.md) машинные — блокирующие, кроме помеченных `review`; `legacy.md` удалён.

Вместе с завершением в пакет переезжает общее видение процесса: черновик [dmg-process.md](./dmg-process.md) → `docs/process.md` `dmg-core` (без специфики проекта и conductor), роли, оправдавшие себя в пилоте ([agent-roles.md](./agent-roles.md) §5), — в `agents/` пакета; проектные документы ([agents.md](./agents.md), [agent-roles.md](./agent-roles.md)) ссылаются на него и оставляют только привязку к проекту.

## 6. Состояние переноса

- **На Def (DMG):** `wish` — домен `domain/src/wish`, прикладной слой `modules/wish/src` (4 UC, 4 ER, JSON-репозиторий, `ModuleFromDef`), legacy `wish` удалён. Эталон: гайды — [guides/](../../node_modules/dmg-core/docs/guides/index.md). Чужие вызовы UC — в шаге `fetch` после Policy (D-58 пакета).
- **Корень сборки (D-50, D-52):** `@u7-scl/app` (`platform/app`) — `U7App` собирает всё приложение по `AppEnv`: legacy-модули, `AppContext` DMG, модули DMG через `ApiApp` пакета (фабрики `ModuleFactory`, фасады по `dependsOn`), резолвер `Caller` (`U7CallerResolver` над legacy `userFacade`). Legacy-ядро приложения — `@u7-scl/app-legacy` (`platform/app-legacy`, TR-33). Раннеры (`u7-bot`, `u7-cli`) и `scripts/call-uc.ts` получают приложение из `U7App`; ARC-07/08/09 и D-53 (ARC-06) — машинные (`arch:check`, `biome`).
- **Внешние модули (D-37):** `user`, `course`, `questionnaire`, `stream`, `peer-review`, `dossier` — `ModuleDef.define({ external: true })` в домене; UC, которые зовёт `wish`, исполняют адаптеры над legacy-фасадами (TR-11) — фабрики в `U7App`, legacy-события входят через `legacyEventBus` (`inbound`).
- **Механически перенесены** (трек 3): domain-слои всех модулей в `@u7-scl/domain`; старые `modules/<m>/src/domain/index.ts` и `modules/dossier/src/index.ts` — barrel-реэкспорты с маркером `DEBT`.
- **Граф `dependsOn`** строится из `ModuleDef` (`scripts/domain-arch.ts`, `DomainArch` с `root` и `runners`); `arch:check` сверяет маркеры `// DEBT-<n>` с [debt.md](./debt.md), тактические решения перехода — `TR-<n>` там же.

### Входной долг для следующих треков

| Владелец | Долги |
|---|---|
| перевод `stream` | импорты `core`/`app-legacy` в домене — DEBT-16, 17; DEBT-19, 20; ER `invite-wishers` не идемпотентен — DEBT-35 |
| треки перевода остальных модулей на Def | импорты `core`/`app-legacy` в домене — user DEBT-1, 2; course DEBT-6, 7; questionnaire DEBT-11, 12; peer-review DEBT-25, 26; импорты чужого `index` legacy-модулями — DEBT-34; user DEBT-5; course DEBT-9, 10; questionnaire DEBT-14, 15, 32; peer-review DEBT-28, 29 |
| по мере касания | тесты UC/ER/Job на JSON во временном каталоге — DEBT-40 |
| `ui-manifests` / `dmg-ui` | id апдейта Telegram неявным контекстом — DEBT-41 |
| после перехода | `u7-cli` и `call-uc` — общий инструмент вызова UC — DEBT-42 |
| последний трек миграции | barrel-долги DEBT-3, 8, 13, 18, 23, 27, 30 и `User` в `app-legacy` (DEBT-4) |

### Старт следующих треков

- **Следующий — `peer-review`** (трек 5, порядок — §2.1). Создаётся `conductor-newtrack` (ID вида `peer-review-dmg_<дата>`) по этому разделу:
  - **Ф0 — роли волны 1** ([agent-roles.md](./agent-roles.md)): `tech-lead`, `test-designer`, `data-keeper` в `.agents-core/roles/`, `bun run agents:sync`; место в конвейере — [agents.md](./agents.md) §3; раздел «Пилот ролей» в `summary.md`.
  - **Срезы** по агрегатам `review-campaign` и `review` (`modules/peer-review/src/api`): `tech-lead` → бриф по образцу `conductor/archive/golden-wish_20261020/slices/wish.md`; `test-designer` → характеризация поведения `v0.2.6`; `migrator` → перенос; `data-keeper` — на `state` и репозитории; `reviewer`.
  - **Зависимости** `user`, `questionnaire`, `stream` — внешние `ModuleDef` с адаптерами TR-11 (как у `wish`); событие `stream.completed` — через `inbound`. Обратных мостов нет.
  - **Сборка:** фабрика в `U7App` (`platform/app/src/u7-app.ts`, как `wish`) через вход пакета; `@u7-scl/peer-review/**` — в группу ARC-07 блока `platform/app/src/**` корневого `biome.json` (TR-35 п. 5). Stories бота `peer-review` — на `dispatch`.
  - **Итог:** пилот ролей по критериям [agent-roles.md](./agent-roles.md) §5, решение о волне 2.
- **Затем `stream`** — тот же шаблон; адаптер TR-11 для `stream` у `wish` и `peer-review` снимается, DEBT-35 решается здесь.
- Базовая линия тестов на конец `app-assembly`: `conductor/archive/app-assembly_20261029/summary.md`.
