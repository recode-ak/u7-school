# План: уборка перед dmg-ui

> Spec — [spec.md](./spec.md). Исполнители: **O** — Opus, **S** — Sonnet, **F** — DeepSeek flash через pi (`scripts/pi-role.ts`, [deepseek.md](../../architecture/deepseek.md)). Порядок: Ф0 → Ф1 → Ф2 → Ф4 → Ф5 → Ф6 → Ф7; Ф3 — параллельно с Ф2 (разные репо). Одна фаза — одна сессия; Ф4 и Ф5 при объёме — по две.

---

## Фаза 0: Базовая линия

- [ ] Task: Прогнать `CI=true bun run check` и `bun run test:bot`, записать числа в `summary.md`
- [ ] Task: Зафиксировать базовые счётчики повторов в тестах (`Trace.fromRequest({ requestId` 46, `mkdtemp` 50, `repoWith` 11, `press` 11, `buttonsOf`/`findBtn` 9, `waitMessageFor`/`waitUntil` 11, `makeLogger` 5, `subHandler` 4, `makeUiApp` 5) — команды grep и числа в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Реестры долга (`conductor/debt/`)

- [ ] Task: S — разбор `conductor/architecture/debt.md` (DEBT, §6 TR) и `conductor/roadmap/test-bloat.md`: таблица «запись → реестр / закрыть / знание в `decisions.md` или гайд»
- [ ] Task: O — решения по спорным записям; `conductor/debt/README.md`: форматы `DEBT-n` / `T-DEBT-n` / `D-DEBT-n`, поле Триггер, «последний выданный ID», закрытие = удаление + коммит `закрыть <ID>`, разбор долга в конце трека и перед релизом
- [ ] Task: F — создать `conductor/debt/{code,tests,product}.md`, перенести открытые записи (закономерности test-bloat — в README)
- [ ] Task: O — перенести живое знание TR в `decisions.md`/гайды, удалить §6
- [ ] Task: F — ссылки по ФР-3а (`AGENTS.md`, `.agents-core/` → `agents:sync`, `.pi/skills/`, `CHANGELOG.md`, код, `conductor/`); удалить `architecture/debt.md`, `roadmap/test-bloat.md`
- [ ] Task: O — ревью фазы
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

**Критерии:** `check` зелёный (проверка пока старая, на новых путях); в реестрах только открытый долг, у каждой записи владелец или Триггер, есть «последний выданный ID»; grep старых путей и `TR-[0-9]` вне `archive/` и `revision-release_20261112` пуст; число тестов не изменилось.

## Фаза 2: dmg-core — проверка долга и тестовые хелперы (один релиз пакета)

- [ ] Task: S (`dmg-tech-lead`) — бриф для репо пакета: сверка форматов `dmg-core/scripts/debt-check.ts` и `checkDebt`/`checkTempMarkers` проекта, API `dmg-core/arch`, набор `dmg-core/testing` (`TEST_TRACE`, `testUuid(n)`, выборки `MemoryRepo` по предикату, временный каталог с автоочисткой), `docs:impact`
- [ ] Task: O — TDD в `~/dev/tools/dmg/dmg-core`: проверка трёх реестров и маркеров временности; хелперы testing; перенос сценариев старых тестов; `debt.md` пакета — на новую проверку
    - [ ] Тесты (red) → запуск → реализация (green)
- [ ] Task: S (`documentarian`) — документы пакета по `docs:impact`
- [ ] Task: O — коммит пакета; **стоп: тег и push — с подтверждения Нурболата**; смена `#vX.Y.Z` в 11 `package.json`, `bun install`
- [ ] Task: O — `scripts/arch-check.ts` вызывает функцию пакета на `conductor/debt/`; своя реализация и её тесты удалены из `scripts/`
- [ ] Task: O — ревью фазы
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

**Критерии:** `check` пакета и проекта зелёные; негативный тест на каждое нарушение (ID не в реестре, запись без места, `T-DEBT` на несуществующий файл, ошибка формата `D-DEBT`); в `scripts/` нет своей реализации; пакет проверяет себя той же функцией.

## Фаза 3: Разбор TODO.md

- [ ] Task: S — таблица разбора: каждый пункт → закрыть / `DEBT` / `T-DEBT` / `D-DEBT` / `roadmap.md` / вход dmg-ui; принятые решения spec ФР-3 — без повторного вопроса
- [ ] Task: O — записи в реестры (ID после «последнего выданного»), черновик входа dmg-ui
- [ ] Task: F — удалить `TODO.md`, ссылки
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

**Критерии:** `TODO.md` нет; таблица разбора в `summary.md`, у каждого пункта адрес; `check` зелёный.

## Фаза 4: Перевод тестов на хелперы (4a — домен, модули, json-repo; 4b — бот)

- [ ] Task: S — карта повторов → целевой хелпер; где нужен `domain/src/<m>/testing.ts`; список исключений (unit-тесты stories, которые перепишет dmg-ui); бриф для F с примерами «до/после»
- [ ] Task: S — API `TestBotTransport` и `runners/u7-bot/tests/helpers` (`press`, `buttonsOf`, `findBtn`, `waitMessageFor`, `waitUntil`, `subHandler`, `makeUiApp`), `domain/src/<m>/testing.ts`
- [ ] Task: F — массовый перевод пачками, `check` после каждой
- [ ] Task: O — разбор открытых `T-DEBT`; ревью выборкой; дубли TST-08 и расход DeepSeek — в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

**Критерии:** локальных повторов из Ф0 нет (кроме самих хелперов); `mkdtemp` — только в хелпере; тестов ≥ базы минус перечисленные дубли; у каждой `T-DEBT` есть Триггер или владелец.

## Фаза 5: Ранние модули `wish`, `peer-review` → v0.3.1

- [ ] Task: S (`dmg-tech-lead`) — разбор по образцу `stream`/`course` (модель, UC, DQS/DCS, `dependsOn`, фейки, тесты), бриф с находками
- [ ] Task: O — крупное — вопросом Нурболату с вариантами; мелкое — сам; решения — `decisions.md`
- [ ] Task: S/F — `wish`: фейк репозитория, перевод тестов UC/ER, правки по брифу
- [ ] Task: S/F — `peer-review`: удалить `QuestionnaireModuleDef` из `dependsOn` и `peer-review-question-pool` (код, экспорт, тест), DQS — классы, фейки, перевод тестов, `dmg:sync`
- [ ] Task: O — закрыть DEBT-40 (коммит `закрыть DEBT-40`), `dmg-reviewer`, CHANGELOG `[0.3.1]`; **стоп: тег и выкатка — с подтверждения Нурболата**
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

**Критерии:** у `peer-review` нет зависимости от `questionnaire`; у обоих модулей `*.repo.fake.ts`, тесты UC/ER без JSON во временном каталоге; DEBT-40 нет; e2e бота зелёные, поведение не изменилось; удалённые тесты `question-pool` — в `summary.md`.

## Фаза 6: Roadmap, документация, архив

- [ ] Task: S — таблица по `roadmap.md` и `roadmap/`: упростить / удалить / в долг / во вход dmg-ui; знание уже в `decisions.md`?
- [ ] Task: O — переписать `roadmap.md` и дочерние как видение (функционал, взаимодействие модулей, опорные `D-NN`, контуры решений); последовательность: `timestamp-data` (v0.3.2), delegation, dmg-ui (+ ui-manifests), dmg-cli
- [ ] Task: O — `migration.md` в архив, состояние — `architecture/index.md`; `agents.md` §9 и автономный режим в `workflow.md` → режим после релиза; правило архива — в скилл `conductor-docs` и `workflow.md`
- [ ] Task: S — по каждому треку архива: живое в plan/slices/брифах → список переноса
- [ ] Task: O — перенос знания по списку
- [ ] Task: F — архив к виду `spec.md` + `summary.md`; `scripts/repo-layout.test.ts` и ссылки на удалённое
- [ ] Task: S (`documentarian`) — проход по документам `dmg-core`
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)

**Критерии:** `find conductor/archive -type f ! -name spec.md ! -name summary.md` пуст; у каждой инициативы `roadmap.md` — ссылка на `D-NN`; ссылок на удалённые файлы нет; `check` и `docs:check` пакета зелёные.

## Фаза 7: Вход dmg-ui и финал

- [ ] Task: O — документ-вход dmg-ui (ФР-7); ссылка из `roadmap.md`
- [ ] Task: O — гейт закрытия (сравнение с Ф0), `summary.md` (дубли TST-08, расход DeepSeek), `tracks.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md)

**Критерии:** документ есть и на него ссылается `roadmap.md`; `check` зелёный; все критерии приёмки spec закрыты.

---

## Риски

- Массовое удаление архива и TR теряет знание → отдельный шаг переноса, решает S/O, не F; список сохранённого — в `summary.md`.
- Релиз пакета (Ф2) блокирует Ф4 и Ф5.
- `.pi/agents` правится только через `.agents-core` + `agents:sync`.
- Удаление `QuestionnaireModuleDef` меняет граф `dmg:sync` — проверить потребителей.
