# План: уборка перед dmg-ui

> Spec — [spec.md](./spec.md). Исполнители: **O** — Opus, **S** — Sonnet (с 2026-11-14 DeepSeek не используется — решение Нурболата; механика — S или orchestrator сам, где промпт дороже работы; F в закрытых задачах — история). Порядок: Ф0 → Ф1 → Ф2 → Ф4 → Ф4а → Ф5 → Ф6 → Ф7; Ф3 — параллельно с Ф2 (разные репо). Одна фаза — одна сессия; Ф4 и Ф5 при объёме — по две.

---

## Фаза 0: Базовая линия [checkpoint: 529e4f9]

- [x] Task: Прогнать `CI=true bun run check` и `bun run test:bot`, записать числа в `summary.md` `596252e`
- [x] Task: Зафиксировать базовые счётчики повторов в тестах (`Trace.fromRequest({ requestId` 46, `mkdtemp` 50, `repoWith` 11, `press` 11, `buttonsOf`/`findBtn` 9, `waitMessageFor`/`waitUntil` 11, `makeLogger` 5, `subHandler` 4, `makeUiApp` 5) — команды grep и числа в `summary.md` `596252e`
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Реестры долга (`conductor/debt/`) [checkpoint: fc388fc]

- [x] Task: S — разбор `conductor/architecture/debt.md` (DEBT, §6 TR) и `conductor/roadmap/test-bloat.md`: таблица «запись → реестр / закрыть / знание в `decisions.md` или гайд» `afe161d`
- [x] Task: O — решения по спорным записям; `conductor/debt/README.md`: форматы `C-DEBT-n` / `T-DEBT-n` / `D-DEBT-n`, поле Триггер, «последний выданный ID», закрытие = удаление + коммит `закрыть <ID>`, разбор долга в конце трека и перед релизом `afe161d`
- [x] Task: F — создать `conductor/debt/{code,tests,product}.md`, перенести открытые записи (закономерности test-bloat — в README) `afe161d` — перенёс orchestrator: 9 записей и 7 строк, промпт F дороже работы
- [x] Task: O — перенести живое знание TR в `decisions.md`/гайды, удалить §6 `afe161d` — §6 уходит вместе с файлом в следующей задаче; ловушка `computeSourceHash` (TR-57) уже исправлена в коде, `askMatch` (TR-20) не ведётся
- [x] Task: O — завести `D-DEBT` «точный анализ совместимости контракта и гейт» из [vision.md](../../architecture/vision.md) §9 (триггер — перед web-ui); пункт в `vision.md` сократить до ссылки на запись `afe161d`
- [x] Task: F — ссылки по ФР-3а (`AGENTS.md`, `.agents-core/` → `agents:sync`, `.pi/skills/`, `CHANGELOG.md`, код, `conductor/`); удалить `architecture/debt.md`, `roadmap/test-bloat.md` `4c819be`
- [x] Task: O — ревью фазы `4c819be` — diff документов прочитан, хвосты (закрытые ID, висячие «С1») доправлены
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

**Критерии:** `check` зелёный (проверка пока старая, на новых путях); в реестрах только открытый долг, у каждой записи владелец или Триггер, есть «последний выданный ID»; grep старых путей и `TR-[0-9]` вне `archive/` и `revision-release_20261112` пуст; число тестов не изменилось.

## Фаза 2: dmg-core — проверка долга и тестовые хелперы (один релиз пакета) [checkpoint: f364593]

- [x] Task: O — из журнала TR (TR-8) в пакет: публикация событий UoW в `finally` — исключение шины подменяет результат, повтор после `VERSION_CONFLICT` повторяет события (ER идемпотентны); при внешней шине — публикация вне `finally`. Проверить по коду пакета, записать в его документы или `debt.md` `dmg-core@ad38a74` — `finally` нет с D-47 (outbox, шина не бросает); остаток — повтор после конфликта не на первом агрегате, дописан в `aggregate-lifecycle.md` и D-56
- [x] Task: S (`dmg-tech-lead`) — бриф для репо пакета ([slices/dmg-core-debt-testing.md](./slices/dmg-core-debt-testing.md)) `1e34a3d`: сверка форматов `dmg-core/scripts/debt-check.ts` и `checkDebt`/`checkTempMarkers` проекта, API `dmg-core/arch`, набор `dmg-core/testing` (`TEST_TRACE`, `testUuid(n)`, выборки `MemoryRepo` по предикату, временный каталог с автоочисткой), `docs:impact`
    - Префикс ID долга кода — параметр проверки: пакет — `DEBT-<n>`, проект — `C-DEBT-<n>` (README долга §2); голый `DEBT-<n>` в коде проекта — ошибка
- [x] Task: O — TDD в `~/dev/tools/dmg/dmg-core`: проверка трёх реестров и маркеров временности; хелперы testing; перенос сценариев старых тестов; `debt.md` пакета — на новую проверку `dmg-core@51d7f89`
    - [x] Тесты (red) → запуск → реализация (green)
- [x] Task: S (`documentarian`) — документы пакета по `docs:impact` `dmg-core@b57c858`, `7eb4c7b` — 4 правки аудита; `caller`, `errors`, `process` сверены (`docs:covers --strict` зелёный)
- [x] Task: O — коммит пакета; **стоп: тег и push — с подтверждения Нурболата**; смена `#vX.Y.Z` в 11 `package.json`, `bun install` `3aebabee` — теги v0.2.0, v0.2.1 (D-75 занят в общей нумерации → D-84); bun кеширует клон пакета без новых тегов — fetch тегов в `~/.bun/install/cache/<hash>.git`
- [x] Task: O — `scripts/arch-check.ts` вызывает функцию пакета на `conductor/debt/`; своя реализация и её тесты удалены из `scripts/` `fd33b29a`
    - `checkTrMarkers` и его фикстуры (`scripts/domain-check.test.ts`) удалить: журнала TR нет; до этого шага они — единственное исключение grep-критерия Ф1
- [x] Task: O — ревью фазы `e93c3d22`, `dmg-core@4839648` — `dmg-reviewer`: error нет; 2 warn и 4 info исправлены (пакет — в `main` без тега, уйдёт в следующий релиз)
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

**Критерии:** `check` пакета и проекта зелёные; негативный тест на каждое нарушение (ID не в реестре, запись без места, `T-DEBT` на несуществующий файл, ошибка формата `D-DEBT`); в `scripts/` нет своей реализации; пакет проверяет себя той же функцией.

## Фаза 3: Разбор TODO.md [checkpoint: ec045cd]

- [x] Task: S — таблица разбора: каждый пункт → закрыть / `DEBT` / `T-DEBT` / `D-DEBT` / `roadmap.md` / вход dmg-ui; принятые решения spec ФР-3 — без повторного вопроса `11a76286` — сверка Sonnet (`Explore`), таблица в `summary.md`
- [x] Task: O — записи в реестры (ID после «последнего выданного»), черновик входа dmg-ui `11a76286` — D-DEBT-4…6, C-DEBT-55, [roadmap/dmg-ui-entry.md](../../roadmap/dmg-ui-entry.md)
    - Во вход dmg-ui из журнала TR (TR-50): экран отказа по `Result` — `ucErrorScreen` (`stories/render.ts`) дублирует ветки `ucErrorNotify`; общий экран — вместе с контрактом story
- [x] Task: S — удалить `TODO.md`, ссылки `e0f1a2a9` — orchestrator: 4 ссылки, промпт дороже работы
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

**Критерии:** `TODO.md` нет; таблица разбора в `summary.md`, у каждого пункта адрес; `check` зелёный.

## Фаза 4: Перевод тестов на хелперы (4a — домен, модули, json-repo; 4b — бот) [checkpoint: cc36425e]

- [x] Task: S — карта повторов → целевой хелпер; где нужен `domain/src/<m>/testing.ts`; список исключений (unit-тесты stories, которые перепишет dmg-ui); бриф для F с примерами «до/после» — [slices/test-helpers.md](./slices/test-helpers.md); `mkdtemp` в UC/ER-тестах `wish`/`peer-review` — в Ф5 (фейки); база — 3170 тестов
- [x] Task: S — API `TestBotTransport` и `runners/u7-bot/tests/helpers` (`press`, `buttonsOf`, `findBtn`, `waitMessageFor`, `waitUntil`, `subHandler`, `makeUiApp`), `domain/src/<m>/testing.ts` `62b4b9ce` — `Screen`, `press`/`pressRaw`/`waitForMessage`, `waitUntil`, test-kit'ы `mockLogger`/`bot-transport`/`subscriptionOf`; новых `domain/src/<m>/testing.ts` не понадобилось
- [x] Task: S — массовый перевод пачками, `check` после каждой `f6617f0c`, `01f1b906`, `23c8309c` — П1–П4 по брифу; T-DEBT-1…7 закрыты (T-DEBT-6 погашен ещё в Ф2)
- [x] Task: O — разбор открытых `T-DEBT`; ревью выборкой; дубли TST-08 и расход токенов — в `summary.md` — открытых `T-DEBT` нет; `dmg-reviewer`: error нет
- [x] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

**Критерии:** локальных повторов из Ф0 нет (кроме самих хелперов); `mkdtemp` — только в хелпере; тестов ≥ базы минус перечисленные дубли; у каждой `T-DEBT` есть Триггер или владелец.

## Фаза 4а: Видимость контента — курс и поток (→ v0.3.1) [checkpoint: 9d848f88]

> Решение Нурболата 2026-11-14. Контент: 32 черновых шага «Термины урока» опубликованы (`data/courses/steps.json`). Правило:
> - чтение через API курса — всем только опубликованное; администратору, автору модуля и ментору — всё;
> - чтение из потока (по снимку) — элемент снимка виден участнику всегда, независимо от статуса в курсе;
> - сборка и обновление снимка — неопубликованный элемент даёт `warn`.

- [x] Task: O — открытые вопросы Нурболату (2026-11-14): неопубликованное видит **любой ментор** (роль); неопубликованный урок/шаг при сборке снимка — **пропустить с `warn`**; тем, кто видит неопубликованное, карточка урока/шага показывает отметку статуса, если он не «опубликован» (вид отметки — по UX, решает orchestrator в брифе)
- [x] Task: S (`dmg-tech-lead`) — бриф: правило `canSeeUnpublished` (+ментор), чтение шага из потока (UC `stream` поверх снимка или контекст потока у `get-step`; `dependsOn`), `warn` в `ModuleSnapshotDqs`/`get-module-snapshot` и `update-stream-snapshot`; потребители в боте (`step-view`, `nav-tree`, `learning/shared`, `view-stream`) — [slices/content-visibility.md](./slices/content-visibility.md); вариант A (UC `stream` поверх снимка + курсовой system-UC по `stepIds`)
- [x] Task: S — red-тесты по брифу (`dmg-test-designer`) — 61 red; тесты не закоммичены, уйдут в коммит реализации (workflow п.8)
- [x] Task: O/S — домен и прикладной слой (`dmg-domain-author`, `dmg-api-author`), бот — точечно; `dmg-reviewer` `a7ccf81a` — + замок по прогрессу (решение Нурболата); error нет; C-DEBT-56
- [x] Task: O — CHANGELOG `[0.3.1]`: изменение видимости (поведение для пользователя меняется — spec ФР-5 уточнить) `5f2cd36f` — в `[Unreleased]`, секция `[0.3.1]` — при релизе (Ф5); spec ФР-5а уточнён замком по прогрессу
- [x] Task: O — пересмотр Нурболата (2026-11-14): ментор не видит неопубликованное; тело опубликованного шага в каталоге — `MENTOR`/`AUTHOR`/админ/автор модуля, остальным — заголовки; ментор в «Мои потоки» — на stream-UC (бриф, раздел «Пересмотр»)
    - [x] red-тесты → домен → прикладной слой → бот; гейт, ревью; CHANGELOG `1e4dfcde` — + тело шага только в опубликованном модуле (решение orchestrator по ревью)
- [x] Task: Conductor - User Manual Verification 'Фаза 4а' (Protocol in workflow.md)

**Критерии:** студент потока открывает выданные и пройденные шаги снимка, остальные — заголовком; администратор и автор модуля видят неопубликованное с отметкой статуса; ментор и роль `AUTHOR` в каталоге — тело только опубликованных шагов; гость и подписчик в каталоге — только заголовки опубликованных шагов; сборка снимка с неопубликованным элементом пишет `warn` (тест); e2e бота зелёные.

## Фаза 5: Ранние модули `wish`, `peer-review` → v0.3.1

- [x] Task: S (`dmg-tech-lead`) — разбор по образцу `stream`/`course` (модель, UC, DQS/DCS, `dependsOn`, фейки, тесты), бриф с находками — [slices/early-modules.md](./slices/early-modules.md)
- [x] Task: O — крупное — вопросом Нурболату с вариантами; мелкое — сам; решения — `decisions.md` — крупного нет; вертикали модулей — на фейки, вход `wish` не правим (бриф, «Решения»); знания для `decisions.md` нет
- [x] Task: S — `wish`: фейк репозитория, перевод тестов UC/ER, правки по брифу `322f5513`
- [x] Task: S — `peer-review`: удалить `QuestionnaireModuleDef` из `dependsOn` и `peer-review-question-pool` (код, экспорт, тест), DQS — классы, фейки, перевод тестов, `dmg:sync` `322f5513` — `dmg:sync` к `dependsOn` не относится, граф сверяют `dmg:check`/`arch:check`; 3 теста фильтра фейка — в infra (`summary.md`)
- [x] Task: O — закрыть C-DEBT-40 (коммит `закрыть C-DEBT-40`), `dmg-reviewer`, CHANGELOG `[0.3.1]`; **стоп: тег и выкатка — с подтверждения Нурболата** `a2673f5f` — тег `v0.3.1` локальный; push и выкатка — после выкатки v0.3.0 (решение Нурболата 2026-11-14)
- [x] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md) — проверка на prod после выкатки v0.3.1 (Нурболат, 2026-11-14)

**Критерии:** у `peer-review` нет зависимости от `questionnaire`; у обоих модулей `*.repo.fake.ts`, тесты UC/ER без JSON во временном каталоге; C-DEBT-40 нет; e2e бота зелёные, поведение не изменилось; удалённые тесты `question-pool` — в `summary.md`.

## Фаза 6: Roadmap, документация, архив [checkpoint: e4151c00]

> Старт — новая сессия. v0.3.0 и v0.3.1 на prod (2026-11-14); трек ревизии уже в архиве в виде `spec.md` + `summary.md`, уроки выкатки — README, «Деплой».

- [x] Task: S — таблица по `roadmap.md` и `roadmap/`: упростить / удалить / в долг / во вход dmg-ui; знание уже в `decisions.md`? `57707136` — таблица в `summary.md`
- [x] Task: O — переписать `roadmap.md` и дочерние как видение (функционал, взаимодействие модулей, опорные `D-NN`, контуры решений); последовательность: `timestamp-data` (v0.3.2), delegation, dmg-ui (+ ui-manifests), dmg-cli `56e95cba` — 3376 → 847 строк, 9 файлов удалены; черновики дочерних — Sonnet в scratchpad, приёмка orchestrator
- [x] Task: O — `migration.md` в архив, состояние — `architecture/index.md`; `agents.md` §9 и автономный режим в `workflow.md` → режим после релиза; правило архива — в скилл `conductor-docs` и `workflow.md` `da8351f6` — план перехода — приложением к summary `legacy-removal`
- [x] Task: S — по каждому треку архива: живое в plan/slices/брифах → список переноса `57707136` — 4 агента; живое — в 3 треках из 152
- [x] Task: O — перенос знания по списку `da8351f6`, `dmg-core@1882e11` — задание пилота в `research/`, образец брифа → `agents.md` §5, ловушка `updatedAt` — гайд `aggregate` пакета (в `main` без тега)
- [x] Task: S — архив к виду `spec.md` + `summary.md`; `scripts/repo-layout.test.ts` и ссылки на удалённое `6d70c144` — orchestrator скриптом (промпт дороже работы): 536 файлов, 133 ссылки; страж «только spec/summary» в `repo-layout.test.ts`
- [x] Task: S (`documentarian`) — проход по документам `dmg-core` `dmg-core@72bdf0a` — 4 правки (RELEASING, `verified` двух концепций); `docs:covers` без warn
- [x] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md) — Нурболат, 2026-11-15: удалить неотслеживаемые файлы архива, видимость архивного — как сейчас, снимок — на решение orchestrator (D-85)

**Критерии:** `find conductor/archive -type f ! -name spec.md ! -name summary.md` пуст; у каждой инициативы `roadmap.md` — ссылка на `D-NN`; ссылок на удалённые файлы нет; `check` и `docs:check` пакета зелёные.

## Фаза 7: Вход dmg-ui и финал

- [x] Task: O — документ-вход dmg-ui (ФР-7); ссылка из `roadmap.md` `0ffbcb42` — ссылка из `roadmap.md` п. 4 уже была (Ф6)
- [x] Task: O — гейт закрытия (сравнение с Ф0), `summary.md` (дубли TST-08, расход токенов), `tracks.md` `eb214c12` — гейт нашёл хвост Ф4/Ф5 (`'r-1'` и `mkdtemp` в `wish`/`peer-review`), исправлен; `tracks.md` — после проверки Ф7
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md)

**Критерии:** документ есть и на него ссылается `roadmap.md`; `check` зелёный; все критерии приёмки spec закрыты.

---

## Риски

- Массовое удаление архива и TR теряет знание → отдельный шаг переноса, решает S/O, не F; список сохранённого — в `summary.md`.
- Релиз пакета (Ф2) блокирует Ф4 и Ф5.
- `.pi/agents` правится только через `.agents-core` + `agents:sync`.
- Удаление `QuestionnaireModuleDef` меняет граф `dmg:sync` — проверить потребителей.
