# Plan: dmg-docs_20261029

Каждая фаза — отдельная сессия. Код — TDD (red → запуск → green). Правки пакета — коммит в `~/dev/tools/dmg/dmg-core` (зелёные `check` и `e2e`), затем в u7-school `bun install`, `dmg:sync`/`agents:sync` при изменении доставляемых файлов, `check`, коммит с SHA пакета. Данные `data/` не трогаем; пушей и деплоя нет.

## Фаза 0: Базовая линия [checkpoint: d257e23]

- [x] Task: Зафиксировать базовую линию: `bun test`, `bun run e2e` пакета и u7-school; точный замер `dmg-core/src` (доля комментариев, блоки ≥12 строк, строки с `D-NN`, `TR-NN`) в черновике `summary.md` f9868e4
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md) d257e23

## Фаза 1: Правило и решение [checkpoint: d78ad64]

- [x] Task: Решение `D-NN` в `decisions.md` пакета: типы документов, ответственность, направление ссылок, критерий «оправдан»; обсудить с Нурболатом dmg-core@5752f08 (D-59; reference — каталог `docs/reference/`, предел JSDoc — review + warn в `check`)
- [x] Task: Правило о комментариях в `rules.md` пакета (новый ID) dmg-core@3a47e97 (CODE-04)
- [x] Task: Раздел «Как устроена документация» в `docs/index.md`: типы, ответственность, кто и когда актуализирует; таблица «что куда» (правило, способ, поток, контракт) dmg-core@1dd6285
- [x] Task: Правило и критерий в промптах `domain-author`, `api-author` (пакет), `migrator`, `tech-lead` (`.agents-core/roles`), проверка в `reviewer`; строка «Документы» в формате брифа среза (`tech-lead`); `agents:sync` d99bc260 (dmg-core@c8ed69f; авторы пакета — через общий блок `common.md`)
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md) d78ad64

## Фаза 2: Проверки, роль и concepts [checkpoint: 756c3d0d]

- [x] Task: Тест ссылок (`docs/`, `llms.txt`, JSDoc `@see`) в `bun run check` dmg-core@685b566 (расширен `docs-check`: направление по типам, якоря, `checkSee`; `guides/facade.md` — ссылки на исходники в `covers:`)
    - [x] Тесты: битая ссылка, ссылка на несуществующий файл, ссылка против направления; red
    - [x] Реализация; green
- [x] Task: Проверка `covers:` во front-matter concepts — `warn` в `check`, блок в гейте релиза (`RELEASING.md`) dmg-core@3a69c0c (`docs:covers`: время по git; путь covers без файлов — ошибка; `--strict` — в гейте релиза)
    - [x] Тесты: исходник менялся позже документа → warn; red
    - [x] Реализация; green
- [x] Task: Команда `docs:impact <пути>` и триггер в `agent-gate.ts` (правка `dmg-core/src/{app,kernel,domain}` без `docs/` и `decisions.md` — предупреждение); `covers:` и у guides 5d61dca (dmg-core@8d139ad; репо пакета гейт находит по `file:` корневого `package.json`)
    - [x] Тесты: путь совпал с `covers` → документ в списке; не совпал → пусто; правка без docs → предупреждение; red
    - [x] Реализация; green
- [x] Task: Роль `documentarian` в `.agents-core/roles/` (только чтение, список расхождений, триггер — после фазы, менявшей документы, и перед релизом); пилот ведётся в `summary.md` b67e63c
- [x] Task: Каталог `concepts/`, `docs/index.md`, `llms.txt` с двумя входами dmg-core@4185548 (`concepts/index.md`, `_template.md`; concepts в `llms.txt` — `Optional`)
- [x] Task: Concepts: «Путь вызова UC», «Слои и зависимости», «Жизненный цикл агрегата и событий», «Как читать модуль» (mermaid, `covers:`) dmg-core@612cd19 (`uc-path`, `layers`, `aggregate-lifecycle`, `reading-a-module`)
- [x] Task: Ревью reviewer; вызов `documentarian` (пилот) 7b8aab3 (dmg-core@14f0156; отчёты — `summary.md`, «Пилот ролей»)
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md) 756c3d0d

## Фаза 3: Нарезка существующих docs [checkpoint: b3fc2239]

- [x] Task: `transport`, `errors-result`, `caller` — нормативная часть в reference, объяснение — в concepts dmg-core@463fdd7 (`docs/reference/` с теми же именами; concepts `errors`, `caller`, `transport`)
- [x] Task: Concept «Домен — приложение без инфраструктуры» (`docs/concepts/domain.md`) — из объяснительной части `domain-modeling.md` и `layers.md` §3–4 dmg-core@be486d8 (подтверждён Нурболатом; `documentarian` — в задаче ревью фазы)
    - Вопрос новичка: «что такое домен в DMG и почему UC, реакции и UI не принимают решений». Главная мысль: домен — целое приложение, которое полностью описывает и инкапсулирует доменную логику и правила, а где и как оно запущено (хранилище, транспорт, часы, процесс, асинхронность) — не знает; поэтому один домен работает под ботом, HTTP, CLI или в отдельном сервисе, а его тесты идут без репозиториев и шины
    - Схема (mermaid): объекты домена модуля и кто их использует снаружи — Def, state, Ar, Policy, доменные правила, DCS/DQS, события, ошибки, `contract.ts` ↔ UC/ER/Job, рендереры UI, другие модули (через контракт и `ReadonlyAr`)
    - По каждому объекту одна строка: зачем, где живёт (`<domain>/<m>/…`), кто использует; без перечня полей и правил (правила — ID reference, шаги — гайды)
    - Граница: что в домен не входит и где живёт вместо этого — время (аргумент операции), запись и публикация (UoW), вызовы чужих модулей (`fetch`, фасад), транспорт и `Caller` (адаптеры, приложение)
    - «Почему так» — D-05, D-28, D-34, D-39, D-45 и др. по месту; образцы — учебный модуль `todo` (`src/testing/example/todo`), доказательство «без инфраструктуры» — его доменные тесты
    - Front-matter `covers:` (`src/domain/**`, `src/kernel/**`, образец `todo`); 30–100 строк; строка в `concepts/index.md`; связь с `concepts/layers.md` и `reading-a-module.md` — ссылками, без повтора
    - Критерий приёмки: Нурболат читает и подтверждает, что главная мысль понятна без других документов; `documentarian` — без расхождений с кодом
- [x] Task: `layers`, `domain-modeling`, `manifests` — нормативная часть в reference, объяснение — в concepts (`domain.md` из задачи выше, `layers.md`); каждый факт — одно место dmg-core@a6392b0 (concepts `rule-placement`, `manifests`; кейс назначения — в `rule-placement`)
- [x] Task: `testing`, `rules`, `naming`, `typescript` — в reference; `guides/` — обновить ссылки dmg-core@b6932a7 (`RULES_DOC`, `docs-check`, `consumer-check` — путь `docs/reference/rules.md`; корень `docs/` — `index.md` и `decisions.md`)
- [x] Task: Ссылки в `llms.txt`, скилах, `AGENTS.md` u7-school; `dmg:sync`; тест ссылок зелёный (`llms.txt` и скил пакета — в коммитах задач выше; u7-school: роли, скилы `architecture` и `conductor-review`, `conductor/architecture`, `conductor/roadmap`; `AGENTS.md` ведёт на `docs/index.md` — без правки)
- [x] Task: Ревью reviewer; вызов `documentarian` dmg-core@9ed5c07 (reviewer: 1 major, 4 minor, 1 question — потери норм при переносе возвращены в reference; documentarian: 4 расхождения, приняты все; отчёты — `summary.md`, «Пилот ролей»)
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md) b3fc2239

## Фаза 4: Стрижка JSDoc

- [x] Task: `kernel` — для каждого сценария сначала сверка с тестами, недостающие (red → green), затем сокращение комментария dmg-core@63e558a (`withEntityDefaults`, `Trace`; два теста ограничений — характеризация, red невозможен без поломки кода)
- [x] Task: `domain` — то же dmg-core@6ea9a01 (8 блоков; сценарии уже покрыты тестами)
- [x] Task: `app` (`UnitOfWork.commit`, `CommandReplay`, `use-case-from-def`, `reaction`) — сценарии сбоев в именованные тесты, выжимка в concepts dmg-core@7021261 (5 новых тестов сбоев — характеризация; выжимка — `uc-path` шаг 2, `aggregate-lifecycle` шаг 6)
- [x] Task: `arch`, `cli` (комментарии `scaffold/app-sources.ts` — в шаблоны), `gen`, `testing` (`gen` добавлен решением Нурболата 2026-11-03: 4 warn `docs:jsdoc` вне задач; «в шаблоны» — стрижка комментариев внутри шаблонов генерируемого кода) dmg-core@8d91255 (34 warn `docs:jsdoc` → 0; сценарии уже покрыты тестами, новых нет)
- [x] Task: `D-NN` из середины фраз — в шапки; `@see` на документы dmg-core@711287e (середина фразы 56 → 9 однострочников, блоков с несколькими D-NN 11 → 0; `@see` — в задачах стрижки; D-NN в `description` ошибок ядра не тронуты — вопрос к ревью)
- [x] Task: `docs:covers` — коммиты, менявшие в `src/` только комментарии, не делают документ устаревшим (решение Нурболата 2026-11-03: шум после стрижки JSDoc) dmg-core@9202766 (`lastCodeChangeAt` по `git log -p`; `*.test.ts` тоже не считаются; 14 warn → 1, давний `layers.md`)
    - [x] Тесты: правка только комментария → нет warn; правка кода → warn; red
    - [x] Реализация; green
- [x] Task: `warn` в `check` на JSDoc длиннее 6 строк без `@see` (обещан D-59, задачи не было; решение Нурболата 2026-11-03) dmg-core@9bcebfa (`docs:jsdoc`; на коммите — 34 warn вне kernel/domain/app)
    - [x] Тесты: 7 строк без `@see` → warn; 7 строк со `@see` и 6 строк → нет; red
    - [x] Реализация; green
- [ ] Task: Ревью reviewer; вызов `documentarian`
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Финал

- [ ] Task: Повторный замер, сверка с базовой линией, `check` и `e2e` пакета и проекта
- [ ] Task: `bun install` в u7-school, SHA пакета; `summary.md` с разделом «Пилот ролей» (`documentarian`)
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)
