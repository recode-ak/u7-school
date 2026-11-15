# Бриф Ф1: `F.timestamp` только число (dmg-core v0.3.2)

Трек — [spec.md](../spec.md) (ФР-1), [plan.md](../plan.md) Ф1.

## Границы

- Репо: **`~/dev/tools/dmg/dmg-core`** (не `node_modules/dmg-core` в u7-school — он только для чтения).
- Прод-код: `src/kernel/fields/fields.ts` — только `F.timestamp` (и связанное, если нужно: `withEntityDefaults` и т. п.).
- Тесты: `src/kernel/fields/fields.test.ts`, `src/testing/example/todo/task/task.state.test.ts`, прочие тесты пакета с ISO-входами в `F.timestamp` (`grep -rnE "ISO|T[0-9]{2}:[0-9]{2}"`: `snapshot-json`, `project-scaffold.e2e`, `debt-checker`, `lint-fixtures` — проверить, что относится к `F.timestamp`, остальное не трогать).
- Документы (правит оркестратор): `docs/decisions.md` D-16, `docs/guides/state.md`, `docs/reference/manifests.md`, `llms.txt`, `CHANGELOG.md`.
- u7-school в этой фазе не меняется.

## Было → станет

- **Было:** `F.timestamp` принимает конечное число или ISO-строку (`parseIso`, union + `transform` → число).
- **Станет:** `F.timestamp` — только число: `integer`, `minValue(0)`. ISO-строка, произвольная строка, `NaN`, `±Infinity`, отрицательное, дробное — ошибка схемы. Вспомогательные `parseIso`/`isoDateTime`/`isoTimestamp` в `src/kernel/fields` удалены.

## Критерии приёмки

1. `bun run check` и `bun run e2e` пакета зелёные; тестов не меньше 1648 (базовая линия) за вычетом обоснованно удалённых — отчитаться списком.
2. `grep -rn "isoDateTime\|isoTimestamp\|parseIso" src/kernel/fields` пуст.
3. В `fields.test.ts` есть тест «отвергает ISO-строку» и тесты на каждый отвергаемый вид входа.
4. Тесты «ISO-дата → число» переписаны на «ISO отвергается» (сценарий сохранён, ожидание инвертировано — TST-08: тест переезжает, не копируется).

## Правила

ID из `docs/reference/rules.md` пакета: TST-* (TDD, перенос тестов), правила полей state (`F.*`). Новых зависимостей нет.

## Шаги

1. `dmg-test-designer` — red-тесты (код не трогает), запуск — падают по делу.
2. `dmg-domain-author` — правка `fields.ts`, тесты зелёные, `bun run check`.
3. Оркестратор — документы; `documentarian` — аудит.
4. `dmg-reviewer` — ревью diff.

## Открытые вопросы

—

## Отчёты

### Ф1 шаг 1 — dmg-test-designer

Изменены (dmg-core): `src/kernel/fields/fields.test.ts`, `src/testing/example/todo/task/task.state.test.ts`. Прочих тестов с ISO в `F.timestamp` нет (snapshot-json, e2e, debt-checker, lint-fixtures — на числах; ISO в oplog/job-тестах — не про `F.timestamp`, не тронуты).

Новые/переписанные сценарии:
- `F.timestamp`: «принимает ноль»; отвергает ISO без зоны, ISO с зоной, «вчера», числовую строку, NaN, Infinity, -Infinity, отрицательное, дробное (старые «читает legacy/полный ISO» инвертированы).
- `BaseEntityFields`, `withEntityDefaults`: входы числами.
- `task.state.test.ts`: числовые даты + отдельные «отвергает ISO» для `TaskAssignmentVo.assignedAt`, `TaskState.createdAt/updatedAt`, `assignment.assignedAt`.

Красные (6, по делу — схема ещё принимает строку/отрицательное): `F.timestamp` отвергает ISO без зоны, ISO с зоной, отрицательное; `TaskAssignmentVo` отвергает ISO; `TaskState` отвергает ISO-даты, отвергает назначение с ISO. Зелёные уже сейчас (старая схема их отвергала): NaN, ±Infinity, дробное, «вчера», числовая строка.
Запуск: `bun test` по двум файлам — 42 pass, 6 fail. biome чист. Кандидатов в чистку тестов нет.

### Ф1 шаг 2 — dmg-domain-author

Статус: эскалация (прод-код готов; `check` красный на `tslint` из-за типа в red-тесте, тесты по брифу не правлю).

Изменено (dmg-core): `src/kernel/fields/fields.ts` — `F.timestamp` = `v.pipe(v.number(), v.integer(), v.minValue(0), v.description)`, JSDoc по-русски (D-16); удалены `parseIso`, `ZONE`, union с `isoDateTime`/`isoTimestamp`, `transform`, импорт `Timestamp`. `grep isoDateTime|isoTimestamp|parseIso src/kernel/fields` — пуст.

Проверки: `lint` — pass; `tslint` — fail: `task.state.test.ts(56,46)` TS2769 — в `base` `status: 'open'` выводится как `string`, а `toEqual({ ...base, version: 0 })` ждёт `TaskState`-тип (раньше спасал явный `status: 'open'` в ожидании). `bun test` — 1658 pass, 0 fail; `docs:covers` — pass (3 warn о свежести, не про этот срез); `docs:jsdoc` — pass.
Рекомендация: автору тестов поправить строку 50 `task.state.test.ts` на `status: 'open' as const` (или явный `status: 'open'` в ожидании) — после этого `check` зелёный.

Места в документах (чтение ISO в `F.timestamp`): `docs/decisions.md:45` (D-16 «Переходные схемы читают ISO-строку»); `docs/guides/state.md:28` (тест «разбор ISO-дат (в т. ч. без зоны) в числа»). `llms.txt` и `docs/reference/manifests.md` — упоминаний нет; `CHANGELOG.md` в репо нет.
Отклонения: нет.

### Ф1 шаг 3 — documentarian

Расхождений по `F.timestamp` нет. Проверено: `docs/` (decisions D-16, guides/state.md, reference/manifests.md:41, rules.md DOM-12), `llms.txt`, `README.md`, `skills/`, `agents/`, `RELEASING.md`, JSDoc `fields.ts:4` — утверждений о чтении ISO / переходных схемах не осталось. D-16 (decisions.md:45) и state.md:28,34 сходятся с кодом (`number → integer → minValue(0)`). Остатки `isoDateTime` в `src/gen`, `module-def.types.ts`, `app/uow` — не про `F.timestamp`.
Мелочь (не расхождение): decisions.md:45 «до перехода на эту версию» — v0.3.2 ещё не выпущена, формулировка верна после релиза.

`docs:covers --strict`, 3 warn — только отстала дата `verified`, содержание не устарело:
- `concepts/domain.md` ×2 (`verified: c456e8d`): `src/domain/**` — a785e66 (0.3.1, переименование `baseline/current` → `baselineState/currentState` в aggregate.ts); `src/testing/example/todo/**` — a6043b1 (числовые даты в тестах), 48ef559. В доке нет ни `baseline`, ни дат — править нечего.
- `guides/project.md`: `src/cli/scaffold/**` — a785e66 (правило DOM-17 в lint-map.ts); док ссылается на карту линтера в rules.md, где `dom-17` есть. Править нечего.
Вывод: текст не менять, подтвердить свежесть коммитом «docs: verified <sha> — concepts/domain, guides/project сверены» (обновить `verified:` в обоих; для domain.md и project.md, после коммита среза).

### Ф1 шаг 4 — dmg-reviewer

Diff: `edd0dc0..HEAD` (a6043b1, 6a3e238), рабочее дерево чистое. Файлы прочитаны целиком.

| ID | файл:строка | суть | severity |
|---|---|---|---|
| TST-08, TST-09 | src/testing/example/todo/task/task.state.test.ts:18, :59, :83 | Три теста «отвергает ISO» (`TaskAssignmentVo`, `TaskState` даты, `assignment.assignedAt`) повторяют правило `F.timestamp`, уже покрытое в `fields.test.ts:23–47`; по TST-09 разбор схем платформы в тестах модуля не проверяется, а учебный модуль — образец для авторов. Бриф (критерий 4) требовал инверсию, поэтому это вопрос: оставить один сквозной сценарий или ни одного | question |
| — | docs/guides/state.md:28 | Образец теперь объявляет «ISO-строка отвергается» частью теста state: это закрепляет в образце проверку разбора платформы (связано с замечанием выше); решать вместе с ним | вне границ |
| — | package.json:3 | Заголовок брифа — «dmg-core v0.3.2», версия осталась 0.3.1, а в D-16 написано «с v0.3.2». Повышение версии и тег в шагах брифа не указаны: кто и когда их делает? | question |

Проверено, замечаний нет: схема (`number → integer → minValue(0) → description`; тип выхода `number` = `Timestamp`, лишних путей нет, `transform` удалён); критерий 2 (grep пуст); критерий 3 (ноль, ISO с зоной и без, произвольная строка, числовая строка, NaN, ±Infinity, отрицательное, дробное); TST-05/TST-08 по переносу (сценарии «читает ISO» инвертированы, не скопированы; `BaseEntityFields`/`withEntityDefaults` перешли на числа, сценарии сохранены); CODE-04 (JSDoc в 1 строку, D-16 в первом предложении, указаны единицы); D-16 и `state.md` соответствуют коду; других упоминаний ISO-чтения в `docs/`, `llms.txt` нет; DOM-12 не затронуто.
Проверки: `bun run check` — зелёный (1658 pass, это больше базовых 1648, удалённых тестов нет; 3 warn `docs:covers` о свежести, не связаны с ISO); `bun run e2e` — ok.
