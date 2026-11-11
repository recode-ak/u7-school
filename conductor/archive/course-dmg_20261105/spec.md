# Spec: course-dmg_20261105

## Обзор

Трек 6 из [migration.md](../../architecture/migration.md), третий модуль группы «остальные модули». Модуль `course` (домен `domain/src/course`, прикладной слой `modules/course`) переводится с legacy на Def по эталону `wish`. Шаблон трека — `conductor/archive/questionnaire-dmg_20261104`. Конвейер ролей: `dmg-tech-lead` → `dmg-test-designer` → `migrator` → гейт → `dmg-data-keeper` (по триггеру) → `dmg-reviewer`. Бриф механической сборки готовит orchestrator (TR-45).

**Исполнители — по таблице §2 [deepseek.md](../../architecture/deepseek.md)** (решение Нурболата): orchestrator и `dmg-reviewer` — Opus; `dmg-tech-lead` — Sonnet (приёмка брифа — Opus); red-тесты `dmg-test-designer` и UI-stories — Sonnet; `migrator` (домен, прикладной слой, подписчики, механика), `dmg-data-keeper`, точечные правки тестов — DeepSeek `flash` через `scripts/pi-role.ts`. После каждого шага на DeepSeek — гейт, `git diff --numstat`, grep-критерии брифа; строка расхода — в `summary.md`.

## Решения

- **Порядок.** От `course` зависят только модули на Def — `stream` и `wish` (через адаптеры TR-11); обратных мостов нет. `user` подключается внешним `ModuleDef` с адаптерами.
- **Перепроектирование разрешено** на любом уровне: доменная объектная модель, состав и реализация UC. Каждое предложение — стратегический вопрос Нурболату («сейчас в срезе» или «в `debt.md`»); без одобрения не меняется. Одобренное — в `TR-<n>` или `decisions.md`.
- **Этап — разметка программы, не контейнер** (решение Нурболата, 2026-11-05):
  - программа курса — `moduleIds: string[]`;
  - этапы — необязательный список `phases: [{ title, track?, fromModuleId }]`: этап отмечает модуль, с которого начинается; пустой список — курс без этапов;
  - инварианты Ar: каждый `fromModuleId` есть в программе, этапы идут в порядке программы, первый этап (если есть) начинается с первого модуля;
  - этап модуля (`getModulePlace`, `get-course-program`, навигация бота) вычисляется по метке;
  - `get-course` отдаёт вычисленные этапы `stages: [{ title, track?, moduleIds }]`; курс без этапов — `stages: []`, бот рисует плоский список модулей. Метки бот не разбирает.
- **Клиент спрашивает — курс разруливает** (решение Нурболата, 2026-11-05). Клиенты не сравнивают id курса между собой, а задают вопрос `course`; учёт истории (замена модуля новым id) — внутреннее дело `course`.
  - В треке: пререквизит — вопрос `getModulePrerequisite({ moduleId, passedModuleIds })` → вердикт `{ admitted: true }` / `{ admitted: false, reason: 'previous-not-passed', title }` / `{ admitted: false, reason: 'closed' }`. `stream` передаёт id модулей пройденных потоков пользователя; `StreamAr.teachesModule` и сравнение в `student.rules.ts` уходят. Контракты для `wish` (`GetSameModules`, enrollment, «курсы, включающие модуль / начинающиеся с модуля») уже вопросы — курс отвечает подмножеством кандидатов, их форма не меняется. Реализация пока — равенство id.
  - За рамками трека — кандидат `[?]` «История модулей курса» в `tracks.md`, разбор — [course-module-history.md](../../roadmap/course-module-history.md): архив вместо удаления, связь «предок» (где хранить — точка рассмотрения), операции автора, перенос прогресса между версиями.
- **Состав UC** (разбор `dmg-tech-lead`, решение Нурболата 2026-11-05). Переносятся query-UC с вызывающими: `get-course`, `list-courses`, `get-course-by-module`, `get-module-place`, `get-module`, `list-modules`, `get-lesson`, `get-step`, `get-steps-by-lessons`, `get-module-snapshot`; шесть внешних UC (`getCourseEnrollment`, `getModuleEnrollment`, `getCoursesIncludingModule`, `getCoursesStartingWithModule`, `getSameModules`, `getModulePrerequisite`) — настоящими UC, методы фасада сливаются в них. Удаляются без вызывающих: все 9 authoring-команд (`create-course`, `add-phase-to-course`, `add-module-to-course`, `create-module`, `enrich-module`, `add-project`, `publish-module`, `create-lesson`, `create-step`), `get-course-program` (`CourseProgram`), `resolve-content-path` (с `content-path`). У `CourseAr` мутаций не остаётся, инварианты этапов — в схеме state при строгом чтении; операции автора проектируются в треке-кандидате [course-module-history.md](../../roadmap/course-module-history.md).
- **Срезы:** `module` → `lesson` + `step` + снимок → `course` (программа, этапы, клиент `stream`, данные) → UI → сборка. `course` зависит от `module` и `lesson` (название модуля в пререквизите, сборка снимка). Ф1–Ф2 аддитивны: legacy-UC живут рядом, красной зоны нет; она возникает в Ф3 (формат `courses.json`) и снимается в конце Ф4.
- **Мосты.** Адаптеры `modules/course/src/course/uc/*` (DEBT-44, TR-11) заменяются настоящими UC: `get-module-snapshot` — в срезе `lesson` + `step`, остальные шесть — в срезе `course`. Из клиентов меняется только `stream` (пререквизит).
- **`#filterPublished`** (DEBT-10) — в Policy/DQS.
- **Сосуществование срезов.** Моста нет; красная зона между срезами допустима, если записана в `debt.md` с критерием снятия «конец трека».
- **Режим.** Автономный ([agents.md](../../architecture/agents.md) §9), тактические решения — `TR-<n>`.

## Данные

- `data/courses/*.json` — контент под git (не живые данные пользователей).
- Формат `courses.json` меняется: `phases[].moduleIds` → `moduleIds` + `phases[].fromModuleId` (решение Нурболата, 2026-11-05). Перевод — внутри трека: `bun run backup:adhoc <причина> --courses` → проверка `dmg-data-keeper` → отдельный коммит с переведённым файлом. Чтение после перевода строгое (старый формат не поддерживается).
- `createdAt`/`updatedAt` → `F.timestamp` (читает ISO, пишет число; ленивая миграция до трека 7).
- Скрипты `distribute-lesson.ts`, `distribute-mentor.ts`, `list-lessons.ts` переходят на Def UC или репозитории Def с сохранением поведения для пользователя данных.
- `data/fixtures` не под git: после перевода тестовых миров на новый формат пересобирается `bun run seed:fixtures`.
- Даты без секунд (`"2026-07-08T18:35"`) в `data/courses/*.json` — `F.timestamp` обязан их читать (проверка `dmg-data-keeper`, тест репозитория).
- Живые данные (`data/users`, `data/streams` и др.) трек не трогает; проверка — на `DB_DIR=./data/fixtures`.

## Входной долг

| Долг | Решение |
|---|---|
| DEBT-1, 2, 5, 10 (часть course) | погашаются |
| DEBT-44, TR-11 (остаток course) | погашаются, TR-11 закрывается полностью |
| DEBT-34 (legacy-пары course) | погашается |
| DEBT-3 (barrel `modules/course/src/domain`) | остаётся до последнего трека |

Реестр — [debt.md](../../architecture/debt.md).

## Функциональные требования

- **Ф0. База.** Базовая линия тестов (на конец `questionnaire`: 4216 pass / 397 файлов, бот 1107 pass / 101 файл). Разбор вызовов UC и фасада курсов: список «переносим / удаляем».
- **Ф1–Ф3. Срезы домена и прикладного слоя** (`module`; `lesson` + `step` + снимок; `course`): state, Ar, ошибки, Policy, правила, DCS/DQS, Def UC, репозитории через UoW со строгим разбором; UC через `UseCaseFromDef`; видимость опубликованного (DEBT-10) — DQS/Policy; новая модель этапов; пререквизит-вердикт и перевод на него `stream`; снятие адаптеров TR-11.
- **Данные.** Перевод `courses.json` в новый формат (раздел «Данные»).
- **UI.** Stories курсов и навигация (`courses/*`, `learning/*`, `streams/*`, `mentor/create-stream`) — на `dispatch` и вычисляемые этапы. Красная зона закрывается.
- **Сборка.** Фабрика в `U7App`, `@u7-scl/course/**` — в ARC-07 `biome.json`, `external` снят. Удаляются legacy-фасад (`course-in-proc-facade`), `api/*`, `commands/*-cmd.ts`, legacy-репозитории, `CourseApiModule`. На модуль Def переводятся `test-app`, тестовые миры, скрипты (`call-uc.ts`, `domain-arch.ts`, снимки потоков, `distribute-*`, `list-lessons`).
- **Итог.** `debt.md` — снять погашенное; `course-module-history.md` — сверить §2 с итогом трека; `migration.md` §6 — состояние, следующий трек `user`; `deepseek.md` — сверка таблицы §2; `summary.md` с гейтом закрытия.

## Нефункциональные требования

- Поведение бота сохраняется, кроме одобренных перепроектирований; для курса из одного этапа навигация для пользователя не меняется.
- e2e зелёные к концу UI и сборки.
- TDD: red → запуск → green.
- Без новых зависимостей, деплоя, пуша и рестарта прода.
- Правка `dmg-core` — отдельным коммитом в репо пакета, SHA — в коммите u7-school (`architecture/index.md`, «Правка платформы»).

## Критерии приёмки

- В `domain/src/course` и `modules/course` нет `throw*` для штатных отказов, `new …Ar`, `#` в Ar, импортов `core` и `app-legacy`.
- Курс хранит программу как `moduleIds`, этапы — метки `fromModuleId`; курс без этапов валиден и отображается ботом.
- `courses.json` в новом формате, перед переводом снят ad-hoc бэкап.
- Клиенты (`stream`, `wish`) не сравнивают id модулей курса сами — только через UC `course`; в `student.rules.ts` нет `teachesModule(prerequisite.moduleId)`.
- Долг из таблицы погашен, TR-11 закрыт, `arch:check` синхронен.
- У `CourseModuleDef` нет `external`; legacy-фасад, адаптеры и `CourseApiModule` удалены.
- `check` зелёный, в отчётах reviewer нет `error`, красной зоны в `debt.md` нет.
- `git status data/` чист, кроме одобренного коммита `courses.json`.
- Каждое перепроектирование одобрено Нурболатом и записано в `TR-<n>`, `decisions.md` или `debt.md`.

## За рамками

- Перевод `user` на Def, `U7CallerResolver` (TR-33).
- История модулей и перенос прогресса между версиями — кандидат [course-module-history.md](../../roadmap/course-module-history.md).
- Миграция живых данных (трек 7), DEBT-3, DEBT-4.
- Новые функции редактора курсов и продуктовые доработки UX каталога.
