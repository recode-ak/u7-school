# План перехода

**Назначение:** история перехода на DMG — порядок треков, что он исправил, итог и чек-лист релиза. Переход завершён треком `legacy-removal` (2026-11-12); до релиза — ревизия (§1).

---

## 1. Принципы

- **Strangler:** старое и новое работают параллельно; модуль за модулем, гейт зелёный после каждого шага.
- **Переносить и перепроектировать — отдельно.** Сначала механический перенос (поведение не меняется), затем перевод на Def.
- **Данные в `data/`** — только отдельным треком (D-16), с `bun run backup` и подтверждением Нурболата.
- **Без деплоя до релиза.** Релиз — после **ревизии** (отдельный трек): сравнение с релизом `v0.2.6` (worktree `../u7-school-v0.2.6`), разбор `TR` и перепроектирование, затем чек-лист релиза (§6). Критерий §5 — целевое состояние, а не условие релиза (Нурболат, 2026-11-12, TR-68). До релиза работа идёт в автономном режиме ([agents.md](./agents.md) §9), промежуточная работоспособность не требуется.

## 2. Порядок треков

| # | Трек | Суть | Исполнитель |
|---|---|---|---|
| 0 | **agents-setup** | роли агентов для Claude Code и pi из одного источника, хук гейта в обеих средах, режим оркестратора и передача между средами в `conductor-implement` ([agents.md](./agents.md) §8) | orchestrator |
| 1 ✅ | **core-dmg** | `Result`, Def-классы (`XxxDef.define`), `F.*`, `Timestamp`, `ReadonlyAr`, Aggregate v2, UoW, `Caller` и `callers`, `normalize(def)`, `*FromDef`, `appApi.run`, граф-движок, `arch:check`, линт-правила ARC/DOM/CODE | orchestrator + Нурболат |
| 1б ✅ | **dmg-core-extract** | платформа DMG — отдельный пакет `dmg-core` (npm), развязка от legacy, самодостаточные конфиги, готовность модулей к выносу в сервисы ([D-28](./decisions.md)); пакет готов к выносу, сам вынос — по чек-листу в spec трека после релиза. Трек: `conductor/archive/dmg-core-extract_20261020` | orchestrator + Нурболат |
| 2 ✅ | **generators** | `bun run gen` для всех видов артефактов по [naming.md](./naming.md) | orchestrator + Нурболат |
| 3 ✅ | **domain-package** | трек: `conductor/archive/domain-package_20261020`, реестр долга — [debt.md](./debt.md). Пакет-каркас `@u7-scl/domain` создан в треке generators; наполнить: механически перенести domain-слои снизу вверх: user (+ `User` из app) → course → questionnaire → stream → wish → peer-review → dossier. Старые пути `@u7-scl/<m>/domain` временно реэкспортируют | migrator |
| 4 ✅ | **golden-wish** | перевести `wish` на Def, `Result`, Policy, entity-правило, UoW, Timestamp. Эталон; по нему написаны гайды артефактов — [guides/](../../node_modules/dmg-core/docs/guides/index.md). Трек: `conductor/archive/golden-wish_20261020` | orchestrator + Нурболат |
| 5 ✅ | **peer-review** | первый модуль конвейером агентов; Ф0 — пилот ролей волны 1 ([agent-roles.md](./agent-roles.md) §4). Трек: `conductor/archive/peer-review-dmg_20261029` | агенты |
| 6 ✅ | остальные модули | сверху вниз по графу (§2.1): `stream` → `questionnaire` → `course` → `user`; последний — `legacy-removal` (`dossier` на Def, удаление legacy, `u7-cli` → `dmg-cli`). Трек: `conductor/archive/legacy-removal_20261112` | агенты |
| 7 | **timestamp-data** | после релиза: пакетная миграция живых данных, удаление «чтения строки» (до выкатки `v0.2.6` пишет ISO — миграция до релиза бессмысленна) | orchestrator, с подтверждением |
| 8 | **delegation** | агрегат `Delegation` в user, построение `delegate` в транспорте ([caller.md](../../node_modules/dmg-core/docs/reference/caller.md) §4) | агенты |
| 9 | **ui-manifests** | Def-манифесты UI, эталонный UI-срез, генерация спецификации экранов; `ui-spec.md` удаляются по мере перевода контроллеров ([ui-manifests.md](./ui-manifests.md)) | orchestrator + Нурболат |
| 10+ | потребители графа | CLI `domain`, `docs:domain`/`docs:tech`, `docs:llm`, http + OPTIONS, mcp; с ними — вычистка JSDoc, дублирующего `label`/`description` Def ([docs-strategy.md](./docs-strategy.md) §6) | по roadmap |

Треки 1 и 3 независимы; 1б и 2 — после 1; Фазы 1–3 трека 1б выполняются до 2 и 4, Фазы 4–6 — после 4 (golden-wish). Трек 1 выполнен (кроме выноса, он в 1б): 2 (generators) выполнен — `bun run gen` готов (с Ф5 трека 1б — `dmg-core gen` пакета); 3 (domain-package) выполнен и заархивирован; 4 (golden-wish) выполнен — разблокированы Фазы 4–6 трека 1б и трек 5.

### 2.1. Порядок модулей: сверху вниз по графу

Модули переводились **от потребителей к поставщикам** (`wish` → `peer-review` → `stream` → `questionnaire` → `course` → `user`, `dossier` — последним): обратных мостов (legacy зовёт Def) не строили. Поставщик, ещё не переведённый, был внешним `ModuleDef` (`external: true`, D-37) с **адаптером над legacy-фасадом** — `UseCaseFromDef` над Def контракта, только перевод входа и ответа; адаптер снимался в треке поставщика. Внешних модулей и адаптеров в коде больше нет.

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

## 4. Остаток после перехода

Legacy-кода нет. Осталось — с владельцами в [debt.md](./debt.md) и треках:

- Схемы с `F.timestamp` читают ISO-строку и число, пишут число — данные мигрируют лениво до трека 7 (`timestamp-data`); тесты и комментарии «legacy-запись» в репозиториях — про формат данных, не про код.
- `@u7-scl/core` — только `ui` и `shared`; кандидат на удаление при переводе UI в `dmg-ui` (TR-62 С3).
- `call-uc` — ручной вход до `dmg-cli` (DEBT-42).
- `throw*` для штатных отказов — аудит в `summary.md` трека `legacy-removal` (исправление — отдельно).

## 5. Критерий завершения

Все модули в `@u7-scl/domain`, нет реэкспортов в старых пакетах, нет `throw*` для штатных отказов, нет строковых дат, все проверки [rules.md](./rules.md) машинные — блокирующие, кроме помеченных `review`; документ паттернов legacy удалён.

**Итог (`legacy-removal`):** выполнено, кроме строковых дат (трек 7, после релиза) и `throw*` (аудит — §4: штатный отказ «гость без `/start`» — на ревизии, пограничные — по мере касания). Это остаток, а не legacy: переход завершён.

Общее видение процесса и оправдавшие себя роли переехали в пакет (трек `agent-roles-wave2`): [process.md](../../node_modules/dmg-core/docs/process.md) и `agents/` пакета; проектные документы ([agents.md](./agents.md), [agent-roles.md](./agent-roles.md)) оставляют только привязку к проекту. Роли пакета с префиксом `dmg-*` ([agent-roles.md](./agent-roles.md) §1, п. 6): `dmg-domain-author`, `dmg-api-author`, `dmg-reviewer`, `dmg-tech-lead`, `dmg-test-designer`, `dmg-data-keeper`; проектные роли без префикса.

## 6. Состояние переноса

- **Все модули на Def (DMG):** `wish` (эталон, гайды — [guides/](../../node_modules/dmg-core/docs/guides/index.md)), `peer-review`, `stream`, `questionnaire`, `course`, `user`, `dossier` (пустой модуль без поведения — `modules/dossier/README.md`). Детали — `summary.md` треков в `conductor/archive/` (`golden-wish`, `peer-review-dmg`, `stream-dmg`, `questionnaire-dmg`, `course-dmg`, `user-dmg`, `legacy-removal`).
- **Корень сборки (D-50, D-52):** `@u7-scl/app` (`platform/app`) — `U7App` по `AppEnv`: `AppContext` DMG, модули через `ApiApp` пакета, одна шина DMG, планировщик Job пакета (D-71 пакета), резолвер `Caller` (`U7CallerResolver`, субъект `UserAr`); `school/` — конфигурация школы, `infra/` — файловые адаптеры портов пакета. Раннер `u7-bot` и `scripts/` получают приложение из `U7App`.
- **Граф `dependsOn`** строится из `ModuleDef` (`scripts/domain-arch.ts`); `arch:check` сверяет код с реестром [debt.md](./debt.md); тактические решения перехода — `TR-<n>` там же (в код не пишутся).

### Входной долг для следующих треков

| Владелец | Долги |
|---|---|
| трек 7 `timestamp-data` | строковые даты в данных, «чтение строки» в схемах |
| трек `schools-system` | первый администратор новой школы — DEBT-52 |
| по мере касания | тесты UC/ER/Job на JSON во временном каталоге — DEBT-40; `update-stream-snapshot.ts` — запись через репозитории Def и UoW (TR-45); чтение `students.json` один раз на UoW (TR-44) |
| трек «История модулей курса» | одно правило «курс модуля» — DEBT-50 |
| при росте каталога | два вызова на модуль в карточке курса — DEBT-51 |
| `ui-manifests` / `dmg-ui` | id апдейта Telegram неявным контекстом — DEBT-41; `@u7-scl/core` (`ui`, `shared`) |
| `dmg-cli` | `call-uc` — DEBT-42 |

### Дальше

- **Ревизия** (условие релиза, §1) — сравнение с релизом `v0.2.6` (worktree `../u7-school-v0.2.6`), разбор `TR` (поля «Пересмотреть»), перепроектирование по решению Нурболата; затем — чек-лист релиза ниже. В её составе:
  - штатный отказ «гость без `/start`» (`actorResolver` бросает, бот молчит) и `includes` ERR-01 на `modules/*/src` — TR-68;
  - аудит контрактов после D-69 пакета (бывший кандидат `contract-audit`): обходы прежнего запрета классов в контракте — проекции UI в выходе query UC `stream` (TR-43 С1), типы событий анкет в `stories/questionnaire-events.ts` вместо контракта (TR-50 (6)), проход по `domain/src/*/contract.ts`; решение по каждому — Нурболат.
- Базовая линия тестов на конец перехода — `conductor/archive/legacy-removal_20261112/summary.md` («Гейт закрытия»).

### Чек-лист релиза (после перехода)

Выкатка — после ревизии по `../u7-school-v0.2.6`; каждый пункт с данными — с подтверждения Нурболата.

1. **`users.json` (трек `user-dmg`).** До выкатки нового кода:
   1. `bun run backup --name=before-drop-student` — защищённый снимок (скрипт миграции пишет файл без temp+rename).
   2. `bun run scripts/migrate-users-drop-student.ts` — сухой прогон: записи со `STUDENT` и все записи, не проходящие строгую схему (в т.ч. без `updatedAt`). Нурболат сверяет вывод с живым файлом.
   3. `bun run scripts/migrate-users-drop-student.ts --write` — с подтверждения Нурболата; повтор идемпотентен.
   4. Только после этого — рестарт на новом коде. Строгое чтение: одна невалидная запись останавливает все чтения `user`, в том числе резолвер `Caller` (ERR-01).
   - Legacy-писателя `users.json` в релизе нет — оба писателя на один файл теряют записи (отчёт `dmg-data-keeper` Ф2).
   - Первая команда нового кода переписывает `users.json` целиком в новом формате (числовые даты, `version`) — `v0.2.6` его не прочтёт; откат — только из снимка шага 1 (отчёт `dmg-data-keeper` Ф6).
2. **`questionnaires.json`** (TR-49 (7)): перед выкаткой `bun run backup`, откат — только с восстановлением файла.
