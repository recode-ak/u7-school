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
| 4 ✅ | **golden-wish** | перевести `wish` на Def, `Result`, Policy, entity-правило, UoW, Timestamp. Эталон; по нему написаны гайды артефактов — [guides/](../../platform/dmg-core/docs/guides/index.md). Трек: `conductor/archive/golden-wish_20261020` | orchestrator + Нурболат |
| 5 | **stream-student** | первый срез конвейером агентов на сложном агрегате | агенты |
| 6 | остальные модули | в порядке зависимостей | агенты |
| 7 | **timestamp-data** | пакетная миграция живых данных, удаление «чтения строки» | orchestrator, с подтверждением |
| 8 | **delegation** | агрегат `Delegation` в user, построение `delegate` в транспорте ([caller.md](../../platform/dmg-core/docs/caller.md) §3) | агенты |
| 9 | **ui-manifests** | Def-манифесты UI, эталонный UI-срез, генерация спецификации экранов; `ui-spec.md` удаляются по мере перевода контроллеров ([ui-manifests.md](./ui-manifests.md)) | orchestrator + Нурболат |
| 10+ | потребители графа | CLI `domain`, `docs:domain`/`docs:tech`, `docs:llm`, http + OPTIONS, mcp | по roadmap |

Треки 1 и 3 независимы; 1б и 2 — после 1; Фазы 1–3 трека 1б выполняются до 2 и 4, Фазы 4–6 — после 4 (golden-wish). Трек 1 выполнен (кроме выноса, он в 1б): 2 (generators) выполнен — `bun run gen` готов (с Ф5 трека 1б — `dmg-core gen` пакета); 3 (domain-package) выполнен и заархивирован; 4 (golden-wish) выполнен — разблокированы Фазы 4–6 трека 1б и трек 5.

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

## 6. Состояние переноса

- **На Def (DMG):** `wish` — домен `domain/src/wish`, прикладной слой `modules/wish/src` (4 UC, 4 ER, JSON-репозиторий, `ModuleFromDef`); в приложении собран в `runners/u7-bot/src/create-dmg-modules.ts`, legacy `wish` удалён. Это эталон: гайды — [guides/](../../platform/dmg-core/docs/guides/index.md).
- **Внешние модули (D-37):** `user`, `course`, `questionnaire`, `stream`, `peer-review`, `dossier` — `ModuleDef.define({ external: true })` в домене; UC, которые зовёт `wish`, исполняют адаптеры над legacy-фасадами (TR-11), legacy-события входят через `legacyEventBus` (`inbound`).
- **Механически перенесены** (трек 3): domain-слои всех модулей в `@u7-scl/domain`; старые `modules/<m>/src/domain/index.ts` и `modules/dossier/src/index.ts` — barrel-реэкспорты с маркером `DEBT`.
- **Граф `dependsOn`** строится из `ModuleDef` (`scripts/domain-arch.ts`); `arch:check` сверяет маркеры `// DEBT-<n>` с [debt.md](./debt.md), тактические решения перехода — `TR-<n>` там же.

### Входной долг для следующих треков

| Владелец | Долги |
|---|---|
| `dmg-core-extract` Ф4–6 | — (DEBT-33 погашен в Ф4, TR-26) |
| треки перевода модулей на Def | импорты `core`/`app` в домене — user DEBT-1, 2; course DEBT-6, 7; questionnaire DEBT-11, 12; stream DEBT-16, 17; peer-review DEBT-25, 26; импорты чужого `index` legacy-модулями — DEBT-34; user DEBT-5; course DEBT-9, 10; questionnaire DEBT-14, 15, 32; stream DEBT-19, 20; peer-review DEBT-28, 29 |
| последний трек миграции | barrel-долги DEBT-3, 8, 13, 18, 23, 27, 30 и `User` в `app` (DEBT-4) |

### Старт следующих треков

- **`dmg-core-extract` Ф4–6** — по spec трека; гайды переезжают в `docs/guides/` пакета (решение «вариант А» spec `golden-wish`).
- **`stream-student`** (трек 5) — первый срез конвейером агентов по гайдам; бриф — по образцу `conductor/archive/golden-wish_20261020/slices/wish.md`, итог эталона — `summary.md` трека.
- Базовая линия тестов на конец `golden-wish`: 3734 pass, 0 fail.
