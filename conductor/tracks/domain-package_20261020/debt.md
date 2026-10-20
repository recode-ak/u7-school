# Реестр долга: domain-package

Временные нарушения чистоты домена ([D-03](../../architecture/decisions.md)), допущенные ради механического переноса. Каждая запись — `D-<n>`; в коде помечена `// DEBT(D-<n>)`; в allowlist `scripts/domain-debt.ts` занесена тем же ID. Проверка `bun run arch:check` сверяет три источника (маркеры ↔ allowlist ↔ этот файл). Allowlist только уменьшается.

## Шаблон записи

```
### D-<n>: <краткое название>
- **Место:** <файл(ы) или маска>
- **Причина:** <почему нельзя убрать сейчас>
- **Погашает:** <трек>
- **Критерий снятия:** <что должно исчезнуть: маркер, allowlist, реэкспорт>
```

Закрытие записи = удаление маркера в коде, строки allowlist и записи здесь (проверяет arch:check).

## Группы

1. Импорты `@u7-scl/app` / `@u7-scl/core` в домене.
2. Реэкспорты старых путей `packages/<m>/src/domain/index.ts`.
3. `User` в `app`.
4. Прочее.

## 1. Импорты `app` / `core` в домене

### D-1: импорты `@u7-scl/core` в domain/user
- **Место:** `packages/domain/src/user/**` (`facade.ts`, `module.ts`, `user/a-root.ts`, `user/events.ts`, `user/commands/{errors,notify-user-cmd,register-guest-cmd}.ts`)
- **Причина:** `Aggregate`, `DomainEvent`, `NotifyKind`, `AccessDeniedError`, `isoNow` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/user/**` нет маркеров `DEBT(D-1)` и импортов `@u7-scl/core`

### D-2: импорт `@u7-scl/app/domain` в domain/user/module.ts
- **Место:** `packages/domain/src/user/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app`; создаёт циклическую зависимость пакетов `app` ↔ `domain` (только типы, в рантайме импорт стирается); сам цикл пакетов также снимается этим долгом.
- **Погашает:** `dmg-core-extract` / перевод `user` на Def
- **Критерий снятия:** маркер `DEBT(D-2)` удалён, `module.ts` не импортирует `@u7-scl/app`

### D-5: `v.isoDateTime` в `UserSchema` (DOM-12)
- **Место:** `packages/domain/src/user/user/entity.ts` (`createdAt`, `updatedAt`; `biome-ignore lint/plugin`)
- **Причина:** схема перенесена из `app` без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена.
- **Погашает:** перевод `user` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT(D-5)` и `biome-ignore` удалены, даты описаны через поля Def

### D-6: импорты `@u7-scl/core` в domain/course
- **Место:** `packages/domain/src/course/**` (`module.ts`, `*/a-root.ts`, `*/entity.ts`, `*/commands/errors.ts`, `content-path/commands/resolve-content-path-cmd.ts`; подпути `core/domain`, `core/shared`, `core/infra`)
- **Причина:** `Aggregate`, `FileMetadataSchema`, `AccessDeniedError`, `NotFoundError`, `isoNow`, `ApiModuleMeta`, `BaseJsonDb` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/course/**` нет маркеров `DEBT(D-6)` и импортов `@u7-scl/core`

### D-7: импорт `@u7-scl/app/domain` в domain/course/module.ts
- **Место:** `packages/domain/src/course/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. D-2).
- **Погашает:** `dmg-core-extract` / перевод `course` на Def
- **Критерий снятия:** маркер `DEBT(D-7)` удалён, `module.ts` не импортирует `@u7-scl/app`

### D-11: импорты `@u7-scl/core` в domain/questionnaire
- **Место:** `packages/domain/src/questionnaire/**` (`module.ts`, `questionnaire/{a-root,entity,events,questionnaire-factory}.ts`, `questionnaire/{likert,standard}/*-ar.ts`, `questionnaire/commands/errors.ts`; подпути `core/domain`, `core/shared`, `core/infra`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, ошибки, `isoNow`, `ApiModuleMeta`, `BaseJsonDb` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/questionnaire/**` нет маркеров `DEBT(D-11)` и импортов `@u7-scl/core`

### D-12: импорт `@u7-scl/app/domain` в domain/questionnaire/module.ts
- **Место:** `packages/domain/src/questionnaire/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. D-2).
- **Погашает:** `dmg-core-extract` / перевод `questionnaire` на Def
- **Критерий снятия:** маркер `DEBT(D-12)` удалён, `module.ts` не импортирует `@u7-scl/app`

### D-16: импорты `@u7-scl/core` в domain/stream
- **Место:** `packages/domain/src/stream/**` (`stream-ds.ts`, `{stream,student}/{a-root,entity,events}.ts`, `{stream,student}/commands/*-cmd.ts`; подпути `core/domain`, `core/shared`, `core/api`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, `errConflict`, `throwError`, `isoNow`, `now`, `UcMeta` живут в `core`; механический перенос не меняет базовые классы. `core/api` (`UcMeta`) — подпуть платформы, не входивший в долги user/course/questionnaire.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/stream/**` нет маркеров `DEBT(D-16)` и импортов `@u7-scl/core`

### D-17: импорты `@u7-scl/app/domain` в domain/stream
- **Место:** `packages/domain/src/stream/module.ts` (тип `U7ModuleResolver`), `stream/stream/a-root.ts` (константа `U7_SCHOOL_ID`)
- **Причина:** `U7ModuleResolver` и `U7_SCHOOL_ID` определены в `app` (см. D-2).
- **Погашает:** `dmg-core-extract` / перевод `stream` на Def
- **Критерий снятия:** маркер `DEBT(D-17)` удалён, перенесённые файлы не импортируют `@u7-scl/app`

### D-21: импорты `@u7-scl/core` в domain/wish
- **Место:** `packages/domain/src/wish/**` (`module.ts`, `wish/{a-root,entity,errors,events}.ts`; подпути `core/domain`, `core/shared`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, `ConflictError`, `NotFoundError`, `ApiModuleMeta`, `isoNow` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** `dmg-core-extract` (Ф4) и `golden-wish`
- **Критерий снятия:** в `packages/domain/src/wish/**` нет маркеров `DEBT(D-21)` и импортов `@u7-scl/core`

### D-22: импорт `@u7-scl/app/domain` в domain/wish/module.ts
- **Место:** `packages/domain/src/wish/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. D-2).
- **Погашает:** `dmg-core-extract` / `golden-wish`
- **Критерий снятия:** маркер `DEBT(D-22)` удалён, `module.ts` не импортирует `@u7-scl/app`

### D-25: импорты `@u7-scl/core` в domain/peer-review
- **Место:** `packages/domain/src/peer-review/**` (`review/{a-root,entity,errors,events}.ts`, `review-campaign/{a-root,entity,errors,events}.ts`, `*/commands/*-cmd.ts`, `errors.ts`; подпути `core/domain`, `core/shared`, `core/api`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, ошибки, `isoNow`, `UcMeta` живут в `core`; механический перенос не меняет базовые классы. `core/api` (`UcMeta`) — подпуть платформы.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/peer-review/**` нет маркеров `DEBT(D-25)` и импортов `@u7-scl/core`

### D-26: импорт `@u7-scl/app/domain` в domain/peer-review/module.ts
- **Место:** `packages/domain/src/peer-review/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. D-2).
- **Погашает:** `dmg-core-extract` / перевод `peer-review` на Def
- **Критерий снятия:** маркер `DEBT(D-26)` удалён, `module.ts` не импортирует `@u7-scl/app`

## 2. Реэкспорты старых путей

### D-3: barrel `packages/user/src/domain/index.ts`
- **Место:** `packages/user/src/domain/index.ts`
- **Причина:** потребители (≈96 файлов) импортируют `@u7-scl/user/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/user`; barrel удалён

### D-8: barrel `packages/course/src/domain/index.ts`
- **Место:** `packages/course/src/domain/index.ts`
- **Причина:** потребители импортируют `@u7-scl/course/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/course`; barrel удалён

### D-13: barrel `packages/questionnaire/src/domain/index.ts`
- **Место:** `packages/questionnaire/src/domain/index.ts`
- **Причина:** потребители импортируют `@u7-scl/questionnaire/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/questionnaire`; barrel удалён

### D-18: barrel `packages/stream/src/domain/index.ts`
- **Место:** `packages/stream/src/domain/index.ts`, `packages/stream/src/api/errors.ts` (ошибки перенесены в `domain/stream/errors.ts`, т.к. домен импортировал их из api)
- **Причина:** потребители импортируют `@u7-scl/stream/domain` и `../errors`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/stream`; barrel удалён

### D-23: barrel `packages/wish/src/domain/index.ts`
- **Место:** `packages/wish/src/domain/index.ts`
- **Причина:** потребители импортируют `@u7-scl/wish/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/wish`; barrel удалён

### D-27: barrel `packages/peer-review/src/domain/index.ts`
- **Место:** `packages/peer-review/src/domain/index.ts`, `packages/peer-review/src/api/errors.ts` (если ошибки перенесены в домен)
- **Причина:** потребители импортируют `@u7-scl/peer-review/domain` и `../errors`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/peer-review`; barrel удалён

## 3. `User` в `app`

### D-4: реэкспорт `User`/`Role` в app
- **Место:** `packages/app/src/domain/user.ts`
- **Причина:** `User`, `UserSchema`, `Role`, `RoleSchema`, `UserArMeta` импортируются из `@u7-scl/app/domain` во всём репозитории; канонический владелец теперь `domain/user`.
- **Погашает:** последний трек миграции
- **Критерий снятия:** потребители импортируют из `@u7-scl/domain/user`; `app/src/domain/user.ts` удалён

## 4. Прочее

### D-9: `v.isoDateTime` в схемах domain/course (DOM-12)
- **Место:** `packages/domain/src/course/{course,lesson,module,step}/entity.ts` (`createdAt`, `updatedAt`; `biome-ignore lint/plugin`)
- **Причина:** схемы перенесены без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что D-5 для user).
- **Погашает:** перевод `course` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT(D-9)` и `biome-ignore` удалены, даты описаны через поля Def

### D-10: приватный метод `#filterPublished` (CODE-02)
- **Место:** `packages/domain/src/course/module/a-root.ts` (`#filterPublished`; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `course` на Def (фильтрация — в Policy/DQS)
- **Критерий снятия:** маркер `DEBT(D-10)` и `biome-ignore` удалены, метод вынесен по правилам

### D-14: `v.isoDateTime` в схемах domain/questionnaire (DOM-12)
- **Место:** `packages/domain/src/questionnaire/questionnaire/{entity.ts,likert/likert-questionnaire.ts}` (`biome-ignore lint/plugin`)
- **Причина:** схемы перенесены без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что D-5, D-9).
- **Погашает:** перевод `questionnaire` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT(D-14)` и `biome-ignore` удалены, даты описаны через поля Def

### D-15: приватные члены `#…` в QuestionnaireAr (CODE-02)
- **Место:** `packages/domain/src/questionnaire/questionnaire/a-root.ts` (10 методов и поле `#engine`; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `questionnaire` на Def (логика — в Policy/DQS)
- **Критерий снятия:** маркеры `DEBT(D-15)` и `biome-ignore` удалены, методы вынесены по правилам

### D-19: `v.isoDateTime` в схемах domain/stream (DOM-12)
- **Место:** `packages/domain/src/stream/{stream,student}/entity.ts` (9 мест; `biome-ignore lint/plugin`)
- **Причина:** схемы перенесены без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что D-5, D-9, D-14).
- **Погашает:** перевод `stream` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT(D-19)` и `biome-ignore` удалены, даты описаны через поля Def

### D-20: приватные методы `#…` в StudentAr (CODE-02)
- **Место:** `packages/domain/src/stream/student/a-root.ts` (2 метода; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `stream` на Def (логика — в Policy/DQS)
- **Критерий снятия:** маркеры `DEBT(D-20)` и `biome-ignore` удалены, методы вынесены по правилам

### D-24: `v.isoDateTime` в схеме domain/wish (DOM-12)
- **Место:** `packages/domain/src/wish/wish/entity.ts` (`createdAt`, `updatedAt`; `biome-ignore lint/plugin`)
- **Причина:** схема перенесена без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что D-5, D-9, D-14, D-19).
- **Погашает:** `golden-wish` (перевод `wish` на Def, `F.timestamp`)
- **Критерий снятия:** маркеры `DEBT(D-24)` и `biome-ignore` удалены, даты описаны через поля Def

### D-28: `v.isoDateTime` в схеме domain/peer-review (DOM-12)
- **Место:** `packages/domain/src/peer-review/shared/schema.ts` (`isoMinuteField`; `biome-ignore lint/plugin`)
- **Причина:** схема перенесена без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что D-5, D-9, D-14, D-19, D-24).
- **Погашает:** перевод `peer-review` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT(D-28)` и `biome-ignore` удалены, даты описаны через поля Def

### D-29: приватный метод `#validateText` в ReviewAr (CODE-02)
- **Место:** `packages/domain/src/peer-review/review/a-root.ts` (`static #validateText`; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `peer-review` на Def (валидация текста — в Policy)
- **Критерий снятия:** маркер `DEBT(D-29)` и `biome-ignore` удалены, метод вынесен по правилам
