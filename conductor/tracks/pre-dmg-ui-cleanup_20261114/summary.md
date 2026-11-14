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

Сверка с кодом — Sonnet (`Explore`), адреса — orchestrator. Новые записи: D-DEBT-4…6, C-DEBT-55; идеи — `roadmap.md` «Идеи без проработки»; вход dmg-ui — черновик [roadmap/dmg-ui-entry.md](../../roadmap/dmg-ui-entry.md).

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
| Р2 5: витрина | каталог и программа есть; «ждать новый набор» — модуль `wish`; инструментов автора нет | закрыт; автор — «Идеи», п. 7 |
| Р3 6: мониторинг | «отстаёт» (пороги 4/7 суток, 1,3 медианы — эталон код), сводка, сортировка — есть; `history:*` — заглушка | закрыт; история — D-DEBT-5 |
| Бэклог: рассылки, обратная связь, типы шагов, заморозка, отзывы выпускников | нет | `roadmap.md` «Идеи» |
| Бэклог: синхронизация `contentSnapshot` | нет | учтено: п. 7, F-80, C-DEBT-54 |
| Зачисление в активный поток | запрещено правилом `streamEnrolling` | D-DEBT-4 (с возвратом `abandoned`) |
| `wish.fulfilled` | события нет | D-DEBT-6 |
| `FillStory` на `notify()` | `notify` уже; кнопки — канал `invite` | учтено в C-DEBT-45 |
| e2e wish → поток → fulfill | e2e и тесты DCS есть | закрыт |
| `GetSameModulesUc`, `basedOn` | как описано | учтено: D-65, `course-module-history.md`, п. 7 |
| Таймзоны `isoNow` в анкетах | `isoNow` нет, время — `Timestamp` | закрыт; ISO в файле `job-run-json-repo.ts` — формат хранения адаптера, порт отдаёт `Timestamp` |
| `JobExecutor` → воркер | порт отвергнут (D-71 пакета) | закрыт |
| `init`/`start`/`stop` по слоям | решение spec ФР-3 | закрыт |
| Необязательные вопросы анкет | нет | `roadmap.md` «Идеи» |
| Чистка старых `draftAnswers` | инцидентов нет | закрыт |
| `questionCode` в callback | вариант A (`stale_answer`) работает | закрыт |
| `JsonFileRepo` теряет невалидные записи | доменные JSON-репозитории — fail-fast (`v.parse`); `JsonFileRepo` остался для сессий бота и сохраняет невалидное в `backups/` | закрыт |
| Экран отказа по `Result` (TR-50, план Ф3) | дубль `ucErrorScreen`/`ucErrorNotify` | вход dmg-ui §2 |
