# План перехода

**Назначение:** история перехода на DMG — порядок треков, что он исправил, итог и чек-лист релиза. Переход завершён треком `legacy-removal` (2026-11-12); до релиза — ревизия (§1).

---

## 1. Принципы

- **Strangler:** старое и новое работают параллельно; модуль за модулем, гейт зелёный после каждого шага.
- **Переносить и перепроектировать — отдельно.** Сначала механический перенос (поведение не меняется), затем перевод на Def.
- **Данные в `data/`** — только отдельным треком (D-16), с `bun run backup` и подтверждением Нурболата.
- **Без деплоя до релиза.** Релиз — после **ревизии** (отдельный трек): сравнение с релизом `v0.2.6` (worktree `../u7-school-v0.2.6`), разбор долга и перепроектирование, затем чек-лист релиза (§6). Критерий §5 — целевое состояние, а не условие релиза (Нурболат, 2026-11-12). До релиза работа идёт в автономном режиме ([agents.md](./agents.md) §9), промежуточная работоспособность не требуется.

## 2. Порядок треков

| # | Трек | Суть | Исполнитель |
|---|---|---|---|
| 0 | **agents-setup** | роли агентов для Claude Code и pi из одного источника, хук гейта в обеих средах, режим оркестратора и передача между средами в `conductor-implement` ([agents.md](./agents.md) §8) | orchestrator |
| 1 ✅ | **core-dmg** | `Result`, Def-классы (`XxxDef.define`), `F.*`, `Timestamp`, `ReadonlyAr`, Aggregate v2, UoW, `Caller` и `callers`, `normalize(def)`, `*FromDef`, `appApi.run`, граф-движок, `arch:check`, линт-правила ARC/DOM/CODE | orchestrator + Нурболат |
| 1б ✅ | **dmg-core-extract** | платформа DMG — отдельный пакет `dmg-core` (npm), развязка от legacy, самодостаточные конфиги, готовность модулей к выносу в сервисы ([D-28](./decisions.md)); пакет готов к выносу, сам вынос — по чек-листу в spec трека после релиза. Трек: `conductor/archive/dmg-core-extract_20261020` | orchestrator + Нурболат |
| 2 ✅ | **generators** | `bun run gen` для всех видов артефактов по [naming.md](./naming.md) | orchestrator + Нурболат |
| 3 ✅ | **domain-package** | трек: `conductor/archive/domain-package_20261020`, реестр долга — [conductor/debt/](../debt/README.md). Пакет-каркас `@u7-scl/domain` создан в треке generators; наполнить: механически перенести domain-слои снизу вверх: user (+ `User` из app) → course → questionnaire → stream → wish → peer-review → dossier. Старые пути `@u7-scl/<m>/domain` временно реэкспортируют | migrator |
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

Legacy-кода нет. Осталось — с владельцами в [реестрах долга](../debt/README.md) и треках:

- Схемы с `F.timestamp` читают ISO-строку и число, пишут число — данные мигрируют лениво до трека 7 (`timestamp-data`); тесты и комментарии «legacy-запись» в репозиториях — про формат данных, не про код.
- `@u7-scl/core` — только `ui` и `shared`; кандидат на удаление при переводе UI в `dmg-ui`.
- `call-uc` — ручной вход до `dmg-cli` (C-DEBT-42).
- `throw*` для штатных отказов — аудит в `summary.md` трека `legacy-removal` (исправление — отдельно).

## 5. Критерий завершения

Все модули в `@u7-scl/domain`, нет реэкспортов в старых пакетах, нет `throw*` для штатных отказов, нет строковых дат, все проверки [rules.md](./rules.md) машинные — блокирующие, кроме помеченных `review`; документ паттернов legacy удалён.

**Итог (`legacy-removal`):** выполнено, кроме строковых дат (трек 7, после релиза) и `throw*` (аудит — §4; закрыт ревизией: гость без `/start`). Это остаток, а не legacy: переход завершён.

Общее видение процесса и оправдавшие себя роли переехали в пакет (трек `agent-roles-wave2`): [process.md](../../node_modules/dmg-core/docs/process.md) и `agents/` пакета; проектные документы ([agents.md](./agents.md), [agent-roles.md](./agent-roles.md)) оставляют только привязку к проекту. Роли пакета с префиксом `dmg-*` ([agent-roles.md](./agent-roles.md) §1, п. 6): `dmg-domain-author`, `dmg-api-author`, `dmg-reviewer`, `dmg-tech-lead`, `dmg-test-designer`, `dmg-data-keeper`; проектные роли без префикса.

## 6. Состояние переноса

- **Все модули на Def (DMG):** `wish` (эталон, гайды — [guides/](../../node_modules/dmg-core/docs/guides/index.md)), `peer-review`, `stream`, `questionnaire`, `course`, `user`, `dossier` (пустой модуль без поведения — `modules/dossier/README.md`). Детали — `summary.md` треков в `conductor/archive/` (`golden-wish`, `peer-review-dmg`, `stream-dmg`, `questionnaire-dmg`, `course-dmg`, `user-dmg`, `legacy-removal`).
- **Корень сборки (D-50, D-52):** `@u7-scl/app` (`platform/app`) — `U7App` по `AppEnv`: `AppContext` DMG, модули через `ApiApp` пакета, одна шина DMG, планировщик Job пакета (D-71 пакета), резолвер `Caller` (`U7CallerResolver`, субъект `UserAr`); `school/` — конфигурация школы, `infra/` — файловые адаптеры портов пакета. Раннер `u7-bot` и `scripts/` получают приложение из `U7App`.
- **Граф `dependsOn`** строится из `ModuleDef` (`scripts/domain-arch.ts`); `arch:check` сверяет код с реестром [code.md](../debt/code.md); отдельного журнала тактических решений нет — знание идёт в `decisions.md`, временный код — в запись `C-DEBT-<n>` (в код не пишется).

### Входной долг для следующих треков

| Владелец | Долги |
|---|---|
| трек 7 `timestamp-data` | строковые даты в данных, «чтение строки» в схемах |
| трек `schools-system` | первый администратор новой школы — bootstrap школы ([schools-system](../roadmap/schools-system.md), вопрос 7) |
| по мере касания | чтение `students.json` один раз на UoW |
| трек «История модулей курса» | одно правило «курс модуля» — C-DEBT-50 |
| при росте каталога | два вызова на модуль в карточке курса — C-DEBT-51 |
| `ui-manifests` / `dmg-ui` | id апдейта Telegram неявным контекстом — C-DEBT-41; `@u7-scl/core` (`ui`, `shared`) |
| `dmg-cli` | `call-uc` — C-DEBT-42 |

### Итог ревизии (`revision-release_20261112`, 2026-11-14)

- **Сверка с v0.2.6:** 491 сценарий — совпадает или изменён намеренно (со ссылкой на трек, D-NN или запись долга); регрессии исправлены, у каждого сценария — e2e или решение «без e2e» (карточка C-14 трека).
- **Долг:** записи с пометкой «Пересмотреть» разобраны; решения — `cards.md` трека, D-73…D-77.
- **Дальше:** трек 7 `timestamp-data`; кандидаты `[?]` в [tracks.md](../tracks.md) — снимок контента потока через домен (F-80), домен на фронте для `stream` (F-110), патч полей в логе операций (F-111).
- Базовая линия тестов на конец перехода — `conductor/archive/legacy-removal_20261112/summary.md` («Гейт закрытия»); на релиз — `summary.md` трека ревизии.

### Чек-лист релиза (после перехода)

Выкатка v0.3.0 — по [rollout.md](../tracks/revision-release_20261112/rollout.md) трека ревизии: порядок на prod (стоп → бэкап → `git pull` → миграции → запуск через `pm2 delete` + `start:prod`), миграции по файлам, откат только из снимка, env, остатки `apps`/`packages`. Каждый шаг с данными — с подтверждения Нурболата.

Главное из него:
- **`users.json`** — единственная обязательная миграция: `migrate-users-drop-student` (сухой прогон → `--write`) до запуска нового кода; без неё роль `STUDENT` роняет все чтения `user`, включая резолвер `Caller` (ERR-01).
- **Откат — только код + файлы снимка:** новый код пишет числовые даты и `version`, v0.2.6 такие записи молча пропускает и при первой записи теряет.
- **`scripts/deploy.sh` для 0.3.0 не использовать:** `pm2 restart` по имени запускает точку входа v0.2.6, которой в 0.3.0 нет.
