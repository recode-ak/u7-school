# Summary: уборка перед dmg-ui

> Заполняется по фазам; итоговый вид — при закрытии трека.

## Фаза 0. Базовая линия (2026-11-14, `d980980d`)

| Команда | Итог |
|---|---|
| `CI=true bun run check` | зелёный: 3211 pass, 0 fail, 9116 expect, 312 файлов |
| `CI=true bun run test:bot` | зелёный: 1207 pass, 0 fail, 5476 expect, 107 файлов |

### Повторы в тестах

Общая часть команды (из корня репо):

```bash
G='grep -rE --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=data --exclude-dir=.cache'
$G -- '<шаблон>' . | wc -l    # вхождений
$G -l -- '<шаблон>' . | wc -l # файлов
```

| Повтор | Шаблон | Вхождений | Файлов |
|---|---|---|---|
| `Trace.fromRequest({ requestId` | `Trace\.fromRequest\(\{ requestId` | 77 | 48 |
| `mkdtemp` | `mkdtemp` | 129 | 51 |
| `repoWith` (определения) | `(function\|const) repoWith\b` | 11 | 11 |
| `press` (определения) | `(function\|const) press\b` | 16 | 15 |
| `buttonsOf` / `findBtn` (определения) | `(function\|const) (buttonsOf\|findBtn)\b` | 16 | 16 |
| `waitMessageFor` / `waitUntil` (определения) | `(function\|const) (waitMessageFor\|waitUntil)\b` | 11 | 11 |
| `makeLogger` (определения) | `(function\|const) makeLogger\b` | 5 | 5 |
| `subHandler` (определения) | `(function\|const) subHandler\b` | 3 | 3 |
| `makeUiApp` (определения) | `(function\|const) makeUiApp\b` | 5 | 5 |

Числа в плане (46, 50, 11, 11, 9, 11, 5, 4, 5) — оценка при постановке; базой считаются числа этой таблицы: сравнение в Ф4 и Ф7 — теми же командами.

## Фаза 1. Реестры долга (2026-11-14, `afe161d`, `4c819be`)

- `conductor/debt/`: `README.md` (правила, форматы, каталог признаков лишнего теста Б-1…Б-19), `code.md` (9 записей), `tests.md` (7), `product.md` (2). Удалены `architecture/debt.md` (28 заголовков DEBT, 64 записи TR) и `roadmap/test-bloat.md`.
- **Разбор долга кода:** 18 пустых заголовков «слит в» удалены; 8 открытых записей — в `code.md`; новая C-DEBT-53 — остаток из журнала TR (монитор студентов). Запись о первом администраторе новой школы (бывш. DEBT-52) закрыта решением Нурболата: прод запущен, bootstrap школы — вопрос трека `schools-system`.
- **Префикс `C-DEBT-<n>`** (Нурболат, 2026-11-14): долг кода проекта отделён от `DEBT-<n>` пакета `dmg-core` — совпадающие номера в двух репо путались. Номера сохранены (`DEBT-40` → `C-DEBT-40`).
- **Сохранённое знание журнала TR:** исключение в D-63 (`wish.invited` с `telegramId`), D-77 (запись приглашения через `WishAr.invite`), исключение `scripts/**` из ARC-04 (решение Ф7 `user-dmg`) снято решением Нурболата — вместо него запись C-DEBT-54 на два скрипта (`stream-snapshot-sync` — до F-80, `migrate-users-drop-student` — до выполнения миграции на проде), D-41 без TR; в план Ф2 — публикация событий UoW в `finally` (TR-8), в план Ф3 — общий экран отказа по `Result` (TR-50); D-DEBT-3 — черновые шаги в снимке (TR-53). Остальные записи — история либо знание уже в `decisions.md`, `rules.md` и документах пакета. Не перенесено: ловушка кеша миров (TR-57) — `computeSourceHash` уже учитывает исходники сборки; `askMatch`/`askReach` (TR-20) — идея обобщения без второго потребителя.
- **Отклонения от плана:** реестры перенёс orchestrator (9 записей и 7 строк — промпт дороже работы). `checkTrMarkers` с фикстурами оставлен до Ф2 (удаляется вместе со своей реализацией проверки) — единственное исключение grep-критерия. Ссылки на `migration.md` и `TODO.md` — в Ф6 и Ф3, пока файлы живы.
- **Проверки:** `check` зелёный, 3211 pass (число тестов не изменилось).
- **Расход:** Sonnet — разбор (185k токенов); DeepSeek flash — `PDU-F1-links` (ссылки, удаление): $0.06, 37 ходов, hitRate 98%, 0 кругов доработки, замечаний приёмки — 3 мелких хвоста (доправил orchestrator).

## Фаза 2. dmg-core — проверка долга и тестовые хелперы (2026-11-14)

- **Пакет:** `dmg-core` v0.2.1 (`ad38a74`, `51d7f89`, `b57c858`, `7eb4c7b`, `dcca513`) — `DebtChecker` (ARC-12, D-84), `TEST_TRACE`, `testTrace`, `testUuid`, `TempDir`/`useTempDir`, `MemoryRepo.where`; TR-8 — остаток в `aggregate-lifecycle.md` и D-56. v0.2.0 был с номером D-75, занятым в общей нумерации проекта, — исправлен в v0.2.1.
- **Тесты проекта:** 3211 → 3170 (−41), `test:bot` 1207 без изменений. Удалены (TST-08, сценарии в `dmg-core/src/arch/debt-checker.test.ts`): `scripts/domain-check.test.ts` — describe «checkDebt: allowlist…», «checkDebt: маркеры временности…»; `scripts/arch-check.test.ts` — «runDebtCheck: реестр долга как allowlist». Без переноса: `checkTrMarkers` (журнала TR нет), переходный режим и закрытые записи (их нет по README долга).
- **Находка новой проверки:** у C-DEBT-54 не было «Погашает» — дописан.
- **Ловушка:** bun держит кешированный клон git-зависимости (`~/.bun/install/cache/<hash>.git`) и новых тегов не видит — `no commit matching "vX.Y.Z"`; лечится `git -C <клон> fetch <url> 'refs/tags/*:refs/tags/*'`. На prod — то же при следующем релизе.

## Фаза 3. Разбор `TODO.md` (2026-11-14)

Сверка с кодом — Sonnet (`Explore`), адреса — orchestrator. Новые записи: D-DEBT-4…6, C-DEBT-55; продуктовые идеи без проработки не сохранены (Нурболат: всплывут при работе над продуктом); вход dmg-ui — черновик [roadmap/dmg-ui-entry.md](../../roadmap/dmg-ui-entry.md).

| Пункт `TODO.md` | Состояние в коде | Адрес |
|---|---|---|
| Мастер потока: `telegramGroupId` и `telegramGroupInvite` | сделано (`create-stream.ts`, два шага) | закрыт |
| Автоподключение к группе на `student.enrolled` | нет | вход dmg-ui §3 |
| `WizardStory` | один мастер | вход dmg-ui §1 (форма по схеме входа UC) |
| Дубликат `User`/`Role`, цикл `app ↔ модули` | `platform/app/src/domain` и `U7BotAppMeta` нет | закрыт; остаток — C-DEBT-55 (`Role` и `UserRoleName`) |
| Р1 A: роль `AUTHOR` | роль есть; команды автора удалены из домена | закрыт; операции автора — `roadmap.md` п. 7 |
| Р1 0: агрегат `Course` | `CourseAr` с этапами (D-64); команд создания нет | закрыт; команды — п. 7 |
| Р1 1: жизненный цикл студента | статусы и UC есть; `wants_next`, `abandonReason`, confirm-хелпер не понадобились; `statusLabels` монитора нет | закрыт |
| Р1 2: `ContentPath` | удалён без вызывающих (`course-dmg`) | закрыт |
| Р2 3: gating; `courseId` в `Stream` | gating есть (`module-prerequisite.dqs.ts`); курс модуля — C-DEBT-50 | закрыт; учтено в C-DEBT-50 |
| Р2 4: навигация студента | хаб, дерево, ◀️/▶️, выход — есть | закрыт |
| Р2 5: витрина | каталог и программа есть; «ждать новый набор» — модуль `wish`; инструментов автора нет | закрыт; операции автора — п. 7 |
| Р3 6: мониторинг | «отстаёт» (пороги 4/7 суток, 1,3 медианы — эталон код), сводка, сортировка — есть; `history:*` — заглушка | закрыт; история — D-DEBT-5 |
| Бэклог: рассылки, обратная связь, типы шагов, заморозка, отзывы выпускников | нет | закрыт (идея без проработки) |
| Бэклог: синхронизация `contentSnapshot` | нет | учтено: п. 7, F-80, C-DEBT-54 |
| Зачисление в активный поток | запрещено правилом `streamEnrolling` | D-DEBT-4 (с возвратом `abandoned`) |
| `wish.fulfilled` | события нет | D-DEBT-6 |
| `FillStory` на `notify()` | `notify` уже; кнопки — канал `invite` | учтено в C-DEBT-45 |
| e2e wish → поток → fulfill | e2e и тесты DCS есть | закрыт |
| `GetSameModulesUc`, `basedOn` | как описано | учтено: D-65, `course-module-history.md`, п. 7 |
| Таймзоны `isoNow` в анкетах | `isoNow` нет, время — `Timestamp` | закрыт; ISO в файле `job-run-json-repo.ts` — формат хранения адаптера, порт отдаёт `Timestamp` |
| `JobExecutor` → воркер | порт отвергнут (D-71 пакета) | закрыт |
| `init`/`start`/`stop` по слоям | решение spec ФР-3 | закрыт |
| Необязательные вопросы анкет | нет | закрыт (идея без проработки) |
| Чистка старых `draftAnswers` | инцидентов нет | закрыт |
| `questionCode` в callback | вариант A (`stale_answer`) работает | закрыт |
| `JsonFileRepo` теряет невалидные записи | доменные JSON-репозитории — fail-fast (`v.parse`); `JsonFileRepo` остался для сессий бота и сохраняет невалидное в `backups/` | закрыт |
| Экран отказа по `Result` (TR-50, план Ф3) | дубль `ucErrorScreen`/`ucErrorNotify` | вход dmg-ui §2 |

## Фаза 4. Перевод тестов на хелперы (2026-11-14)

Бриф и карта — [slices/test-helpers.md](./slices/test-helpers.md). Хелперы: `dmg-core/testing` (`TEST_TRACE`, `testTrace`, `TempDir`, `useTempDir`, `testUuid`) и новые в боте — `Screen`, `TestBotTransport.press`/`pressRaw`/`waitForMessage`, `waitUntil`, test-kit'ы `mockLogger`, `bot-transport`, `subscriptionOf`.

| Повтор | Ф0 (вхожд. / файлов) | Ф4 | Остаток |
|---|---|---|---|
| `Trace.fromRequest({ requestId` | 77 / 48 | 15 / 15 | 13 — UC-тесты `wish`/`peer-review` (Ф5); 2 — прод-код бота |
| `mkdtemp` | 129 / 51 | 43 / 22 | 21 файл `wish`/`peer-review` (Ф5); `.pi/extensions` — не тест |
| `repoWith` | 11 / 11 | 11 / 11 | исключение: фабрика над конкретным классом репозитория |
| `press` | 16 / 15 | 5 / 4 | каррирование `tgId` в `it` (3), `pagination` (+проверка Markdown), переменная в `transport.e2e` |
| `buttonsOf` / `findBtn` | 16 / 16 | 5 / 5 | stories (4 `findBtn`), `buttonsOf` по рядам в `questionnaire-dmg.test-kit` |
| `waitMessageFor` / `waitUntil` | 11 / 11 | 2 / 2 | общий `waitUntil`; `peer-review.module.test` — бросающая семантика |
| `makeLogger` | 5 / 5 | 0 | — |
| `subHandler` | 3 / 3 | 0 | — |
| `makeUiApp` | 5 / 5 | 4 / 4 | общий test-kit; 3 разные функции (`platform/core`, `ui-app.test`) |

- **Тесты:** 3170 → 3178: +12 тестов хелперов, −4 по TST-08: `create-ui-app.test.ts` — «UserController в сборке нет», «прочий отказ резолвера → исключение»; `u7-bot-ui-story.test.ts` — «мост subjectOf удалён» (T-DEBT-4: гарантирует тип / тавтология); `student-dmg.e2e` — «повторный runJob в тот же день» (T-DEBT-7: та же ветка `NOTICE_EVERY_DAYS`, покрыта P8-04 в `inactivity.e2e`). Ослаблено без удаления: T-DEBT-3 (`ui-app.test.ts` — «регистрация вызвана», состав — `ensure-registered.test.ts`), T-DEBT-1 (`it.each`). `test:bot` 1207 → 1215.
- **Долг тестов:** T-DEBT-1…7 закрыты; T-DEBT-6 погашен ещё в Ф2 (фикстура ушла с `checkDebt`), запись не была снята. Открытых `T-DEBT` нет.
- **Отклонения:** `mkdtemp` и `'r-1'` в UC/ER-тестах `wish`/`peer-review` — в Ф5 (фейки вместо JSON во временном каталоге): критерий Ф4 «`mkdtemp` только в хелпере» — после Ф5. Остались локальные `waitFor<T>`/`waitForSent` (бросают и возвращают значение), `craft` (заново открывает экран), `click` с точным совпадением подписи — другая семантика; в stories — `handler()`/`getSub`/`campaignCreatedHandler` (не названы в T-DEBT-5, перепишет dmg-ui).
- **Ревью** (`dmg-reviewer`, выборкой): error нет; warn T-DEBT-3 — по решению записи; minor — слабая проверка теста `press` (`not.toEqual({})`), не правилось.
- **Расход:** Sonnet — карта 112k, П0 54k, П1–П2 79k, П3 120k, П4 72k, ревью 54k (≈ 491k). П0, П1–П2 и П3 шли параллельно (разные зоны), 0 кругов доработки.

## Фаза 5. Ранние модули `wish`, `peer-review` (2026-11-14)

Бриф — [slices/early-modules.md](./slices/early-modules.md). Тестов 3292 → 3290; поведение не менялось.

Удалённые тесты:
- `domain/src/peer-review/peer-review-question-pool.test.ts` — «схема пула: валидно/невалидно; questionCode уникальны внутри и между пулами» (модуль пула удалён, C-07 пересмотрен).
- Проверяли фильтр выборки фейка (после перевода фейков на `unanswered`, D-84), покрыты контрактными тестами infra:
  - `get-my-campaigns.uc.test.ts` «граница окна: ровно в expiresAt кампания уже не активна» → `review-campaign.json-repo.test.ts`;
  - `list-my-reviews.uc.test.ts` «только отзывы мне: чужие адресаты не попадают» → `review.json-repo.test.ts` (маппинг полей ответа UC перенесён в «новые наверху»);
  - `list-scope-reviews.uc.test.ts` «filter.direction: отбирает по направлению; scopeId в снимке» → `review.json-repo.test.ts` (эхо `scopeIds`/`scopeId` перенесено в оставшийся тест).

Добавлен: `campaign-facts.dqs.test.ts` — чужой отзыв не даёт признак «мой отзыв есть».

## Фаза 6. Roadmap, документация, архив (2026-11-15)

### Ревизия roadmap (задача 1, Sonnet)

| Файл | Действие | Что сохранить и куда |
|---|---|---|
| `roadmap.md` | переписать | видение по инициативам с опорными D-NN; пул вопросов, session-persist, DMG — убрать (сделано); «Выполнено» — 3–4 строки |
| `bot-ui-dialog-lifecycle.md`, `bot-ui-refactoring.md`, `development-roadmap.md` | удалить | ничего: история (архив, CHANGELOG, `architecture/ui/`) |
| `bot-ui-session-architecture.md` | удалить | инварианты и контракты рендера — сверить с `ui/bot-architecture.md`, `bot-ui-story.md`; TTL ввода и совместимость с задачами — во вход dmg-ui |
| `tasks-system-architecture.md`, `-layers.md`, `-scenarios.md` | удалить | в `tasks-system.md`: задача — конверт данных, рендерит канал; завершение по критерию; касания — в модуле задач; открытые вопросы; идея manual-задач. Слои на `ArMeta` — мёртвые |
| `metrics/metrics-questionnaire-and-events.md`, `metrics/metrics-pipeline-and-modules.md` | удалить | поток данных — абзацем в `metrics-system.md`; остальное реализовано на dmg-core |
| `content-management.md`, `course-module-history.md`, `tasks-system.md`, `metrics/metrics-system.md`, `metrics/metrics-conception.md`, `metrics/peer-review-system.md` | упростить | контуры решений и опорные D-NN; детали реализации, карта старого кода и формат файлов — убрать |
| `contribution-system.md`, `sessions-system.md`, `schools-system.md`, `metrics/digital-passport.md`, `dmg-ui-entry.md` | оставить | правка ссылок на удаляемые |
| `stream-snapshot-dmg.md`, `stream-front-domain.md`, `oplog-state-patch.md` | оставить | разборы кандидатов `[?]` |

### Живое знание в архиве треков (задача 4, Sonnet, 4 агента по ~38 треков)

152 трека, 605 технических файлов. Живое знание нашлось в трёх местах, остальное — история, чек-листы, описание legacy или уже в `decisions.md`/гайдах/коде.

| Трек | Файл | Знание | Куда |
|---|---|---|---|
| `agent-roles-wave2_20261104` | `pilot-task.md` | воспроизводимое задание пилота ролей | перенесён в `conductor/research/agent-roles-pilot-2026-11-task.md` |
| `golden-wish_20261020` | `slices/wish.md` | «образец брифа» для ролей (`.agents-core/common.md`) | ссылка заменена на формат брифа — `agents.md` §5 и свежие брифы треков; 690 строк старого брифа образцом не служат |
| `questionnaire-dmg_20261104` | `slices/questionnaire.md` | ловушка: `Aggregate.change`/`transition` ставят `updatedAt = at`; мутация, не являющаяся активностью (флаги простоя), передаёт прежний `updatedAt` как `at` (`questionnaire.ar.ts`, `lastActivityAt()`) | гайд `aggregate` пакета `dmg-core` |

Ссылки на технические файлы из `spec.md`/`summary.md` архивных треков снимаются при чистке (задача 6).

### Итог фазы

- **roadmap:** 3376 → 847 строк; удалены 9 файлов (история bot-ui, development-roadmap, задачи и метрики на старом ядре); `roadmap.md` — видение с опорными D-NN и платформенной очередью. Живое из `bot-ui-session-architecture.md` — в `ui/bot-architecture.md` (инварианты, персистентность сессий, решения) и `dmg-ui-entry.md` (контракт story, TTL ввода, совместимость с задачами).
- **migration.md** удалён: состояние — `architecture/index.md`, план перехода — приложением к summary `legacy-removal`; `agents.md` §9 — режим после релиза.
- **Архив:** 536 отслеживаемых технических файлов удалены, 133 битые ссылки сняты до текста; страж в `scripts/repo-layout.test.ts` (+1 тест, всего 3291).
- **Решения (2026-11-15), D-85:** видимость архивного — как сейчас (Нурболат): в каталоге — автор и администратор, в потоке — по снимку независимо от статуса; снимок хранит заголовки проектов и уроков, «чистое дерево id» отвергнуто (orchestrator по поручению Нурболата: лишние запросы в `course` на каждом экране, миграция `streams.json`), правка заголовка доходит до потоков синхронизацией снимка (F-80).
- **Неотслеживаемые файлы архива** (68, `conductor/archive/` в `.gitignore`) удалены с подтверждения Нурболата.
- **Не вошло** (детали для будущих spec, есть в git-истории удалённых файлов): лимит Telegram 4096 символов для витрины паспорта, окна приглашений по контекстам анкет, имена полей задач из `tasks-system-scenarios.md`.
- **Расход:** Sonnet — 9 агентов (таблица roadmap, 4 × архив, 3 черновика, documentarian), ~0,9 млн токенов; Opus — приёмка, `roadmap.md`, `architecture/`, скрипты чистки.
