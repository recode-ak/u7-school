# Бриф среза: stream-content-sync / uc (Фаза 2)

Черновик — `dmg-tech-lead`, решения — orchestrator (2026-11-15). Источники: `spec.md` (ФР-7, ФР-8, ФР-8а), `plan.md` (Ф2), `slices/domain.md`, код Ф1, образцы `create-stream.uc.ts`, `activate-stream.uc.ts`, `cancel-wish.uc.ts` (expectedVersion). Ссылки `файл:строка` приблизительные.

## Принятые решения

Стратегических вопросов нет. Тактические:

- версия для `expectedVersion` — поле `streamVersion` в выходе предпросмотра;
- `expectedVersion` необязателен (`F.expectedVersion`), скрипт Ф3 передаёт всегда;
- поток при `unchanged` не регистрируется;
- выход применения — `{ mode, credited }`;
- выход предпросмотра — вложенный `{ plan: ContentSyncPlanVo, streamVersion }`, файлы Ф1 не трогаем;
- `StreamContentSyncDcs`/`SnapshotDiffDqs` добавляются в тест «контракт не экспортирует классы».

## Границы

- **Трогаем:**
  - `domain/src/stream/stream/uc/` — два новых Def;
  - `domain/src/stream/stream.module.ts` — `useCases`, комментарий «поток (11 UC)» → 13;
  - `domain/src/stream/contract.ts` — экспорт Def и типов отчёта (`export type` из `content-sync.types`);
  - `modules/stream/src/stream/uc/` — две реализации и их тесты;
  - `modules/stream/src/stream.module.ts` — карта `streamMap.useCases`;
  - `domain/src/stream/stream.module.student.test.ts` — точный список UC 19 → 21.
- **Не трогаем:**
  - агрегаты и DCS/DQS Ф1 (ошибка в них — эскалация);
  - `dmg-core`, `dependsOn`, `StreamPolicy`;
  - `scripts/` и `data/` (Ф3).

## Решения

1. **Расположение и общие поля.** Def — `domain/src/stream/stream/uc/preview-stream-content-sync.uc.ts` и `sync-stream-content.uc.ts`. У обоих: `aggregate: StreamArDef`, `callers: ['user']`, `policy: StreamPolicy.rules.canManage`, `calls: [GetModuleSnapshotUcDef]` (из `@u7-scl/domain/course/contract`).
2. **`previewStreamContentSync`** — `query`.
   - input: `{ streamId: F.uuid }`;
   - output: `{ plan: ContentSyncPlanVo, streamVersion: F.int }`;
   - errors: `[StreamErrors.NOT_FOUND, ModuleErrors.NOT_FOUND]`.
   - Отказ по статусу и удалённый текущий шаг — не `Err`, а `plan.blockers`.
3. **`syncStreamContent`** — `command`.
   - input: `{ streamId, confirmedStudentIds: uuid[], expectedVersion? }`;
   - errors: `[StreamErrors.NOT_FOUND, ModuleErrors.NOT_FOUND, CONTENT_NOT_SYNCABLE, SYNC_REMOVES_CURRENT_STEP, SYNC_NEEDS_CONFIRMATION]`;
   - emits: `[StreamEvents.contentSynced]` — закрывает MAN-06;
   - output: `{ mode: 'replace' | 'sync', credited: [{studentId, stepIds}] }`.
   - `VERSION_CONFLICT` платформы в `errors` не перечисляется.
4. **Реализации** — `modules/stream/src/stream/uc/{preview-stream-content-sync,sync-stream-content}.uc.ts`, классы `PreviewStreamContentSyncUc`, `SyncStreamContentUc`, ключи карты `previewStreamContentSync`, `syncStreamContent` (API-05).
5. **`load`** (образец `activate-stream.uc.ts`) — поток по `streamId` (нет потока → `STREAM_NOT_FOUND`) плюс `students.findByStream`.
6. **`fetch`** (образец `create-stream.uc.ts`) — `this.call(GetModuleSnapshotUcDef, { moduleId })` после Policy. `Err` курсов пробрасывается.
7. **Query** — `new StreamContentSyncDcs(stream, students).plan(snapshot)` → `{ plan, streamVersion: stream.version }`. Ничего не регистрирует.
8. **Command:**
   1. `expectVersion(stream, expectedVersion)` первым шагом (D-57).
   2. `before = stream.version`.
   3. `dcs.apply(snapshot, confirmedStudentIds, now)`; `Err` → вернуть его.
   4. `register` для `changedStudents`, затем поток — только если `stream.version !== before`.
   5. `ok({ mode, credited })`.
9. **Поток регистрируется только при изменении**: UoW сохраняет всё зарегистрированное и пишет `writes`, а повтор не должен ничего записать.
10. **Порядок записи (ФР-8а)** — студенты первыми, поток последним. При сбое посередине повтор с тем же списком доводит обновление до конца (`affected ⊆ confirmed`).
11. **Модуль:** `useCases` 21 (stream 13, student 8).

## Шаги

1. **`dmg-api-author` — только Def.** Регистрация в модуле и `contract.ts`. Если `ModuleMap` с `satisfies` не собирается без реализаций — заглушки, бросающие `not implemented`.
2. **`dmg-test-designer` — red-тесты** `preview-stream-content-sync.uc.test.ts`, `sync-stream-content.uc.test.ts` на фейк-репозиториях и `makeEnv` (снимок модуля — через `StubFacade(CourseModuleDef).answer(GetModuleSnapshotUcDef, …)`):
   - статусы: `active` и `enrollment` применяются (`enrollment` — `replace`, студенты не пишутся); `completed`/`archived` — `STREAM_CONTENT_NOT_SYNCABLE` без записи;
   - удалён текущий шаг — `STREAM_SYNC_REMOVES_CURRENT_STEP { students }`, `saved` пусты;
   - подтверждение: нет списка или кто-то не подтверждён — отказ; лишний подтверждённый — не отказ; пустой `affected` — применение;
   - версия: `expectedVersion` не совпадает → `VERSION_CONFLICT` без записи; не передана → сверки нет;
   - сбой посередине: фейк бросает на `save` второго студента → поток со старым снимком; повтор с тем же списком доводит до конца (фейку при необходимости добавить тестовую возможность сбоя);
   - Policy: ментор потока и админ — ok; чужой ментор, студент, гость — `ACCESS_DENIED` без записи;
   - `writes` (UoW, oplog тестового контекста): студенты раньше потока, версии `from`/`to`; событие `stream.stream.contentSynced` со счётчиками; студенческих событий нет;
   - повтор: `credited: []`, поток не записан, события нет;
   - preview: `{ plan, streamVersion }`; ничего не пишет; блокеры — в `plan.blockers`, не `Err`; нет потока → `STREAM_NOT_FOUND`; чужой ментор → `ACCESS_DENIED`.
   - TST-08: таблицу исходов DCS (Ф1) в тестах UC не повторять.
3. **`dmg-api-author` — реализация** до green: `bun test modules/stream domain/src/stream`, затем `CI=true bun run check` (вкл. `arch:check`).
4. **`dmg-data-keeper`** — совместимость `student.json-repo`/`stream.json-repo` с необязательным `completionSource`: старые записи читаются, новое поле сохраняется, миграция не нужна. Живые `data/` не трогать.
5. **`dmg-reviewer`** — ревью Ф1+Ф2 (Ф1 уже отревьюен — смотреть только новое).

## Было → станет

| Артефакт | Было | Станет |
|---|---|---|
| `StreamModuleDef.useCases` | 19 | 21 |
| `contract.ts` | — | + 2 Def, типы отчёта |
| `modules/stream/src/stream/uc/` | 11 | + 2 класса и 2 теста |
| MAN-06 `contentSynced` | красный | `emits` у `syncStreamContent` |
| `stream.module.student.test.ts` | `'19 UC'` | `'21 UC'`, + 2 имени, + DCS/DQS в «не экспортируются» |

## Правила

MAN-01…06, API-01, API-05, D-41, D-45, D-57, D-73, ERR-01/02, DOM-01, TST-05, TST-08.

## Критерии приёмки

- `bun test modules/stream domain/src/stream` зелёный; полный `CI=true bun run check` зелёный.
- Spec 2, 3, 5, 6 покрыты тестами UC; `writes` и событие проверены (spec 7).
- Прямой записи JSON в UC нет; студенты пишутся раньше потока.
- Отчёт `dmg-data-keeper` без блокеров.
