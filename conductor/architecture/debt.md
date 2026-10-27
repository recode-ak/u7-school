# Реестр долга

**Назначение:** учтённые временные нарушения целевой архитектуры ([D-03](./decisions.md), [migration.md](./migration.md)), допущенные ради поэтапного перехода. Живой реестр — не привязан к треку: долг заводят и гасят разные треки.

---

## Правила

- ID — `DEBT-<n>` (отдельно от решений `D-NN` в [decisions.md](./decisions.md)); номера не переиспользуются, новый — следующий после максимального, в т.ч. погашенного (последний выданный — DEBT-37).
- Место долга помечено в коде маркером `// DEBT-<n>` (для `biome-ignore` — в тексте причины).
- `bun run arch:check` сверяет маркеры в пакетах (`platform/*`, `domain`, `modules/*`, `authoring/*`) и `scripts/` с записями этого файла в обе стороны.
- Закрытие = удаление маркеров и записи одним коммитом.
- В архиве трека `domain-package` ID записаны в старом формате: `D-<n>` там = `DEBT-<n>` здесь.
- **Тактические решения перехода** ведутся отдельно, как `TR-<n>` (§6, [agents.md](./agents.md) §9). Маркер в коде для них не обязателен, и `arch:check` их не сверяет. Если решение оставило временный код, на этот код заводится ещё и `DEBT-<n>`, и записи ссылаются друг на друга.

Шаблон записи:

```
### DEBT-<n>: <краткое название>
- **Место:** <файл(ы) или маска>
- **Причина:** <почему нельзя убрать сейчас>
- **Погашает:** <трек>
- **Критерий снятия:** <что должно исчезнуть: маркер, реэкспорт>
```

## Группы

1. Импорты `@u7-scl/app` / `@u7-scl/core` в домене.
2. Реэкспорты старых путей `modules/<m>/src/domain/index.ts`.
3. `User` в `app`.
4. Прочее.
5. Инструменты проверки.
6. Тактические решения перехода (`TR-<n>`).

## 1. Импорты `app` / `core` в домене

### DEBT-1: импорты `@u7-scl/core` в domain/user
- **Место:** `domain/src/user/**` (`facade.ts`, `module.ts`, `user/a-root.ts`, `user/events.ts`, `user/commands/{errors,notify-user-cmd,register-guest-cmd}.ts`)
- **Причина:** `Aggregate`, `DomainEvent`, `NotifyKind`, `AccessDeniedError`, `isoNow` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** трек перевода модуля на Def (из `dmg-core-extract` Ф4 снято — Нурболат, 2026-10-26)
- **Критерий снятия:** в `domain/src/user/**` нет маркеров `DEBT-1` и импортов `@u7-scl/core`

### DEBT-2: импорт `@u7-scl/app/domain` в domain/user/module.ts
- **Место:** `domain/src/user/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app`; создаёт циклическую зависимость пакетов `app` ↔ `domain` (только типы, в рантайме импорт стирается); сам цикл пакетов также снимается этим долгом.
- **Погашает:** перевод `user` на Def
- **Критерий снятия:** маркер `DEBT-2` удалён, `module.ts` не импортирует `@u7-scl/app`

### DEBT-5: `v.isoDateTime` в `UserSchema` (DOM-12)
- **Место:** `domain/src/user/user/entity.ts` (`createdAt`, `updatedAt`; `biome-ignore lint/plugin`)
- **Причина:** схема перенесена из `app` без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена.
- **Погашает:** перевод `user` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-5` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-6: импорты `@u7-scl/core` в domain/course
- **Место:** `domain/src/course/**` (`module.ts`, `*/a-root.ts`, `*/entity.ts`, `*/commands/errors.ts`, `content-path/commands/resolve-content-path-cmd.ts`; подпути `core/domain`, `core/shared`, `core/infra`)
- **Причина:** `Aggregate`, `FileMetadataSchema`, `AccessDeniedError`, `NotFoundError`, `isoNow`, `ApiModuleMeta`, `BaseJsonDb` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** трек перевода модуля на Def (из `dmg-core-extract` Ф4 снято — Нурболат, 2026-10-26)
- **Критерий снятия:** в `domain/src/course/**` нет маркеров `DEBT-6` и импортов `@u7-scl/core`

### DEBT-7: импорт `@u7-scl/app/domain` в domain/course/module.ts
- **Место:** `domain/src/course/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. DEBT-2).
- **Погашает:** перевод `course` на Def
- **Критерий снятия:** маркер `DEBT-7` удалён, `module.ts` не импортирует `@u7-scl/app`

### DEBT-11: импорты `@u7-scl/core` в domain/questionnaire
- **Место:** `domain/src/questionnaire/**` (`module.ts`, `questionnaire/{a-root,entity,events,questionnaire-factory}.ts`, `questionnaire/{likert,standard}/*-ar.ts`, `questionnaire/commands/errors.ts`; подпути `core/domain`, `core/shared`, `core/infra`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, ошибки, `isoNow`, `ApiModuleMeta`, `BaseJsonDb` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** трек перевода модуля на Def (из `dmg-core-extract` Ф4 снято — Нурболат, 2026-10-26)
- **Критерий снятия:** в `domain/src/questionnaire/**` нет маркеров `DEBT-11` и импортов `@u7-scl/core`

### DEBT-12: импорт `@u7-scl/app/domain` в domain/questionnaire/module.ts
- **Место:** `domain/src/questionnaire/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. DEBT-2).
- **Погашает:** перевод `questionnaire` на Def
- **Критерий снятия:** маркер `DEBT-12` удалён, `module.ts` не импортирует `@u7-scl/app`

### DEBT-16: импорты `@u7-scl/core` в domain/stream
- **Место:** `domain/src/stream/**` (`stream-ds.ts`, `{stream,student}/{a-root,entity,events}.ts`, `{stream,student}/commands/*-cmd.ts`; подпути `core/domain`, `core/shared`, `core/api`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, `errConflict`, `throwError`, `isoNow`, `now`, `UcMeta` живут в `core`; механический перенос не меняет базовые классы. `core/api` (`UcMeta`) — подпуть платформы, не входивший в долги user/course/questionnaire.
- **Погашает:** трек перевода модуля на Def (из `dmg-core-extract` Ф4 снято — Нурболат, 2026-10-26)
- **Критерий снятия:** в `domain/src/stream/**` нет маркеров `DEBT-16` и импортов `@u7-scl/core`

### DEBT-17: импорты `@u7-scl/app/domain` в domain/stream
- **Место:** `domain/src/stream/module.ts` (тип `U7ModuleResolver`), `stream/stream/a-root.ts` (константа `U7_SCHOOL_ID`)
- **Причина:** `U7ModuleResolver` и `U7_SCHOOL_ID` определены в `app` (см. DEBT-2).
- **Погашает:** перевод `stream` на Def
- **Критерий снятия:** маркер `DEBT-17` удалён, перенесённые файлы не импортируют `@u7-scl/app`

### DEBT-25: импорты `@u7-scl/core` в domain/peer-review
- **Место:** `domain/src/peer-review/**` (`review/{a-root,entity,errors,events}.ts`, `review-campaign/{a-root,entity,errors,events}.ts`, `*/commands/*-cmd.ts`, `errors.ts`; подпути `core/domain`, `core/shared`, `core/api`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, ошибки, `isoNow`, `UcMeta` живут в `core`; механический перенос не меняет базовые классы. `core/api` (`UcMeta`) — подпуть платформы.
- **Погашает:** трек перевода модуля на Def (из `dmg-core-extract` Ф4 снято — Нурболат, 2026-10-26)
- **Критерий снятия:** в `domain/src/peer-review/**` нет маркеров `DEBT-25` и импортов `@u7-scl/core`

### DEBT-26: импорт `@u7-scl/app/domain` в domain/peer-review/module.ts
- **Место:** `domain/src/peer-review/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. DEBT-2).
- **Погашает:** перевод `peer-review` на Def
- **Критерий снятия:** маркер `DEBT-26` удалён, `module.ts` не импортирует `@u7-scl/app`

## 2. Реэкспорты старых путей

### DEBT-3: barrel `modules/user/src/domain/index.ts`
- **Место:** `modules/user/src/domain/index.ts`
- **Причина:** потребители (≈96 файлов) импортируют `@u7-scl/user/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/user`; barrel удалён

### DEBT-8: barrel `modules/course/src/domain/index.ts`
- **Место:** `modules/course/src/domain/index.ts`
- **Причина:** потребители импортируют `@u7-scl/course/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/course`; barrel удалён

### DEBT-13: barrel `modules/questionnaire/src/domain/index.ts`
- **Место:** `modules/questionnaire/src/domain/index.ts`
- **Причина:** потребители импортируют `@u7-scl/questionnaire/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/questionnaire`; barrel удалён

### DEBT-18: barrel `modules/stream/src/domain/index.ts`
- **Место:** `modules/stream/src/domain/index.ts`, `modules/stream/src/api/errors.ts` (ошибки перенесены в `domain/stream/errors.ts`, т.к. домен импортировал их из api)
- **Причина:** потребители импортируют `@u7-scl/stream/domain` и `../errors`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/stream`; barrel удалён

### DEBT-23: barrel `modules/wish/src/domain/index.ts`
- **Место:** `modules/wish/src/domain/index.ts`
- **Причина:** потребители импортируют `@u7-scl/wish/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/wish`; barrel удалён

### DEBT-27: barrel `modules/peer-review/src/domain/index.ts`
- **Место:** `modules/peer-review/src/domain/index.ts`, `modules/peer-review/src/api/errors.ts` (если ошибки перенесены в домен)
- **Причина:** потребители импортируют `@u7-scl/peer-review/domain` и `../errors`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/peer-review`; barrel удалён

## 3. `User` в `app`

### DEBT-4: реэкспорт `User`/`Role` в app
- **Место:** `platform/app/src/domain/user.ts`
- **Причина:** `User`, `UserSchema`, `Role`, `RoleSchema`, `UserArMeta` импортируются из `@u7-scl/app/domain` во всём репозитории; канонический владелец теперь `domain/user`.
- **Погашает:** последний трек миграции
- **Критерий снятия:** потребители импортируют из `@u7-scl/domain/user`; `app/src/domain/user.ts` удалён

## 4. Прочее

### DEBT-9: `v.isoDateTime` в схемах domain/course (DOM-12)
- **Место:** `domain/src/course/{course,lesson,module,step}/entity.ts` (`createdAt`, `updatedAt`; `biome-ignore lint/plugin`)
- **Причина:** схемы перенесены без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что DEBT-5 для user).
- **Погашает:** перевод `course` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-9` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-10: приватный метод `#filterPublished` (CODE-02)
- **Место:** `domain/src/course/module/a-root.ts` (`#filterPublished`; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `course` на Def (фильтрация — в Policy/DQS)
- **Критерий снятия:** маркер `DEBT-10` и `biome-ignore` удалены, метод вынесен по правилам

### DEBT-14: `v.isoDateTime` в схемах domain/questionnaire (DOM-12)
- **Место:** `domain/src/questionnaire/questionnaire/{entity.ts,likert/likert-questionnaire.ts}` (`biome-ignore lint/plugin`)
- **Причина:** схемы перенесены без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что DEBT-5, DEBT-9).
- **Погашает:** перевод `questionnaire` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-14` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-15: приватные члены `#…` в QuestionnaireAr (CODE-02)
- **Место:** `domain/src/questionnaire/questionnaire/a-root.ts` (10 методов и поле `#engine`; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `questionnaire` на Def (логика — в Policy/DQS)
- **Критерий снятия:** маркеры `DEBT-15` и `biome-ignore` удалены, методы вынесены по правилам

### DEBT-19: `v.isoDateTime` в схемах domain/stream (DOM-12)
- **Место:** `domain/src/stream/{stream,student}/entity.ts` (9 мест; `biome-ignore lint/plugin`)
- **Причина:** схемы перенесены без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что DEBT-5, DEBT-9, DEBT-14).
- **Погашает:** перевод `stream` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-19` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-20: приватные методы `#…` в StudentAr (CODE-02)
- **Место:** `domain/src/stream/student/a-root.ts` (2 метода; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `stream` на Def (логика — в Policy/DQS)
- **Критерий снятия:** маркеры `DEBT-20` и `biome-ignore` удалены, методы вынесены по правилам

### DEBT-28: `v.isoDateTime` в схеме domain/peer-review (DOM-12)
- **Место:** `domain/src/peer-review/shared/schema.ts` (`isoMinuteField`; `biome-ignore lint/plugin`)
- **Причина:** схема перенесена без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что DEBT-5, DEBT-9, DEBT-14, DEBT-19; DEBT-24 погашен в `golden-wish` Ф2).
- **Погашает:** перевод `peer-review` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-28` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-29: приватный метод `#validateText` в ReviewAr (CODE-02)
- **Место:** `domain/src/peer-review/review/a-root.ts` (`static #validateText`; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `peer-review` на Def (валидация текста — в Policy)
- **Критерий снятия:** маркер `DEBT-29` и `biome-ignore` удалены, метод вынесен по правилам

### DEBT-30: barrel `modules/dossier/src/index.ts`
- **Место:** `modules/dossier/src/index.ts`
- **Причина:** пакет `@u7-scl/dossier` публикует корень `.`; потребителей в коде нет, но публичный путь сохранён на время миграции.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** пакет `@u7-scl/dossier` удалён; код живёт в `@u7-scl/domain/dossier`

### DEBT-32: субъект адаптера анкет — entity `User`
- **Место:** `modules/questionnaire/src/questionnaire.module.ts`, `modules/questionnaire/src/questionnaire/uc/start-questionnaire.uc.ts` (TR-11)
- **Причина:** legacy `QuestionnaireFacade.startStandard` принимает entity `User` из `@u7-scl/domain/user`; субъект DMG-модуля анкет — она же, хотя UC модулей на Def берут у субъекта только `uuid` (`Identified`, как `wish`).
- **Погашает:** миграция модуля `questionnaire`
- **Критерий снятия:** субъект модуля анкет — `Identified` или субъект из `UserModuleDef`, маркер удалён

### DEBT-35: ER `invite-wishers` не идемпотентен
- **Место:** `modules/wish/src/wish/er/invite-wishers.er.test.ts` (тест идемпотентности — `it.failing`)
- **Причина:** повторное `stream.created` с новым `eventId` снова публикует `wish.invited`: приглашаются все желания в `expressed`/`confirmed`, а статус после приглашения не меняется; отсев `Inbox` ловит только тот же `eventId` (D-47). Поведение как в legacy (TR-20 п. 2).
- **Погашает:** трек перевода `stream` или отдельная задача `wish`: приглашение потока в state желания
- **Критерий снятия:** тест идемпотентности `invite-wishers` — обычный `it`, маркер удалён

### DEBT-36: повтор команды не отсеивается по `requestId`
- **Место:** `platform/dmg-core/src/app/module/module-from-def.ts` (`dispatch`)
- **Причина:** правило D-49 / `transport.md` §2: `requestId` — одно намерение клиента, повтор command UC с тем же `requestId` от того же caller не исполняется дважды (сохранённый ответ; другой вход — конфликт; серверный `requestId` и query — без отсева). In-proc повторов нет, поэтому `dispatch` `meta` пока не исполняет; нужны хранилище ответов с TTL и код ошибки конфликта.
- **Погашает:** трек транспорта (HTTP-адаптер)
- **Критерий снятия:** `dispatch` (или адаптер транспорта) отсеивает повтор по правилу `transport.md` §2, тесты повтора и конфликта, маркер удалён

### DEBT-37: отказ UC DMG в боте показывается веткой legacy
- **Место:** `platform/core/src/ui/bot/bot-ui-story.ts` (`ucErrorNotify`)
- **Причина:** stories получают `Err` от `appApi.dispatch` (D-49) и ветвятся по `code`, а неожиданный отказ показывают через `errorNotify` legacy: `DomainError` → `AppException` (`toLegacyError`, `kind` → legacy-`kind`, текст — `denyMessage` или `label`). Своего презентера ошибок DMG у UI бота нет.
- **Погашает:** перевод UI бота на манифесты (D-26) или первый трек, которому нужен свой показ ошибок DMG
- **Критерий снятия:** презентер ошибок DMG в UI бота без `toLegacyError`, маркер удалён

## 5. Инструменты проверки

### DEBT-34: legacy-модули импортируют чужой `index`
- **Место:** `scripts/domain-check.ts` (`checkContractImports` пропускает пары legacy-модулей; `checkDomainImports` разрешает `index`)
- **Причина:** D-45 — чужой модуль только через `contract`; legacy-код `user`, `course`, `questionnaire`, `stream`, `peer-review`, `dossier` импортирует `index` друг друга (entity `User`, `Role`, фасады) — около 100 импортов.
- **Погашает:** перевод каждого модуля на Def — модуль попадает в проверку автоматически (`external` снят)
- **Критерий снятия:** все модули на Def; пропуск legacy-пар и `index` в `checkDomainImports` удалены, маркер удалён

## 6. Тактические решения перехода (TR)

Решения, которые orchestrator принял сам в автономном режиме ([agents.md](./agents.md) §9). На ревизии по ним видно, что сделано временно ради перехода, а что задумано. Номера не переиспользуются. Шаблон:

```
### TR-<n>: <краткое решение>
- **Трек / фаза:** <где принято>
- **Контекст:** <что мешало, какие были варианты>
- **Решение:** <что сделано>
- **Пересмотреть:** <что проверить на ревизии; DEBT-<n>, если есть временный код>
```

### TR-1: минимальные `WishErrors`/`WishEvents` в фазе агрегата
- **Трек / фаза:** `golden-wish`, Ф2
- **Контекст:** `defineAggregate` требует `events` и `errors` (у переходов — `rejects`), а события и ошибки `wish` — Ф3–4. Варианты: объединить Ф2 с Ф3–4 (большая фаза, эталон Ar смешан с событиями); оставить Ar на legacy до Ф3–4; завести минимальные группы сейчас.
- **Решение:** в Ф2 `wish.errors.ts` содержит только ошибки отказов переходов, `wish.events.ts` — минимум, который требует `defineAggregate`; legacy `errors.ts`/`events.ts` живут параллельно. В UC/ER `err` переходов временно превращается в прежнее legacy-исключение — поведение не меняется.
- **Состояние после Ф3–4:** параллельных групп нет (legacy `errors.ts`/`events.ts` удалены). Мост `modules/wish/src/api/legacy-reject.ts` (вне naming.md §3) остался и обобщён: `throwWishError` поднимает любую ошибку `WishErrors` через `toLegacyError` (код `WISH_*`, `kind` из Def) — UC/ER остаются legacy-классами до Ф8/Ф10. Тип `LegacyWishUcError` (`domain/wish/wish/commands/legacy-uc-error.ts`) — для `errors` legacy-мет команд.
- **Состояние после Ф5:** отказ Policy в `cancel-wish-uc.ts` (`CoreErrors.ACCESS_DENIED`) поднимается свободной функцией `throwWishError` мимо типизированного `WishUseCase.throwWishError`: `LegacyWishUcError` не описывает базовые ошибки. Ветка недостижима (желание ищется по актору). Там же остался `if` по статусу перед `cancel` (API-01) — legacy UC.
- **Пересмотреть:** в Ф8–11 (`UseCaseFromDef`/`ReactionFromDef`, `Result` через `appApi.execute`) `legacy-reject.ts` и `legacy-uc-error.ts` удалены. Policy подключается полем `policy` Def UC, `if` по статусу из `cancel-wish` уходит.

### TR-2: legacy-репозиторий `wish` на `WishArDef.state` через приведение типа
- **Трек / фаза:** `golden-wish`, Ф2
- **Контекст:** legacy `JsonFileRepo<T>` ждёт схему с одинаковым типом входа и выхода, а `F.timestamp` принимает строку или число и отдаёт число. Без разбора через `WishArDef.state` записи без `updatedAt` теряются (фолбэк D-36). Порт `WishRepo` в домене пока на `WishState`, поэтому `restore`/`snapshot()` вызывают UC/ER.
- **Решение:** `WishArDef.state as unknown as v.GenericSchema<WishState>` в `wish-json-repo.ts`; `core` не меняется. Часы и uuid в UC/ER — `Date.now()`/`crypto.randomUUID()`, как у соседних legacy-UC. Первая запись перепишет `data/wish/wishes.json` с числовыми датами и полями `updatedAt`/`version` — это формат spec (`F.timestamp` пишет число), старые ISO-записи читаются.
- **Пересмотреть:** в Ф6 (`WishJsonRepo`, порт на Ar/`Result`, UoW) приведения и `restore`/`snapshot` в UC/ER нет; часы — порт `Clock`.
- **Состояние после Ф6–7:** приведение и `JsonFileRepo` ушли (`infra/wish.json-repo.ts` по шаблону gen, строгий разбор — решение Нурболата), порт `WishRepo` в `modules/wish/src/wish/wish.repo.ts` принимает и возвращает `WishAr`. Остаток — часы (`Date.now()` в UC/ER) — в Ф8.

### TR-3: `kind: 'conflict'` у ошибок отказа переходов `wish`
- **Трек / фаза:** `golden-wish`, Ф2 (решение для Ф3–4; выбор поручен оркестратору Нурболатом)
- **Контекст:** legacy поднимал `BAD_REQUEST` (400) на недопустимый переход; в `WishErrors.WISH_NOT_*` — `conflict`. Варианты: сохранить `bad-request` ради совместимости или `conflict`.
- **Решение:** `conflict` — вход валиден, операция несовместима с текущим статусом агрегата (семантика 409). Код для вызывающих сменится в Ф3–4 вместе со снятием моста TR-1; тексты ошибок прежние. Ориентир для остальных модулей: отказ перехода жизненного цикла — `conflict`, невалидный вход — `validation` (legacy `bad-request`).
- **Пересмотреть:** на ревизии — согласованность `kind` отказов переходов во всех модулях; нет ли клиентов, различающих 400/409.

### TR-4: публикация событий `wish` из legacy-ER через `legacyEventBus`
- **Трек / фаза:** `golden-wish`, Ф3–4
- **Контекст:** события стали Def с FQN, а UoW (Ф6) и `ReactionFromDef` (Ф10) ещё нет; legacy-ER получают из резолвера только legacy-шину. Варианты: новый контракт резолвера с шиной DMG (правка `app`/`core`) или обёртка на месте.
- **Решение:** `modules/wish/src/api/legacy-publish.ts` (`publishWishEvents`, вне naming.md §3) строит конверт по образцу UoW (`systemCaller(<ER>)`, причина и `correlationId` — событие-причина) и публикует в `legacyEventBus(resolve.eventBus)`, который каждый ER создаёт сам. Legacy-подписчики (stories) получают FQN как `eventName`, `aggregateName` — `wish.wish`. Barrel `modules/wish/src/domain/index.ts` (DEBT-23) реэкспортирует `@u7-scl/domain/wish/contract`: у бота нет прямой зависимости от `@u7-scl/domain`.
- **Пересмотреть:** в Ф10–12 конверт строит UoW, wiring раздаёт **один** экземпляр шины DMG — сейчас конверт живёт в экземпляре моста конкретного ER, и подписчики DMG других модулей событий `wish` не увидят (таких пока нет). `legacy-publish.ts` удалён.

### TR-5: решения модели событий и ошибок `wish`
- **Трек / фаза:** `golden-wish`, Ф3–4
- **Контекст:** `invited` не меняет состояние; у module-желания нет курса для payload `confirmed`; коды `COURSE_NOT_FOUND`/`MODULE_NOT_FOUND` заняты модулем `course`.
- **Решение:** `invited` строит ER через `WishEvents.invited.make` (решение — на фасадах курсов и пользователей; метод Ar без перехода растил бы `version`), `telegramId` в payload оставлен — по нему UI отправляет карточку. `confirm` у module-желания в `pending` — `Err WISH_NOT_CONFIRMABLE` (ветка недостижима: module-желания создаются `expressed`). Отказы цели — `WISH_COURSE_NOT_FOUND`/`WISH_MODULE_NOT_FOUND` (`not_found`). Видимое пользователю не изменилось: бот ветвится по `kind`.
- **Пересмотреть:** на ревизии — не протекает ли адресация (`telegramId`) в домен; не нужна ли ER своя публикация событий (риск для Ф10: UoW публикует только события агрегатов).

### TR-6: Policy, DCS и метод-вопрос Ar в `wish`
- **Трек / фаза:** `golden-wish`, Ф5
- **Контекст:** ревью Ф5: `WishDcs.checkUnique` доверял вызывающему, что желания — этого пользователя на эту цель; геттер `WishAr.status` против DOM-04; право на создание.
- **Решение:** DCS сам отбрасывает чужие желания и желания на другую цель (`isOwnedBy`, метод-вопрос цели Ar `isFor`) — эталон не опирается на неявный контракт выборки. Фикстура дедуп-тестов `create-module-wish-uc.test.ts` строила «дубль» чужому пользователю — исправлена на актёра, сценарии и ожидания прежние. Геттер `status` оставлен до Ф6–7: по D-39 его заменяет метод Ar `alreadyExists()`, строящий ошибку. Право на создание не заводится (всегда за вызывающего) — с Ф8 UC создания ссылаются на `allowAll`.
- **Закрыто (Ф6–7, D-39/D-40):** `WishDcs` удалён — уникальность стала доменным правилом `WishRules.rules.unique`; геттер `status` заменён методом `WishAr.alreadyExists()`, строящим ошибку. Остаток — право на создание (`allowAll`) — в Ф8.

### TR-7: выбор «текущего» желания в репозитории `wish`
- **Трек / фаза:** `golden-wish`, Ф6–7
- **Контекст:** legacy `getByUserAndTarget` выбирал среди желаний пользователя на цель «активное последнее созданное, иначе последнее» — решение в хранилище (API-03). Его зовут `cancel-wish` и ER `confirm`/`abandon`, которые остаются legacy-классами до Ф9–11.
- **Решение:** порт `WishRepo.findCurrentByUserAndTarget` сохраняет выбор как есть (метод-вопрос Ar `isActive`); `WishAr` возвращается, `snapshot()` нужен репозиторию только для сортировки по `createdAt`. Резолвер `WishApiModuleResolver` (DEBT-22) переехал в `modules/wish/src/wish/wish.resolver.ts` — домен не импортирует порт прикладного слоя; подпуть `@u7-scl/wish/wish`.
- **Пересмотреть:** в Ф9–11 выбор уходит из репозитория (UC/ER получают `findAllByUserAndTarget` и решают через Ar или доменное правило); резолвер заменяет `WishModuleDef` (Ф12).
- **Ограничения до Ф8–11 (ревью Ф6–7):** `markStored()` зовёт только UoW — legacy-UC/ER, вызывающие `save` сами, не могут сохранить один экземпляр Ar дважды (второй `save` — `VersionConflict`; сейчас повторных нет). ER `fulfill-wish`, `invite-wishers` читают поля через `ar.snapshot()` и ветвятся по ним (как legacy, против D-39) — уходит вместе с переводом на `ReactionFromDef`.

### TR-8: решения по ревью Ф6–7 (платформа и правила)
- **Трек / фаза:** `golden-wish`, Ф6–7
- **Контекст:** ревью фазы: lint DOM-01 пропускает `*.dqs.ts` (D-39 разрешает форму проекциям DQS, но файл — и сервис); проверки DOM-16/ERR-02 в rules.md расходились с фактическими; `RulesDef` не проверяется как описанный Def; UoW публикует события записанных в `finally`.
- **Решение:** lint не меняется — у `*.dqs.ts` и доменного `*.facade.ts` проверка «state только для схем, без ветвления» — `review` (колонка DOM-01). DOM-16: тип — только своя ошибка в `check`; дубль в `rules` UC и ERR-02 — `checkDefs`; «ошибка группы своего агрегата» — `review`. `RulesDef` вне `describedDefs` — как `PolicyDef` (label/description правил проверяются через узлы правил графа). Публикация в `finally`: исключение шины подменяет результат UoW — принято (шина in-proc, её исключение — дефект); повтор операции после `VERSION_CONFLICT` может повторить события записанных — ER идемпотентны (D-36).
- **Пересмотреть:** при проверке принадлежности ошибки правила в `ArchChecker` (проверки Def) — снять `review` у DOM-16; при внешней шине — публикация вне `finally`.
- **Открытый вопрос Нурболату — DQS и state (решить до первого DQS, `stream`):**
  - (a) полный запрет: DQS читает только API Ar (методы-вопросы), state не импортирует;
  - (b) разрешить: DQS — доменный слой и сам даёт API, читает state напрямую;
  - (c) разделить файл: Def проекции (`v.pick` из state — «форма», D-39) отдельно от сервиса, сервис под полным запретом; поля в проекцию отдаёт Ar методом, типизированным схемой проекции;
  - (d) вычисление — в Ar: DQS только сводит ответы нескольких Ar, без собственного чтения полей.
  - Рекомендация оркестратора — (c) с опорой на (d): решение остаётся в Ar (D-39), DQS не становится вторым местом логики над полями, а форма выхода по-прежнему выводится из state; (b) возвращает утечку решений из Ar, (a) без (c) заставляет копировать схему выхода вручную.
- **Перед релизом (переход на прод):** строгий разбор `WishJsonRepo` — одна запись `data/wish/wishes.json` на сервере, не прошедшая `WishArDef.state`, остановит модуль `wish`. До переключения — прогнать разбор файла прода без записи (скрипт только читает). Локально каталога `data/wish` нет.

### TR-9: каркас модуля и сосуществование UC `wish` в Ф8
- **Трек / фаза:** `golden-wish`, Ф8
- **Контекст:** `gen uc` требует `<m>.module.ts`, а `WishModuleDef` по плану — Ф12; legacy-UC зарегистрированы в `api/module.ts` и вызываются ботом через `appApi.run('wish', 'create-course-wish', …)`.
- **Решение:** `gen module wish --adopt` выполнен в Ф8 (каркас `wish.module.ts` в домене и пакете; `dependsOn`, резолвер — Ф12). Новый `CreateCourseWishUc` (`UseCaseFromDef`, имя `createCourseWish`) живёт рядом с legacy-классом и тестируется отдельно; бот до Ф12 ходит в legacy (дублирование логики на время перехода). Схема входа legacy-команды выводится из Def, без копии.
- **Пересмотреть:** Ф12 — подключение `createWishModule` в приложение, перевод вызовов бота на новые имена, удаление legacy-классов и `commands/*-cmd.ts`.

### TR-10: детали платформы D-42 (Ф8 шаг 1)
- **Трек / фаза:** `golden-wish`, Ф8
- **Контекст:** перевод `dmg-core` на фасад без манифеста; решения автора, не оговорённые в D-42.
- **Решение:** (1) ошибки `load`/`execute` — `UseCaseErrorOf<D>` (с `CoreError`), чтобы потребитель отдавал отказ вызываемого UC как есть; ERR-02 для доменных ошибок сохраняется. (2) `module` с `origin = system` (ER/Job → фасад) — Policy вызываемого UC не проверяется, как у `system`; с `origin` пользователя — проверяется. (3) Отказ «UC нет в `calls` у `from`» — `UNAUTHORIZED` с необязательным `from` в payload. (4) `checkDefs` сверх брифа: вызываемый UC без `module` в `callers` — MAN-05. (5) `trace` — последний аргумент `load`/`execute`; `CallContext`, `Trace`, `Cause` — в `kernel` (их видит тип фасада в домене). (6) `asReadonlyAr` принимает класс Ar (Def агрегата `restore` не знает).
- **Пересмотреть:** ~~(2) — при делегировании и аудите системных цепочек; конверт события несёт `from` как Def целиком~~
- **Закрыто (Ф8а, Р7, D-43):** (1) остаётся — ошибки ядра чужого UC насквозь, необъявленная доменная не проходит по типу (закреплено тестами); (2) снято — Policy вызывается всегда (Р2); (3) снято — `UNAUTHORIZED` без `from`, рантайм-проверки `calls` нет; (4) снято — вида `module` нет, `calls` по типу только UC с `'system'` в `callers`, `checkDefs` остаётся; (5) остаётся (`CallContext` удалён); (6) снято — `Aggregate.readonly(state)`; `caller` удалён из конверта события и UoW.

### TR-11: UC-контракты внешних `course` и `questionnaire` с адаптерами
- **Трек / фаза:** `golden-wish`, Ф8
- **Контекст:** D-42 — межмодульный вызов идёт через Def UC владельца; `course` и `questionnaire` не мигрированы (D-37).
- **Решение:** во внешних контрактах — Def UC (query «старт записи на курс», command «запуск анкеты»); реализации — `UseCaseFromDef`-адаптеры поверх legacy-фасадов в пакетах владельцев; новый тип фасада рядом с legacy.
- **Детали 2a:** `CourseArDef` — минимальный (как `QuestionnaireArDef`); вход запуска — `owner` (как payload событий), адаптер переводит в legacy `ownerInfo`; `StartQuestionnaireUcDef.policy = allowAll` — респондент всегда субъект вызывающего, `origin` без субъекта — баг `callers` (`subject()` бросает); правило «только за себя» — при миграции (`QuestionnairePolicy` занято legacy). Типы фасадов — `CourseModuleFacade`/`QuestionnaireModuleFacade` (`<M>Facade` заняты legacy).
- **Детали 2b:** адаптеры — `UseCaseFromDef` в `modules/{course,questionnaire}/src/<a>/uc/`, владелец — обычный `ModuleFromDef` (`createCourseModule`, `createQuestionnaireModule`), подключение — Ф12. `if` по ответам legacy в адаптере курса — перевод в контракт (уходит с адаптером). `emits: [started]` адаптер не публикует: `questionnaire:start` по-прежнему в legacy-шине, в `inbound` его нет — добавить, когда появится DMG-подписчик. Ошибки legacy `start` — `SERVER_INTERNAL`.
- **Пересмотрено (Ф8а, Р9, D-43):** подход с Def UC во внешнем контракте и адаптерами принят; `callers: ['system']`; типы `CourseModuleFacade`/`QuestionnaireModuleFacade` удалены — `Facade<typeof <M>ModuleDef>` и `ModuleFacade`; `GetCourseEnrollmentUcDef.policy = allowAll` остаётся; `StartQuestionnaireUcDef.policy` — `QuestionnaireRespondentPolicy.rules.hasRespondent` (без субъекта — `ACCESS_DENIED`; имя — `QuestionnairePolicy` занято legacy).
- **Дополнено (Ф9):** `GetModuleEnrollmentUcDef` (`course`, query «модуль в программе опубликованного курса», `allowAll`) — адаптер `modules/course/src/course/uc/get-module-enrollment.uc.ts` над legacy `getModulePlace`.
- **Пересмотреть:** при миграции `course`/`questionnaire` — адаптеры заменяются настоящими UC, `external` снимается, legacy-фасады удаляются.

### TR-12: решения по ревью Ф8
- **Трек / фаза:** `golden-wish`, Ф8
- **Контекст:** ревью Ф8 — ошибок нет; warn: гайд facade о `checkDefs`, тесты потребителя не проверяют `calls` (фейки фасадов), транзиентное поле `WishAr.questionnaireToStart()` вне state; info — ниже.
- **Решение:** (1) гайды и domain-modeling поправлены (оговорка D-41 у антипаттерна «скрытые мутации», имя `<M>ModuleFacade` у внешних). (2) Фейк фасада в `dmg-core/testing`, отказывающий, если Def UC нет в `call.from.calls`; тесты `wish` — через него. (3) Вместо транзиентного поля — `createForCourse` возвращает `{ wish, questionnaire? }` (анкета — результат создания, не свойство Ar). (4) Тип `owner` фасада анкет выводится из входа Def. Принятые риски: `CallingOperation` — структурный тип (можно собрать `from` вручную) и прямой `handle` с `user` у UC, принимающего `user` и `module`, — закрываются ARC-06 и in-proc вызовом; `UseCaseOwner` стирает субъект до `unknown` (DEBT-21/22, TR-11).
- **Пересмотреть:** при выходе модуля в сервис — подпись `from` (не структурный тип); при миграции анкет — типизация субъекта в `UseCaseOwner`.
- **Пересмотрено (Ф8а, Р10, D-43):** (3) снято — `createForCourse` → `Result<WishAr, never>`, анкета и ответ — методы-вопросы из state `questionnaire()`/`outcome()`, `CourseWishCreated` удалён; (2) — `StubFacade<M>` (Р4), проверка `calls` — типом (Р5); (4) — `owner` из Def через `Facade<M>`; риски `from`/прямого `handle` — сняты Р3/Р5. Остаётся: `SystemCaller<unknown>` на границе `Facade<M>` до миграции анкет (DEBT-21/22).

### TR-13: детали `Caller` по D-43 (Ф8а шаг 1)
- **Трек / фаза:** `golden-wish`, Ф8а
- **Контекст:** Р1 — иерархия `Caller`; решения автора сверх D-43.
- **Решение:** (1) ~~модуль для `OperationRef` — третий аргумент конструктора базы~~ → решение Нурболата на Р4–Р5: модуль передаёт себя — `ModuleMap` `new (deps, module)`, наследник `constructor(deps, module: typeof XModuleDef) { super(XUcDef, deps, module) }` (`ModuleDef` — только тип); Def вне модуля — исключение базы. (2) У `SystemCaller` поле человека приватное (`origin`), наружу — метод `person()`; у `DelegateCaller` субъект — приватный `principal`. (3) `Caller<unknown>` → `Caller` (дженерик ограничен `Identified`: `toLog` нужен `uuid`); `ApiApp.TActor` без ограничения ради legacy, DMG-часть — `TActor & Identified`. (4) Конверт legacy-события — `SystemCaller` с условной операцией `{ kind: 'useCase', module: 'legacy', name: eventName }`; `onBehalfOf` у ER снят. (5) ~~До Р2 Policy пропускается только для `system` без человека~~ — снято на Р2 (Policy всегда). (7) Р2: фиксация (`uow.commit()` и публикация) — не `protected`-шаг, а инвариант приватного `run` базы: наследнику в ней нечего менять. (6) ~~До Р5 рантайм-проверка `calls` — в `callUseCase`/`fakeFacadeCall` (в `OperationRef` нет `calls`), `UNAUTHORIZED { callerKind: 'system', from }`~~ — снято на Р5 (тип `call`).
(8) Р3: `runJob` → `Result<JobReport, DomainError>` (отчёт нужен планировщику); публичный `serves(def)` у модуля (выбор модуля в `ApiApp`); `jobTrace()` — до `Trace.forJob` (Р8); в `callUseCase` сначала `calls`, потом `handle` (до Р5); чужой Def в `handle`/`runJob` — ошибка типа, при стёртом типе — исключение (ошибка сборки, не штатный отказ, ERR-01).
(9) Р4–Р5: `handle` у `Facade`/`ModuleFacade`/`StubFacade` — `<D extends AnyUseCaseDef>(def: D extends SystemCallable<M> ? D : never, …)`, иначе фасады не кладутся в общий `ModuleFacades` без приведения; `SystemCallable` уже сужен до `'system'` в `callers` (для фасада и `StubFacade.answer`); `calls` у `EventReactionDef`/`JobDef` без объявления — `readonly []` (иначе ER/Job вызывали бы любой UC); нет фасада в `ModuleFacades` — исключение сборки; два рантайм-теста `wish` на подмену `calls` заменены проверкой состава `CreateCourseWishUcDef.calls`.
(10) Р6: запись лога берёт события из `published` всех UoW вызова (при `VERSION_CONFLICT` события записанных агрегатов уже опубликованы), у Job — одна запись на прогон; вход ER — событие без `caller`, Job — `null`; брошенное исключение пишется как `SERVER_INTERNAL` (стек — `logger.error`); сбой записи лога — `logger.warn`, результат операции не меняется (данные уже зафиксированы); `JsonlOperationLog` — в `dmg-core/app`. Прод-подключения нет: DMG-модули в приложении собираются в Ф12 — там `new JsonlOperationLog(`<DB_DIR>/oplog`)`.
(11) Р7: в `Aggregate.readonly` — `biome-ignore noThisInStatic` (полиморфный `this` — суть формы); фикстура графа с `calls: readonly AnyUseCaseDef[]` обходит проверку типа — Def с общим типом ловит только `checkDefs`; из `publishWishEvents` убраны `caller` и `source`; legacy-подписчики вызывающего и раньше не получали. (4) снято на Р7.
(12) Р8: класс `Trace` (`fromRequest` — две перегрузки: без `onMissing` `requestId` обязателен, с ним — создаётся с сообщением, ERR-07; `fromEvent`, `forJob(def)` — причина Job получила поле `job`; `toLog()`, `toEnvelope()` сверх D-43); `createUow(trace)` без `caller`; `ApiApp.run`/`execute` принимают `Trace` (след строит транспорт); `fromEvent` не переносит `channel` (в конверте его нет); символ-метка `create` vs `restore` остаётся, ставит её `newState`. (8) `jobTrace` снято на Р8.
- **Пересмотреть:** (10) подключение JSONL — Ф12; (12) `channel` в конверте события — когда ER понадобится канал.

### TR-14: решения по ревью Ф8а
- **Трек / фаза:** `golden-wish`, Ф8а
- **Контекст:** ревью Ф8а (`c05ec0a3..HEAD`): error и warn нет, 8 info.
- **Решение:** (1) ссылки doc `UseCaseFromDef.load` (D-42 → D-43) и `event-envelope` (caller.md п. 6) поправлены; (2) шаги `load`/`execute`/`react`/`run` полями-стрелками в тестах платформы → методы (эталон копируют); (3) `DeclaredCalls` — один тип в контрактах вместо копий в `define-job`/`define-event-reaction`; (4) Policy «респондент есть» — `rule<{ readonly uuid: string }>` без `_subject`; (5) гайды: `journal` — инвариант базы, наследник UC не вызывает (`protected` — ради ER/Job); нет фасада в `ModuleFacades` → `SERVER_INTERNAL` с `logger.error`, а не исключение до транспорта.
- **Принятый риск:** порог размера JSONL — только `input`/`output`; `payload` ошибки и `events` без обрезки (по D-43).
- **Пересмотреть:** порог для `events`/`payload` — при подключении JSONL в Ф12 (вместе с TR-13 п. 10); машинная проверка полей-стрелок шагов (GritQL-плагин biome) — когда появятся плагины правил.

### TR-15: решения по ревью Ф9
- **Трек / фаза:** `golden-wish`, Ф9
- **Контекст:** ревью Ф9 (`6e542c7d..HEAD`): error нет, 3 warning, 5 note.
- **Решение:** (1) сборка payload `WISH_NOT_FOUND` тернаром по цели в `CancelWishUc.load` → статическая фабрика ошибки Ar от цели (API-01), ею же выражен `notFound()`; (2) адаптер курса `getModuleEnrollment` дописан в TR-11; (3) `WISH_NOT_CANCELLABLE` в `errors` `cancelWish` при недостижимости через UC — оставлен (ERR-02: его возвращает переход Ar); подмена ошибки перехода в UC запрещена (гайд «use case» §4).
- **Принятый риск:** query `listUserWishes` отдаёт `wish.snapshot()` — идиома учебного `list-tasks` в `dmg-core`, расходится с D-05 / D-39 («`snapshot()` только для репозитория», данные выхода — методом Ar). В гайде помечено «временно (TR-15)».
- **Пересмотрено (Нурболат, 2026-10-22, D-44):** `Aggregate.view()` — состояние наружу (по умолчанию `snapshot()`, переопределяемо); `snapshot()` — только репозиторий, DOM-17 (lint). Перевод — Ф9а.
- **Было — пересмотреть:** с Нурболатом (открытый вопрос брифа `wish` п. 8) — как query отдаёт state агрегата: метод Ar, строящий выход, разрешение `snapshot()` в query, или иное; затем — учебный модуль `dmg-core`, `listUserWishes`, гайд; кандидат в машинную проверку — запрет `.snapshot()` в `modules/*/src/**/uc`.

### TR-16: legacy `wish` вне DOM-17
- **Трек / фаза:** `golden-wish`, Ф9а
- **Контекст:** D-44 / DOM-17 — `.snapshot()` только в репозитории; legacy ER и UC `modules/wish/src/api/**` читают поля через `snapshot()` — 6 вызовов: 5 в ER (`fulfill-wish-er.ts`, `invite-wishers-er.ts`) и legacy `api/wish/list-user-wishes-uc.ts`.
- **Решение:** путь исключён из плагина DOM-17 в корневом `biome.json` (одна строка), без `biome-ignore` по файлам.
- **Пересмотреть:** при переводе ER (Ф10–11) и удалении legacy-UC (Ф12) — исключение снять.
- **Пересмотрено (Ф12, TR-21):** legacy `wish` удалён, исключение из DOM-17 снято.

### TR-17: решения по ревью Ф9а
- **Трек / фаза:** `golden-wish`, Ф9а
- **Контекст:** ревью Ф9а (Opus, `de44c108..e5983103`): error нет, 3 warning, 4 note.
- **Решение:** (1) ~~`SameType` сверяет и множества ключей~~ — пересмотрено Нурболатом: `this`-ограничение и `SameType` удалены как избыточные, `view(): V` по умолчанию `snapshot()`; «объявил `V` — переопредели `view()`» — review и тест агрегата (принятый риск); типы агрегата вынесены из `aggregate.ts` в отдельный файл; (2) DOM-17 ловит `?.snapshot()`; (3) исключения DOM-17 — только по имени файла репозитория (`*.repo.ts`, `*-repo.ts`, `*.json-repo.ts`, `*.memory-repo.ts`), `infra/**` целиком больше не исключён (фасады — зона `view()`); (4) rules.md, TR-16 (6 вызовов), гайд «aggregate» (переопределение собирает объект явно) поправлены.
- **Принятый риск:** `ar['snapshot']()`, деструктуризация и `.call` lint не ловит — review.

### TR-18: ER `fulfill-wish` (Ф10)
- **Трек / фаза:** `golden-wish`, Ф10
- **Контекст:** первая ER `wish` на `ReactionFromDef`; запросы к курсу — внешние UC `getCoursesIncludingModule`, `getSameModules` (адаптеры TR-11).
- **Решение:** (1) module-ветка — один батч `getSameModules` (legacy `whichModulesAreSame`) вместо цикла `isSameModule`: поведение то же, контракт фасада курсов это обещает; (2) решение «что спросить у курса и что реализовать» — `WishFulfillmentDcs` (первый DCS `wish`, DOM-06: батч по нескольким агрегатам), вопросы одного желания — методы `WishAr` (`fulfillmentTargets`, `isFulfilledBy`); (3) отказ любого вопроса к курсу прерывает реакцию целиком (UoW атомарен), legacy при сбое фасада успевал сохранить часть course-желаний — отличие только в сбойном случае; (4) новая ER живёт рядом с legacy `api/er/fulfill-wish-er.ts`, в приложение не подписана (как TR-9).
- **Пересмотреть:** Ф12 — подписка `createWishModule`, удаление legacy ER; на ревизии — п. 3.

### TR-19: решения по ревью Ф10
- **Трек / фаза:** `golden-wish`, Ф10
- **Контекст:** ревью Ф10 (Opus, `23f27f3c..33018818`): error нет, 1 warning, 8 info.
- **Решение:** (1) `*.types.ts` (`wish.types.ts`, `wish-fulfillment.types.ts`) — по указанию Нурболата «экспортируемые типы — в отдельный файл» (как `aggregate.types.ts`); внесено в naming.md §4 (Нурболат, 2026-10-26); (2) гайд «event reaction»: вспомогательные `private`-методы ER допустимы, прямой `subscribe(bus)` — только в тестах — поправлено; (3) необязательный раздел «Устройство реализации» в гайдах (use-case, event-reaction) — `_template.md` не меняем до Ф13 (сводка гайдов); (4) JSDoc `GetSameModulesUcDef` о legacy-реализации, длина теста отказа и ожидание опросом в тесте `subscribe`, перепутанные виды id в фикстурах DCS-теста — оставлены, поправить в Ф11 вместе с остальными ER (тот же файл теста и образец); (5) `FulfillmentTargets` — и вопрос, и ответ `isFulfilledBy` — принято, одна форма списков целей.
- **Пересмотреть:** Ф11 — п. 4 (закрыт, TR-20 п. 6); Ф13 — п. 3.

### TR-20: ER `confirm-wish`, `abandon-wish`, `invite-wishers` и ревью Ф11
- **Трек / фаза:** `golden-wish`, Ф11
- **Контекст:** три оставшиеся ER `wish` по гайду Ф10; ревью (Sonnet, `cd5bd03..be43672a`): error нет, 1 warning, 6 info.
- **Решение:** (1) событие без смены статуса — `WishAr.invite` через `change` (Нурболат, 2026-10-26, вопрос 9 брифа): запись `version`/`updatedAt` на каждое приглашение; при `VERSION_CONFLICT` на N-м желании приглашения до него уходят, после — нет (D-15), legacy рассылал всем; (2) повторное `stream.created` — повторное приглашение (как legacy): идемпотентность требует приглашения в state — долг, вне трека; (3) внешние UC `getCoursesStartingWithModule` (одним вопросом `getModulePlace().isFirst` + `whichCoursesIncludeModule`, объединение в адаптере), `getStreamPresence`, `getTelegramAddresses` (адаптер — цикл по `getUserByUuid`, батча в legacy нет); минимальный `UserArDef`, карты `stream.module.ts`, `user.module.ts` (TR-11); (4) отличия от legacy в пропусках: «нет профиля» и «нет `telegramId`» — один случай, `warn` на пользователя, а не на желание; адаптер адресов отсекает только `undefined` (`telegramId: 0` невозможен в Telegram — принято); (5) по ревью: литералы статусов в `findAllByKind` ER убраны — отбор только `canInvite` в `WishInvitationDcs` (warning); `askMatch`/`askReach` — механика «вопрос → Def UC» в ER, кандидат в общий приём `ReactionFromDef` на ревизии; `invitationTargets`/`isInvitedBy` дублируют `fulfillment*` — общая форма при третьем потребителе; обновление `@types/bun` в `bun.lock` от `bun install` — принято; (6) хвосты TR-19 п. 4 закрыты в Ф11: JSDoc Def UC курса без legacy, виды id в фикстурах DCS-тестов, тест отказа и `subscribe` в `fulfill-wish.er.test.ts`.
- **Пересмотреть:** Ф12 — подписка новых ER в `createWishModule`, удаление legacy ER; на ревизии — п. 1, 2, `askMatch`/`askReach`.

### TR-21: сосуществование `wish` в приложении (Ф12)
- **Трек / фаза:** `golden-wish`, Ф12
- **Контекст:** подключение DMG-модуля `wish` и адаптеров зависимостей к боту; удаление legacy `wish` после переключения.
- **Решение:** (1) порядок задач Ф12: мост → сборка/stories → удаление legacy (иначе `check` между задачами красный); (2) мост: дефолт `onInvalid` — `console.warn` (исключение async-обработчика `InProcEventBus` глотает), маршрут `inbound` — одна подписка на legacy-шину; (3) одна сборка DMG для бота, test-app и `call-uc` — `runners/u7-bot/src/create-dmg-modules.ts` (`createDmgAppContext`, `createDmgModules`); (4) stories зовут UC по Def через `U7BotUiStory.executeUc` (`UserCaller`, `Trace.fromRequest` с каналом `telegram`); `requestId` генерируется с `warn` на каждый вызов — `update_id` до стори не доходит без смены контракта ядра бота; (5) `wishModule` убран из `ApiAppBundle` (потребителей нет); `call-uc` зовёт UC `wish` через DMG (oplog — `data/oplog`, как бот); (6) экспорт `"."` у `@u7-scl/user`, `./wish.module` у `@u7-scl/wish`; workspace-зависимости `dmg-core`, `@u7-scl/domain` у `runners/u7-bot`; (7) шаг 3: legacy `wish` удалён (`modules/wish/src/api/**`, резолвер, домен `module.ts` и `commands/**`, 67 legacy-тестов — случаи покрыты тестами DMG UC/ER и домена); исключение `modules/wish/src/api/**` из DOM-17 в `biome.json` и его фикстура сняты (TR-16 закрыт); DEBT-21/22 остаются в `modules/wish/src/{wish.module.ts,wish/uc/*.uc.ts}` — субъект `User` из `@u7-scl/app` (решается в Ф13).
- **Пересмотреть:** п. 4 — протащить `update_id` до стори (контракт `BotUpdate`/`handleCallback`) в треке ui-manifests, тогда `warn` уйдёт; п. 3 — при миграции следующих модулей сборка растёт там же.

### TR-22: решения по ревью Ф12
- **Трек / фаза:** `golden-wish`, Ф12
- **Контекст:** ревью (Opus, `211dbdb3..HEAD`): error 0, warning 0, info 8.
- **Решение:** (1) гайд «module»: место внешнего `defineModule` (`<m>.module.ts`, экспорт из `contract.ts`) и предупреждение о субъекте `User` (DEBT-21/22) — поправлены; (2) `warn` на каждый вызов `executeUc` — принято (TR-21 п. 4); (3) мост: пустой `Set` после отписки, обработчик для Def без маршрута `inbound`, лишняя проверка `isOf` — без влияния на поведение, принято; (4) шпион `console.error` в `legacy-event-bus.test.ts` снимается в теле теста, а не в `afterEach`; повтор сборки `UserCaller` + `Trace.fromRequest` в интеграционных тестах `u7-bot` — кандидат на хелпер `test-app`; (5) прямая зависимость `u7-bot` от `@u7-scl/domain` — повод пересмотреть barrel DEBT-23.
- **Пересмотреть:** п. 3, 4 — в Ф13 (чистка вместе с DEBT-21/22); п. 5 — Ф13 / последний трек миграции (DEBT-23).

### TR-23: закрытие DEBT-21/22/31 (Ф13)
- **Трек / фаза:** `golden-wish`, Ф13
- **Контекст:** в домене `wish` импортов `core`/`app` не осталось с Ф12; DEBT-21/22 держал субъект `User` из `@u7-scl/app` в UC `modules/wish` и адаптере анкет. DEBT-31 — ручной `DOMAIN_GRAPH`; у `peer-review` и `dossier` не было `ModuleDef`. Подключение приложения домена в `ARCH_APPS` дало 92 нарушения `checkFiles` платформы.
- **Решение:** (1) субъект модуля и UC `wish` — `Identified` (`dmg-core`); `this.call` к анкетам принимает его без изменений платформы; (2) адаптер анкет берёт `User` из `@u7-scl/domain/user` — DEBT-32; (3) внешние `PeerReviewModuleDef`, `DossierModuleDef`; граф ARC-04/05 — `domainGraphOf(DOMAIN_MODULES)` (`scripts/domain-arch.ts`, бывший `domain-debt.ts`), каталог домена без Def — ARC-05; `checkDefs` по модулям домена — в `runDomainCheck`; (4) `archCheck` домена не подключён — DEBT-33 (ARC-04 платформы без подпутей `/contract`, legacy внешних модулей); (5) тест `domain/src/domain.modules.test.ts` перенесён в `scripts/arch-check.test.ts`: файл в корне `domain/src` с импортами всех модулей нарушал ARC-04 проекта, а `checkDefs` по модулям теперь в `arch:check`; (6) DEBT-24 погашен ещё в Ф2.
- **Пересмотреть:** п. 4 — стратегически: открыть ли подпути `/contract`, `/state` в ARC-04 платформы или перевести домен на импорт через `index.ts` (вопрос Нурболату); TR-22 п. 3, 4 — без влияния на поведение, остаются принятыми.

### TR-24: форма портов `Outbox` и `Inbox` (Ф4)
- **Трек / фаза:** `dmg-core-extract`, Ф4 (шаг 2)
- **Контекст:** D-47 задаёт outbox и отсев повторов; детали формы портов решены оркестратором.
- **Решение:** (1) `Outbox.put(envelopes)` — асинхронный, партия одной фиксации; запись агрегатов и outbox не атомарна (JSON-хранилище, D-15); (2) `Inbox` — `claim`/`release`: доставка занимается до обработки, снимается при любом не-`Ok`; параллельный повтор во время первой доставки отбрасывается и теряется, если первая упала — для in-proc шины повторов нет, для relay «как минимум один раз» допустимо; (3) `outbox`, `inbox` в `AppContext` обязательные (ручных сборок две, остальные — `testAppContext`); (4) отсев — в `ReactionFromDef.handle`, а не в модуле: действует при любом пути доставки; повтор — `Ok`, без записи в лог операций, `debug`; (5) `InProcInbox` ограничен ёмкостью (`DEFAULT_INBOX_CAPACITY = 10_000`) — память процесса бота; (6) хелпер `expectIdempotentReaction` требует `Ok` и от второй доставки: отказ на повторе — нарушение. (7) по ревью: сбой `claim` — `SERVER_INTERNAL` без снятия доставки, сбой `release` — `error` в логгер; сбой `outbox.put` после сбоя сохранения — в `cause` исходного исключения.
- **Пересмотреть:** п. 1, 2 — при первом персистентном outbox или внешней шине.

### TR-25: MAN-13 в рантайме UoW — необязательный `module` (Ф4)
- **Трек / фаза:** `dmg-core-extract`, Ф4 (шаг 4)
- **Контекст:** UoW проверяет «один UoW — один модуль» по `UnitOfWorkContext.module`; Def агрегата и репозиторий свой модуль не знают, модуль передаёт `OperationFromDef`.
- **Решение:** поле необязательное, как `emits` и `touches`: UoW, созданные вне `OperationFromDef` (мосты legacy), в рантайме MAN-13 не проверяют; статически правило держит `checkDefs`. Ветка MAN-06 «агрегат другого модуля» снята — теперь это MAN-13.
- **Пересмотреть:** при удалении мостов legacy — сделать `module` обязательным.

### TR-26: ARC-04 между внешними модулями (Ф4, DEBT-33 погашен)
- **Трек / фаза:** `dmg-core-extract`, Ф4 (шаг 5)
- **Контекст:** подключение домена в `ARCH_APPS` со входом `contract` (D-45) дало 52 импорта чужого `index` из домена legacy-модулей (course 28, stream 19, questionnaire 3, peer-review 2) — это DEBT-34. Перевод на `/contract` невозможен: legacy-домену нужны legacy-классы, которых в контракте нет.
- **Решение:** `checkFiles(index, layout, entry = 'index')` — вход модуля задаёт приложение (`ArchApp.entry`, у домена — `contract`). Импорт мимо входа не проверяется, только если оба модуля `external` (реализованы вне приложения) — так D-45 читает «пары legacy-модулей — по долгу»; модуль на Def импортирует и импортируется только через вход; `dependsOn` проверяется для всех. Прикладной слой внешнего модуля не сканируется (цикл импортов не учитывал `external`). DEBT-33 погашен: `DomainArch` в `ARCH_APPS`.
- **Пересмотреть:** при переводе последнего legacy-модуля (DEBT-34) — исключение станет пустым.

### TR-27: вызов чужого UC в `load` до Policy в учебном модуле `dmg-core`
- **Трек / фаза:** `dmg-core-extract`, Ф5 (обогащение `src/testing/example`)
- **Контекст:** `assignTask` спрашивает `users.getUser` в `load`, а Policy проверяется после `load`. Не-владелец задачи по коду ошибки может узнать, существует ли пользователь; `users` получает лишний вызов. Перенос вызова после Policy требует изменить жизненный цикл UC платформы (форма API `dmg-core` — стратегическое).
- **Решение:** порядок сохранён; в гайде use-case — ловушка «вызов зависимости в `load` идёт до права».
- **Пересмотреть:** нужен ли в жизненном цикле UC шаг «вызовы после Policy» (или Policy до чужих вызовов) — решение по API `dmg-core`.

### TR-28: сборка артефактов `dmg-core` до появления `init`/`sync` и `dmg-core gen`
- **Трек / фаза:** `dmg-core-extract`, Ф5 (сборка `docs/`, `skills/`, `agents/`, `llms.txt`)
- **Контекст:** документация, скил и роли переехали в пакет, а доставка в проект (`dmg-core init`/`sync`) и генератор пакета (`dmg-core gen`) — следующие задачи фазы. Монорепо должно работать между ними.
- **Решение:** (1) `agents:sync` читает роли и общий блок прямо из `platform/dmg-core/agents/` (константы `PACKAGE_ROLES_DIR`, `PACKAGE_COMMON_FILE`); одноимённая роль в пакете и проекте — ошибка; (2) скил `dmg-architecture` подключён симлинком `.pi/skills/dmg-architecture → platform/dmg-core/skills/dmg-architecture`; (3) документация пакета пишет команды как `dmg-core gen …`, в проекте это `bun run gen …` (`conductor/architecture/naming.md` — бывший §5 «Генераторы», общий блок ролей проекта); (4) `files` пакета включает тесты учебного модуля — на них ссылаются гайды; `bun pm pack` не поддерживает повторное включение после `!`, поэтому тесты платформы исключены по каталогам (`!src/{app,arch,domain,graph,kernel}/**/*.test.ts`, `!src/testing/*.test.ts`) — новый каталог в `src/` надо добавить в исключение; (5) кейс «гейтинг модулей курса» из `domain-modeling.md` §3 переписан на учебное назначение задачи (`assignTask` + `assigneeActive`).
- **Пересмотреть:** (1)–(2) — закрыты задачей `dmg-core init`/`sync` (роли и скил доставляет `bun run dmg:sync`, см. TR-29); (3) — задача «Генераторы в пакет»; остатки «legacy» в комментариях кода пакета (`kernel/fields`, `kernel/trace`, `app/uow/repository`, `domain/contracts/define-job|define-module`), сообщения ARC-10 в `platform/dmg-core/biome.json` и комментарий `biome-plugins/dom-17-snapshot-repo-only.grit` про `modules/wish` — задача «Сообщения `arch:check`…» или Ф6 (публикация).

### TR-29: два разборщика формата ролей — в пакете и в `agents:sync` проекта
- **Трек / фаза:** `dmg-core-extract`, Ф5 (CLI `dmg-core init`/`sync`)
- **Контекст:** формат ролей (`agents/README.md`) и перевод нейтральных инструментов в Claude Code / pi теперь живут в пакете (`dmg-core/cli`: `Role`), потому что цели `claude`/`pi` нужны любому потребителю. У проекта свой сборщик `scripts/agents-sync.ts` с той же логикой (`parseRole`, `renderRole`, `TOOLS`) — он дописывает проектный общий блок и собирает `migrator`.
- **Решение:** `agents:sync` пока сохраняет свой разборщик и только снимает метку пакета (`Marker.strip` из `dmg-core/cli`); корень монорепо зависит от `dmg-core` (`workspace:*`), чтобы вызывать `dmg-core` из `bun run dmg:sync|dmg:check`.
- **Пересмотреть:** перевести `agents-sync.ts` на `Role` из `dmg-core/cli` (или добавить в пакет цель с общим блоком проекта и убрать сборщик проекта) — при выносе пакета (Ф6) или раньше, если формат ролей изменится.
