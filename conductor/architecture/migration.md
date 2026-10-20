# План перехода

**Назначение:** порядок треков, что исправляет переход, сосуществование старого и нового. Каждый пункт — отдельный трек conductor (создаётся при старте).

---

## 1. Принципы

- **Strangler:** старое и новое работают параллельно; модуль за модулем, гейт зелёный после каждого шага.
- **Переносить и перепроектировать — отдельно.** Сначала механический перенос (поведение не меняется), затем перевод на Def.
- **Данные в `data/`** — только отдельным треком (D-16), с `bun run backup` и подтверждением Нурболата.

## 2. Порядок треков

| # | Трек | Суть | Исполнитель |
|---|---|---|---|
| 0 | **agents-setup** | роли агентов для Claude Code и pi из одного источника, хук гейта в обеих средах, режим оркестратора и передача между средами в `conductor-implement` ([agents.md](./agents.md) §8) | orchestrator |
| 1 ✅ | **core-dmg** | `Result`, `define*`, `F.*`, `Timestamp`, `ReadonlyAr`, Aggregate v2, UoW, `Caller` и `callers`, `normalize(def)`, `*FromDef`, `appApi.run`, граф-движок, `arch:check`, линт-правила ARC/DOM/CODE | orchestrator + Нурболат |
| 1б | **dmg-core-extract** | платформа DMG — отдельный пакет `dmg-core` (npm), развязка от legacy, самодостаточные конфиги, готовность модулей к выносу в сервисы ([D-28](./decisions.md)). Трек: `conductor/tracks/dmg-core-extract_20261020`. **Разделён:** Фазы 1–3 — до `generators`, Фазы 4–6 — после `golden-wish` (см. spec трека) | orchestrator + Нурболат |
| 2 ✅ | **generators** | `bun run gen` для всех видов артефактов по [naming.md](./naming.md) | orchestrator + Нурболат |
| 3 ✅ | **domain-package** | трек: `conductor/tracks/domain-package_20261020`, реестр долга — [debt.md](../tracks/domain-package_20261020/debt.md). Пакет-каркас `@u7-scl/domain` создан в треке generators; наполнить: механически перенести domain-слои снизу вверх: user (+ `User` из app) → course → questionnaire → stream → wish → peer-review → dossier. Старые пути `@u7-scl/<m>/domain` временно реэкспортируют | migrator |
| 4 | **golden-wish** | перевести `wish` на Def, `Result`, Policy, entity-правило, UoW, Timestamp. Эталон; по нему пишутся гайды артефактов | orchestrator + Нурболат |
| 5 | **stream-student** | первый срез конвейером агентов на сложном агрегате | агенты |
| 6 | остальные модули | в порядке зависимостей | агенты |
| 7 | **timestamp-data** | пакетная миграция живых данных, удаление «чтения строки» | orchestrator, с подтверждением |
| 8 | **delegation** | агрегат `Delegation` в user, построение `delegate` в транспорте ([caller.md](./caller.md) §3) | агенты |
| 9 | **ui-manifests** | `define*` UI, эталонный UI-срез, генерация спецификации экранов; `ui-spec.md` удаляются по мере перевода контроллеров ([ui-manifests.md](./ui-manifests.md)) | orchestrator + Нурболат |
| 10+ | потребители графа | CLI `domain`, `docs:domain`/`docs:tech`, `docs:llm`, http + OPTIONS, mcp | по roadmap |

Треки 1 и 3 независимы; 1б и 2 — после 1; Фазы 1–3 трека 1б выполняются до 2 и 4, Фазы 4–6 — после 4 (golden-wish). Трек 1 выполнен (кроме выноса, он в 1б): 2 (generators) выполнен — `bun run gen` готов (naming.md §5); разблокированы 3 (domain-package) и 4 (golden-wish).

## 3. Что исправляет переход

| Сейчас | Становится |
|---|---|
| `_state` мутируется до валидации (`safeUpdate`) | черновик → валидация → фиксация, отказы через `Result` |
| `new Ar(state)` и для создания, и для восстановления | `Ar.create(): Result<Ar>` и `Ar.restore()` |
| геттер `state` клонирует на каждое чтение, все читают поля | `snapshot()` только для репозитория, доменный API |
| domain импортирует api (`commands → api/errors`, Ds бросает UC-ошибки) | контракты и ошибки в domain |
| события — интерфейсы со строками, payload без схемы | `defineEvents` со схемой и FQN |
| `CompleteStudentUc`: `switch` по исходу, снятие роли, выбор текста | `studentAr.complete(outcome)`; роль — ER модуля user; текст — UI |
| Policy → `boolean`, текст отказа в UC | правила с `denyMessage` в Def |
| фасад: `try/catch` по `kind`, `as Stream` | `Result` и `ReadonlyAr` |
| `StreamDs` — запись и UI-чтение вместе | DCS и DQS |
| `ApiModule`: список UC + union-мета + имя | карта Def → класс, пропуск — ошибка компиляции |
| ER: сбой гасится `console.error` | `Result`, логирование, журнал сбоев |
| `getDocType()` у инстансов | статический граф |

## 4. Сосуществование

- Старые `UseCase`/`EventReaction`/`Job`, `throw*`, Ds работают до миграции своего модуля; паттерны — [legacy.md](./legacy.md).
- `appApi.execute` (бросает) и `appApi.run` (`Result`) живут вместе.
- Схемы с `F.timestamp` читают ISO-строку и число, пишут число — данные мигрируют лениво до трека 7.

## 5. Критерий завершения

Все модули в `@u7-scl/domain`, нет реэкспортов в старых пакетах, нет `throw*` для штатных отказов, нет строковых дат, все проверки [rules.md](./rules.md) машинные — блокирующие, кроме помеченных `review`; `legacy.md` удалён.

## 6. Состояние переноса

Трек 3 (`domain-package`): domain-слои всех семи модулей механически перенесены в `@u7-scl/domain` (`user`, `course`, `questionnaire`, `stream`, `wish`, `peer-review`, `dossier`; у каждого `index`, `state`, `contract`, кроме `dossier` без `contract`). Старые `packages/<m>/src/domain/index.ts` и `packages/dossier/src/index.ts` — barrel-реэкспорты с маркером `DEBT`. Временные нарушения чистоты учтены в [debt.md](../tracks/domain-package_20261020/debt.md) (D-1…D-30; маркер `// DEBT(D-<n>)` ↔ `scripts/domain-debt.ts`, сверяет `arch:check`).

### Входной долг для следующих треков

| Владелец | Долги |
|---|---|
| `golden-wish` (перевод на Def) | wish: D-21, D-22, D-23, D-24; общие по `core`: D-1, D-2 |
| треки перевода остальных модулей | user D-5; course D-9, D-10; questionnaire D-14, D-15; stream D-19, D-20; peer-review D-28, D-29 |
| `dmg-core-extract` Ф4 | импорты `core`/`app` в домене: D-1, D-2, D-6, D-7, D-11, D-12, D-16, D-17, D-21, D-22, D-25, D-26; каркасы `contract` модулей уже готовы (`domain/<m>/contract`) |
| последний трек миграции | barrel-долги D-3, D-8, D-13, D-18, D-23, D-27, D-30 и `User` в `app` (D-4) |
