# Бриф среза: stream-content-sync / domain (Фаза 1)

Черновик — `dmg-tech-lead`, решения — orchestrator и Нурболат (2026-11-15). Источники: `spec.md`, `plan.md` (Ф1), код `domain/src/stream/` (ссылки `файл:строка` — на `2b1a85fd`, приблизительные), `scripts/stream-snapshot-sync.ts`, `node_modules/dmg-core/docs/reference/{rules,naming}.md`. Агрегаты, UC и `stream.module.ts` в срезе не трогаем (UC — Ф2).

## Принятые решения по открытым вопросам

- **S1 (пройденный шаг ушёл вперёд от студента)** — вариант A: не блокировать; `completedAhead` — предупреждение в плане/предпросмотре. Запись в `conductor/debt/code.md` («`completeStep` не сдвигает `currentStepId`, если следующий шаг уже есть в записях — после синхронизации студент может застрять»). Удаление/переоткрытие пройденной записи отклонено (Нурболат предложил, разобрано): переоткрытие (`issued`) не помогает — `completeStep` по-прежнему видит шаг выданным; удаление — потеря истории студента (даты, статистика), противоречит ФР-4 «записи остаются в истории».
- **S2** — да: `lastActivityAt` и `neverStarted` игнорируют записи с `completionSource: 'content_sync'` (T7 — тоже да). Тесты в `student.ar.test.ts`.
- **S3** — принято spec, без изменений.
- **Хвост (расхождение 6)** — подтверждено по ФР-5: студенту, завершившему последний шаг, добавленный в конец шаг не засчитывается, его выдаст `issueTail` при следующем действии. Отмечено в spec как намеренное изменение.
- **Тактические T1–T11** — по рекомендациям ниже.
- **Расхождения spec 1–8** — внесены в `spec.md` (ФР-6а через `durationOf`, `lastActivityAt`, `enrolled` без шагов, хвост).

## Границы

- **Трогаем** (только `domain/src/stream/`):
  - `student/student.state.ts` — поле `completionSource` в `StepRecordVo`;
  - `student/student.ar.ts` — `creditStep`, `lastActivityAt`, `neverStarted`;
  - `stream/stream.ar.ts`, `stream/stream.errors.ts`, `stream/stream.events.ts`;
  - `student-progress.dqs.ts`;
  - новые: `snapshot-diff.dqs.ts`, `stream-content-sync.dcs.ts`, `content-sync.types.ts` (типы и valibot-схемы отчёта);
  - тесты рядом: `snapshot-diff.dqs.test.ts`, `stream-content-sync.dcs.test.ts`, дополнения `student.ar.test.ts`, `stream.ar.test.ts`, `student-progress.dqs.test.ts`;
  - `index.ts` — экспорт `SnapshotDiffDqs`, `StreamContentSyncDcs`, типов отчёта.
- **Не трогаем:** `modules/stream`, `domain/src/stream/stream/uc/**`, `stream.module.ts`, `contract.ts` (экспорт типов отчёта в `contract` — Ф2); `data/`, `scripts/` (Ф3); `dmg-core`; `dependsOn` (тип `ContentSnapshot` — из `@u7-scl/domain/course/contract`, как в `student-progress.dqs.ts:1`).
- **Долг:** закрытие `conductor/debt/code.md` про `stream-snapshot-sync` — Ф3. Новая запись S1 — orchestrator в Ф1.

## Решения брифа

1. **Раскладка.** DCS и DQS — в корне `domain/src/stream/` рядом со `step-completion.dcs.ts`. `StreamContentSyncDcs` по образцу `StreamLaunchDcs`: возвращает изменённых студентов, регистрирует UC. DOM-01: DCS не импортирует `state`; снимок — `stream.view().contentSnapshot`, шаги студента — вопросы Ar.
2. **Ошибки** — в `StreamErrors` (прецедент `STUDENTS_IN_PROGRESS`), все `conflict`, `label` статичен, списки — в payload:
   - `CONTENT_NOT_SYNCABLE` — поток `completed`/`archived`, без payload;
   - `SYNC_REMOVES_CURRENT_STEP` — payload `students: [{studentId, userId}]`;
   - `SYNC_NEEDS_CONFIRMATION` — payload `affected: studentId[]` (актуальный набор). Один код на «нет подтверждения», «устарело», «лишние».
3. **Событие `StreamEvents.contentSynced`** (`stream.stream.contentSynced`): payload `streamId`, `moduleId`, `stepsBefore: int`, `stepsAfter: int`. Публикует только `StreamAr.replaceContent`; студенческих событий нет (ФР-3).
4. **`StepRecordVo.completionSource`:** `v.optional(F.picklist(['content_sync'], 'источника завершения шага'))`. Попадает в `StudentView.steps` и выходные схемы UC.
5. **`StudentAr.creditStep(stepId, at): Result<'credited' | 'already_credited', never>`:**
   - записи нет → push `{stepId, status:'completed', issuedAt: at, completedAt: at, completionSource:'content_sync'}`;
   - запись `issued` → `completed`, `completedAt=at`, `completionSource='content_sync'` (`issuedAt` не трогаем);
   - запись `completed` → `already_credited` без `change` (`version`, `updatedAt` не растут);
   - не меняет `currentStepId`, не сбрасывает `notices`, событий нет; через `this.change(at, …)` как `issueStep`.
6. **`StudentAr.lastActivityAt` / `neverStarted`** — записи с `completionSource` не учитываются (S2, T7).
7. **`StreamAr.canSyncContent()`** — статус `enrollment` или `active` (константа в Ar, не из `transitions`). **`StreamAr.replaceContent(snapshot, at): Result<'replaced' | 'unchanged', ErrorOf<CONTENT_NOT_SYNCABLE>>`** — идентичный снимок (по значению) → `unchanged` без `change` и события; иначе пишет `contentSnapshot`, публикует `contentSynced`, `version` растёт.
8. **`SnapshotDiffDqs(oldSnapshot, newSnapshot)`** — агрегатов не знает. Позиция шага — индекс в плоском обходе «проекты → уроки → шаги» (с 1); дубликат `stepId` — первое вхождение (как `StreamAr.stepPlace`). Методы: `compute(): SnapshotDiff`; `shiftsAround(pivotStepId): PivotShift`.
9. **«Кого засчитывать» — относительно текущего шага `c`**, не через `moved`: шаг `s` «стал позади», если в новом `idx(s) < idx(c)` и (`s` добавлен, либо в старом `s` был позже `c`). Зачёт — только если `s` у студента не `completed`. Старые рассогласования не зачитываются.
10. **`PivotShift`** = `{pivotInNew, pivotInOld, newlyBehind: stepId[], newlyAhead: stepId[]}` (порядок — новый снимок). `newlyBehind` — добавленные до pivot + пересёкшие «вперёд → назад»; `newlyAhead` — добавленные после + пересёкшие «назад → вперёд». Pivot нет в старом — только добавленные; нет в новом — списки пусты.
11. **ФР-6а:** исключение помеченных — в `StudentProgressDqs.durationOf` (покрывает `computeStepTimeStats` и `computeAvgTime` — медиана, категория).

**`SnapshotDiff`** (valibot-схемы с `v.description` в `content-sync.types.ts`):

```
SnapshotDiff = {
  changed: boolean,
  projects: { added: [{projectId, title}], removed: [{projectId, title}], renamed: [{projectId, from, to}] },
  lessons:  { added: [{lessonId, projectId, title}], removed: [...], renamed: [{lessonId, from, to}] },
  steps: {
    added:   [{stepId, lessonId, projectId, index}],   // index — позиция в новом
    removed: [{stepId, lessonId, projectId, index}],   // index — позиция в старом
    moved:   [{stepId, from:{projectId, lessonId, index}, to:{projectId, lessonId, index}}],
  },
}
```

`moved` — общий шаг, у которого сменились урок/проект или нарушен относительный порядок среди общих (не в LCS; детерминированно — самый левый вариант). Сдвиг индекса из-за чужих добавлений/удалений — не `moved`. Перенос урока — `moved` его шагов. Класс только для отчёта.

**`ContentSyncPlan`** (`plan()`, чистый вопрос, ничего не мутирует):

```
ContentSyncPlan = {
  mode: 'replace' | 'sync' | 'refused',        // enrollment | active | completed/archived
  diff: SnapshotDiff,
  students: StudentImpact[],                    // mode='sync'; иначе []
  affected: studentId[],                        // непустой behind, в порядке students
  blockers: SyncBlocker[],                      // пусто — применять можно
}
StudentImpact = {
  studentId, userId, status,
  kind: 'in_progress' | 'not_started',          // not_started: hasNoSteps
  behind: stepId[], ahead: stepId[], tail?: stepId,
  completedAhead: stepId[],                     // предупреждение (S1)
  removedPassed: stepId[],                      // записи остаются в истории
  removesCurrent: boolean,
}
SyncBlocker =
  | { code: 'CONTENT_NOT_SYNCABLE' }
  | { code: 'SYNC_REMOVES_CURRENT_STEP', students: [{studentId, userId}] }
```

**`StreamContentSyncDcs(stream: StreamAr, students: readonly StudentAr[])`:**

- `plan(newSnapshot): ContentSyncPlan`;
- `apply(newSnapshot, confirmedStudentIds, at): Result<ContentSyncOutcome, ContentSyncError>`, `ContentSyncOutcome = { mode, changedStudents: readonly StudentAr[], credited: [{studentId, stepIds}] }`.

Порядок `apply`: `plan` → первый блокер в `Err` → если `affected` непуст, сверка множеств `affected` и `confirmedStudentIds` без учёта порядка, несовпадение → `SYNC_NEEDS_CONFIRMATION { affected }` → все проверки до мутаций → `creditStep` по `behind` → `stream.replaceContent` последним. Повтор: `changedStudents` пуст, поток `unchanged`.

**Кто анализируется:** `enrollment` — `mode='replace'`, студентов не анализируем (`StreamLaunchDcs.launch` выдаст первый шаг нового снимка). `active` — `mode='sync'`, только `isInProgress()`; терминальные не попадают никуда. `hasNoSteps()` — `kind:'not_started'`, ничего не зачитывается, не блокирует (T5). Прочие: `c` нет в новом → `removesCurrent`, блокер; иначе `PivotShift` от `c`; `removedPassed` — удалённые шаги с записью.

## Таблица исходов

`c` — `currentStepId`, `idx` — позиции в новом снимке.

| # | Случай | Исход |
|---|---|---|
| 1 | `active`, `c` — последний шаг, `completed`; шаг добавлен в конец | `tail` = добавленный; студент не трогается, не в `affected`; выдаст `issueTail` |
| 2 | То же; шаг добавлен/перенесён перед `c` | `behind` → зачёт |
| 3 | То же; удалён последний шаг `c` | блокер `SYNC_REMOVES_CURRENT_STEP` |
| 4 | То же; несколько шагов в конец | первый — `tail`, остальные — `ahead` |
| 5 | `enrolled` без шагов в `active` | `not_started`, ничего, блокера нет (даже если `currentStepId` удалён) |
| 6 | `enrolled` в `enrollment` | не анализируется |
| 7 | Шаг перенесён в другой урок/проект, был после `c`, стал перед | `behind` → зачёт |
| 8 | Перенесён, порядок относительно `c` прежний | не зачёт; `diff.steps.moved` |
| 9 | Перенесён, был перед `c` (пройден), стал после | `completedAhead`; запись остаётся; студента не трогаем (S1) |
| 10 | Переставлены два шага, оба перед `c`, оба `completed` | зачёта нет, не в `affected` |
| 11 | Переставлены, один перешёл «после `c`» → «перед `c`» | `behind` → зачёт |
| 12 | `c` перенесён, остался текущим | `removesCurrent=false`; пересёкшие — по правилу 9 |
| 13 | Удалён и добавлен под новым id на то же место | `removed` + `added`; удалённый пройденный → `removedPassed`; удалённый текущий → блокер; добавленный перед `c` → `behind`, после → `ahead`/`tail` |
| 14 | Удалён пройденный шаг | не блокер; `removedPassed`; запись остаётся; `computeProgress` её не считает |
| 15 | Добавлен перед `c`, у студента запись `issued` | `behind` → `completed` с пометкой |
| 16 | Только переименования | `renamed`; `affected` пуст; `changed=true` |
| 17 | Снимки идентичны | `changed=false`; `unchanged`; ни студентов, ни события |
| 18 | `completed`/`archived` | `mode='refused'`, блокер `CONTENT_NOT_SYNCABLE` |
| 19 | Повторный `apply` | `changedStudents`/`credited` пусты, поток `unchanged` |
| 20 | Блокер + непустой `affected` | первым — `SYNC_REMOVES_CURRENT_STEP` |

## Шаги

**dmg-test-designer** — red-тесты, запуск, падают по делу:
- `snapshot-diff.dqs.test.ts`: `compute` — заголовки; добавленные, удалённые, перенесённые; перестановка; перенос в другой урок/проект с сохранением порядка; удалён+добавлен под новым id; идентичные; пустые; дубликат id; детерминизм `moved`. `shiftsAround` — добавление, перестановка, перенос; pivot нет в новом/старом.
- `stream-content-sync.dcs.test.ts`: строки 1–20; терминальные не меняются; порядок блокеров; подтверждение (нет / лишнее / недостающее / верное / `affected` пуст); идемпотентность; `plan` не мутирует; `apply` при отказе не мутирует.
- `student.ar.test.ts`: `creditStep` (нет записи / `issued` / `completed` → `already_credited`, `version` не растёт; `currentStepId`, `notices` не меняются; событий нет; `completionSource`); `lastActivityAt` и `neverStarted` игнорируют помеченные.
- `stream.ar.test.ts`: `canSyncContent` по статусам; `replaceContent` — ok, `unchanged` без события и `version`, отказ `completed`/`archived`, событие со счётчиками.
- `student-progress.dqs.test.ts`: помеченные вне `computeStepTimeStats` и `computeAvgTime`; в `computeProgress` и дереве — `completed`.

**dmg-domain-author** — реализация по «Было → станет», `bun test domain/src/stream`, в конце `bun run check`.

## Было → станет

| Артефакт | Было | Станет |
|---|---|---|
| `StepRecordVo` | `stepId, status, issuedAt, completedAt?` | + `completionSource?: 'content_sync'` |
| `StudentAr` | `issueStep`, `completeStep` | + `creditStep`; `lastActivityAt`, `neverStarted` пропускают помеченные |
| `StreamAr` | `activate/complete/archive`, вопросы | + `canSyncContent()`, `replaceContent()` |
| `StreamErrors` | `NOT_FOUND … STUDENTS_IN_PROGRESS` | + `CONTENT_NOT_SYNCABLE`, `SYNC_REMOVES_CURRENT_STEP`, `SYNC_NEEDS_CONFIRMATION` |
| `StreamEvents` | `created` | + `contentSynced` |
| `StudentProgressDqs.durationOf` | любая завершённая | помеченные → `undefined` |
| DQS/DCS | … | + `snapshot-diff.dqs.ts`, `stream-content-sync.dcs.ts`, `content-sync.types.ts` |
| `index.ts` | — | + экспорт |

**Судьба сценариев `scripts/stream-snapshot-sync.test.ts`** (окончательная таблица — `summary.md`, Ф3):

| # | Сценарий | Судьба |
|---|---|---|
| 1 | `extractStepIds` | заменён: порядок обхода в `SnapshotDiffDqs` |
| 2 | без изменений | перенесён: `changed=false`, `unchanged` |
| 3 | хвост после текущего | перенесён: строки 1, 4 |
| 4 | позади текущего | перенесён: строки 2, 7, 11 |
| 5 | `abandoned` игнорируется | перенесён: терминальные в DCS |
| 6 | `advanced` опережающий | заменён намеренно (ФР-6) |
| 7 | только опережающим | перенесён: `creditStep` + `apply` |
| 8 | идемпотентность | перенесён: `already_credited`, строка 19 |
| 9 | запись `students.json` | отпал: скрипт не пишет файлы; совместимость — `dmg-data-keeper` Ф2 |
| 10 | битая запись | отпал: разбор — репозиторий |
| 11 | битый `students.json` | отпал: то же; частичная запись — UoW, Ф2 |

## Сохраняемое поведение

- Не меняются: статусные переходы, `StepCompletionDcs`/`issueTail`, `StreamLaunchDcs`, тексты существующих ошибок, `StudentView`/`StreamView` кроме нового необязательного поля. `StudentEvents` при зачёте не публикуются.
- `stream.module.student.test.ts` (19 UC) в Ф1 не падает. Точных списков ошибок/событий потока в тестах нет.
- После реализации — полный `bun test`; красное вне `domain/src/stream` — в отчёт.

## Тактические решения (T)

| # | Решение |
|---|---|
| T1 | `plan()` возвращает значение (блокеры внутри), `apply` — `Result` |
| T2 | Подтверждение — только список `studentId` |
| T3 | Идентичный снимок → `unchanged` |
| T4 | Пустой новый снимок — без отдельной ошибки (риск — в Ф2) |
| T5 | `hasNoSteps` → `not_started`, без блокера |
| T6 | Guard на статус в `creditStep` не нужен — отбор в DCS |
| T7 | `neverStarted` игнорирует помеченные |
| T8 | `tail` — следующий после `c`, если `hasCompleted(c)` и шаг `newlyAhead` |
| T9 | Дубликаты `stepId` — первое вхождение |
| T10 | `StudentImpact.status` — для отчёта |
| T11 | `moved` — LCS, самый левый |

## Правила (ID rules.md)

DOM-01, DOM-02, DOM-03, DOM-04, DOM-06, DOM-07, DOM-09, DOM-10, DOM-11/13, DOM-12/14, DOM-17, ERR-01, ERR-02/04, ARC-02/03, CODE-02, CODE-04, TST-01, TST-03, TST-06, TST-08, TST-09.

## Критерии приёмки

1. `bun test domain/src/stream` зелёный.
2. Spec 1: все классы ФР-2; строки 1–20 — по тесту.
3. Spec 3: `creditStep` — пометка, без событий, `currentStepId`/`notices` не меняются; повтор не меняет `version`.
4. Spec 4: терминальные не попадают никуда и не меняются.
5. Spec 8а: помеченные вне `computeStepTimeStats` и `computeAvgTime`; в прогрессе и дереве — `completed`.
6. `plan()` не мутирует; `apply` при отказе не мутирует.
7. `canSyncContent`/`replaceContent`: статусы, `unchanged`, событие.
8. Три новые ошибки покрыты с проверкой кода и payload.
9. Нет мутации `state.steps` вне `student.ar.ts`; `*.dcs.ts` не импортируют `state`.
10. Экспорт в `index.ts`; `bun run check` зелёный; `CI=true bun test` без новых красных.
