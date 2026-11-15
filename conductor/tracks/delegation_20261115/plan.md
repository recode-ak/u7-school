# План: `delegation` — делегирование в `dmg-core`

> Spec — [spec.md](./spec.md). Исполнители: **O** — Opus, **S** — Sonnet (роли `conductor/architecture/agents.md` §4). Ф0–Ф7 — репо `~/dev/tools/dmg/dmg-core` (порядок правки — `conductor/architecture/index.md`, «Правка платформы `dmg-core`»), Ф8–Ф9 — u7-school.
>
> Порядок: Ф0 → {Ф1, Ф2} → Ф3 → Ф4; Ф5 — после Ф1, параллельно с Ф3–Ф4; затем Ф6 → Ф7 → Ф8 → Ф9. Старт — после закрытия трека `timestamp-data`.
>
> Рабочие имена: `personal` (признак Def UC), `DeclaredCaller` (словарь `callers`), `DelegateCaller.readOnly`, `DelegationClaim`, `DelegationStore`, `DelegationRecord`, `DelegationCheck`, `CoreErrors.DELEGATION_DENIED`, правило MAN-14, решение D-89.

---

## Фаза 0: Базовая линия и решения [checkpoint: 502ea291]

- [x] Task: O — `bun run check` и `bun run e2e` в пакете; `bun run check`, `CI=true bun test`, `arch:check` в u7-school (уже на v0.3.2); числа — в `summary.md` `2c49c654`
- [x] Task: O — `docs/decisions.md` пакета: D-25 переписан, D-89 черновиком (словарь `callers`, `personal`, `readOnly`, заявка, ошибка) — решение раньше правки контракта `2c49c654` (пакет `f06480b`)
- [x] Task: O — роль `dmg-access-auditor` в проекте (рядом с `migrator`); раздел «Пилот ролей» в `summary.md` `2c49c654`
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

**Критерии:** числа обоих репо в `summary.md`; `grep -n "D-89" docs/decisions.md` не пуст; файл роли есть, субагент `dmg-access-auditor` запускается.

## Фаза 1: допуск заместителя (ФР-1–4) [checkpoint: faec80c9]

- [x] Task: S (`dmg-test-designer`) — red-тесты
    - [x] `DelegateCaller` проходит `callers: ['user']`; Policy получает замещаемого; в записи oplog оба идентификатора
    - [x] `'delegate'` в `callers` — ошибка типа (`@ts-expect-error`)
    - [x] `personal`: отказ заместителю прямо и от `SystemCaller` с заместителем
    - [x] `readOnly`: command — отказ (прямо и от `SystemCaller`), query — успех
    - [x] JSON и лог с `readOnly` и без него (старая форма читается)
    - [x] `normalize` и граф показывают `personal`
    - [x] Запуск — падают по делу
- [x] Task: O (`dmg-api-author`) — тип `DeclaredCaller` и метод вида у `Caller`; `readOnly` у `DelegateCaller`; приватный шаг допуска в `UseCaseFromDef` (не в `protected checkCaller`); нормализация; описание `UNAUTHORIZED`; образец и фикстуры без `delegate` в `callers`; документы — по `bun run docs:impact` `187c98bc` (пакет `64af7d9`, `484db75`)
- [x] Task: O (`dmg-reviewer`) — ревью; замечания error/warn исправлены `187c98bc`
- [x] Task: S (`dmg-access-auditor`) — пилот: нет ли обхода допуска; запись в «Пилот ролей» `187c98bc`
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

**Критерии:** `bun run check` зелёный, тестов не меньше базовой линии; `grep -rn "'delegate'" src/testing/example src/domain/contracts/contracts.fixture.ts src/graph --include=*.ts` — только вид класса и лог, не `callers`; `grep -n "personal" src/graph/normalize.test.ts` не пуст; `docs:covers --strict` без предупреждений.

## Фаза 2: «query не вызывает command» (ФР-5) — параллельно с Ф1 [checkpoint: ff773410]

- [x] Task: S (`dmg-test-designer`) — red в `def-checker.test.ts`: query с command в `calls` — нарушение; query с query — нет `799f41f0`
- [x] Task: S (`dmg-api-author`) — проверка по образцу `checkCalls`; MAN-14 в `rules.md` и `violation.ts`; формулировка MAN-05 `799f41f0` (пакет `9994ad8`)
- [x] Task: S (`dmg-reviewer`) — ревью `799f41f0`
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

**Критерии:** `grep -n "MAN-14" docs/reference/rules.md src/arch/violation.ts src/arch/def-checker.test.ts` — во всех трёх; `bun run check` зелёный.

## Фаза 3: проверка заявки (ФР-6) — после Ф1

- [x] Task: S (`dmg-test-designer`) — red-тесты `DelegationCheck`: успех; нет записи; пара не совпала; срок истёк; отозвано; делегирование не подключено; часы — подставные `d5f34ae6`
- [x] Task: O (`dmg-api-author`) — `DelegationClaim`, `DelegationStore`, `DelegationRecord`, `DelegationCheck`, `DELEGATION_DENIED` (`kind: 'unauthorized'`, причина в payload); экспорт из пакета `d5f34ae6` (пакет `1d3e613`)
- [x] Task: O (`dmg-reviewer`) — ревью `d5f34ae6`
- [x] Task: S (`dmg-access-auditor`) — пилот `d5f34ae6`
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

**Критерии:** `bun run check` зелёный; в тесте класса есть случай на каждую из четырёх причин; `DELEGATION_DENIED` в `core-errors.ts` с `kind: 'unauthorized'`.

## Фаза 4: каркас и образец (ФР-7) — после Ф3

- [ ] Task: S (`dmg-test-designer`) — red: резолвер образца с заявкой (успех, каждый отказ, чужой заместитель, нет пользователя, `readOnly` из записи); резолвер каркаса без порта — отказ; раннер печатает отказ и выходит с кодом «отклонено»
- [ ] Task: S (`dmg-api-author`) — `ExampleDelegationStore` и резолвер в `src/testing/example/app/`; `CallerResolver` возвращает `Result`; шаблоны `app-sources.ts`; раннеры каркаса и образца
- [ ] Task: O (`dmg-reviewer`) — ревью
- [ ] Task: S (`dmg-access-auditor`) — пилот
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

**Критерии:** `bun run check && bun run e2e` зелёные; `grep -rln "DelegationStore" src/testing/example/app` не пуст.

## Фаза 5: oplog (ФР-8) — после Ф1

- [ ] Task: S (`dmg-test-designer`) — red: `--actor` находит записи заместителя и системные с этим заместителем; `--request` по `requestId` находит цепочку его `correlationId`
- [ ] Task: S (`dmg-api-author`) — фильтр `actor`, флаг CLI, лента; запись DEBT-1 удалена
- [ ] Task: S (`dmg-reviewer`) — ревью
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

**Критерии:** `grep -n "### DEBT-1" debt.md` пуст; `grep -rn "correlationId !== f.request" src/app/oplog` пуст; `bun test src/cli src/app/oplog` зелёные.

## Фаза 6: документы (ФР-9) — после Ф1–Ф5

- [ ] Task: O — гайд `docs/guides/delegation.md`: что завести в приложении, рекомендованная запись (выдавший, причина), два сценария, какие UC пометить `personal`; D-25 и D-89 окончательно; `docs/index.md`, `docs/guides/index.md`
- [ ] Task: O — запись в `debt.md` пакета: запись из query UC не запрещена (триггер — первое приложение включает «только чтение»)
- [ ] Task: S (`documentarian`, аудит; правка — O) — `concepts/caller.md`, `reference/{caller,transport,oplog}.md`, `rules.md` (MAN-11), `guides/use-case.md`, `llms.txt`, скил `dmg-architecture`, роли `agents/roles/`
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)

**Критерии:** `bun run docs:covers --strict` без предупреждений; гайд ссылается на `src/testing/example/app`; `documentarian` без расхождений; `grep -rn "'delegate'" docs llms.txt skills agents` — только вид класса и лог.

## Фаза 7: релиз пакета v0.4.0

- [ ] Task: O — по `RELEASING.md`: `check`, `e2e`, `docs:covers --strict`, версия, тег `v0.4.0`
- [ ] Task: O — push `main` и тега — **после подтверждения Нурболата**; тег и SHA — в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md)

**Критерии:** `version` 0.4.0; тег `v0.4.0` на коммите релиза; установка из git проверена по чек-листу.

## Фаза 8: u7-school на v0.4.0 (ФР-11)

- [ ] Task: S (`migrator`) — `#v0.4.0` во всех `package.json`, `bun install`, `dmg:sync`, `agents:sync`; версия в `AGENTS.md`; `--actor` в подсказке `scripts/oplog.ts`
- [ ] Task: S (`dmg-reviewer`) — ревью
- [ ] Task: Conductor - User Manual Verification 'Фаза 8' (Protocol in workflow.md)

**Критерии:** одна версия `#v0.4.0` во всех `package.json`; `bun run check`, `CI=true bun test`, `arch:check` зелёные, тестов не меньше базовой линии; `git diff --stat <база> -- domain modules platform/app/src/u7-caller-resolver.ts` пуст.

## Фаза 9: записи и итог (ФР-12, ФР-10)

- [ ] Task: O — `conductor/debt/product.md`: служебный доступ в боте (погашает трек после пилота `dmg-ui`)
- [ ] Task: O — `conductor/roadmap/dmg-ui-entry.md` (актор сторис — возможно заместитель); `conductor/roadmap.md` (delegation убран из этапа 1)
- [ ] Task: O — итог пилота `dmg-access-auditor`: `summary.md` и `conductor/architecture/agent-roles.md`
- [ ] Task: O — финальный гейт workflow: полный `CI=true bun test`, триаж и сравнение с базовой линией — в `summary.md`; разбор трёх реестров долга
- [ ] Task: Conductor - User Manual Verification 'Фаза 9' (Protocol in workflow.md)

**Критерии:** `grep -n "служебный доступ" conductor/debt/product.md` не пуст; `grep -in "заместител" conductor/roadmap/dmg-ui-entry.md` не пуст; `grep -in "delegation\|DelegateCaller" conductor/roadmap.md` пуст; в `summary.md` есть «Пилот ролей» и числа гейта.
