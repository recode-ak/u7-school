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
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные методы в Ar.
- **Погашает:** перевод `course` на Def (фильтрация — в Policy/DQS)
- **Критерий снятия:** маркер `DEBT(D-10)` и `biome-ignore` удалены, метод вынесен по правилам
