# Реестр долга

**Назначение:** учтённые временные нарушения целевой архитектуры ([D-03](./decisions.md), [migration.md](./migration.md)), допущенные ради поэтапного перехода. Живой реестр — не привязан к треку: долг заводят и гасят разные треки.

---

## Правила

- ID — `DEBT-<n>` (отдельно от решений `D-NN` в [decisions.md](./decisions.md)); номера не переиспользуются, новый — следующий после максимального, в т.ч. погашенного (последний выданный — DEBT-31).
- Место долга помечено в коде маркером `// DEBT-<n>` (для `biome-ignore` — в тексте причины).
- `bun run arch:check` сверяет маркеры в `packages/*/src` и `scripts/` с записями этого файла в обе стороны.
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
2. Реэкспорты старых путей `packages/<m>/src/domain/index.ts`.
3. `User` в `app`.
4. Прочее.
5. Инструменты проверки.
6. Тактические решения перехода (`TR-<n>`).

## 1. Импорты `app` / `core` в домене

### DEBT-1: импорты `@u7-scl/core` в domain/user
- **Место:** `packages/domain/src/user/**` (`facade.ts`, `module.ts`, `user/a-root.ts`, `user/events.ts`, `user/commands/{errors,notify-user-cmd,register-guest-cmd}.ts`)
- **Причина:** `Aggregate`, `DomainEvent`, `NotifyKind`, `AccessDeniedError`, `isoNow` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/user/**` нет маркеров `DEBT-1` и импортов `@u7-scl/core`

### DEBT-2: импорт `@u7-scl/app/domain` в domain/user/module.ts
- **Место:** `packages/domain/src/user/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app`; создаёт циклическую зависимость пакетов `app` ↔ `domain` (только типы, в рантайме импорт стирается); сам цикл пакетов также снимается этим долгом.
- **Погашает:** `dmg-core-extract` / перевод `user` на Def
- **Критерий снятия:** маркер `DEBT-2` удалён, `module.ts` не импортирует `@u7-scl/app`

### DEBT-5: `v.isoDateTime` в `UserSchema` (DOM-12)
- **Место:** `packages/domain/src/user/user/entity.ts` (`createdAt`, `updatedAt`; `biome-ignore lint/plugin`)
- **Причина:** схема перенесена из `app` без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена.
- **Погашает:** перевод `user` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-5` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-6: импорты `@u7-scl/core` в domain/course
- **Место:** `packages/domain/src/course/**` (`module.ts`, `*/a-root.ts`, `*/entity.ts`, `*/commands/errors.ts`, `content-path/commands/resolve-content-path-cmd.ts`; подпути `core/domain`, `core/shared`, `core/infra`)
- **Причина:** `Aggregate`, `FileMetadataSchema`, `AccessDeniedError`, `NotFoundError`, `isoNow`, `ApiModuleMeta`, `BaseJsonDb` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/course/**` нет маркеров `DEBT-6` и импортов `@u7-scl/core`

### DEBT-7: импорт `@u7-scl/app/domain` в domain/course/module.ts
- **Место:** `packages/domain/src/course/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. DEBT-2).
- **Погашает:** `dmg-core-extract` / перевод `course` на Def
- **Критерий снятия:** маркер `DEBT-7` удалён, `module.ts` не импортирует `@u7-scl/app`

### DEBT-11: импорты `@u7-scl/core` в domain/questionnaire
- **Место:** `packages/domain/src/questionnaire/**` (`module.ts`, `questionnaire/{a-root,entity,events,questionnaire-factory}.ts`, `questionnaire/{likert,standard}/*-ar.ts`, `questionnaire/commands/errors.ts`; подпути `core/domain`, `core/shared`, `core/infra`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, ошибки, `isoNow`, `ApiModuleMeta`, `BaseJsonDb` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/questionnaire/**` нет маркеров `DEBT-11` и импортов `@u7-scl/core`

### DEBT-12: импорт `@u7-scl/app/domain` в domain/questionnaire/module.ts
- **Место:** `packages/domain/src/questionnaire/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. DEBT-2).
- **Погашает:** `dmg-core-extract` / перевод `questionnaire` на Def
- **Критерий снятия:** маркер `DEBT-12` удалён, `module.ts` не импортирует `@u7-scl/app`

### DEBT-16: импорты `@u7-scl/core` в domain/stream
- **Место:** `packages/domain/src/stream/**` (`stream-ds.ts`, `{stream,student}/{a-root,entity,events}.ts`, `{stream,student}/commands/*-cmd.ts`; подпути `core/domain`, `core/shared`, `core/api`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, `errConflict`, `throwError`, `isoNow`, `now`, `UcMeta` живут в `core`; механический перенос не меняет базовые классы. `core/api` (`UcMeta`) — подпуть платформы, не входивший в долги user/course/questionnaire.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/stream/**` нет маркеров `DEBT-16` и импортов `@u7-scl/core`

### DEBT-17: импорты `@u7-scl/app/domain` в domain/stream
- **Место:** `packages/domain/src/stream/module.ts` (тип `U7ModuleResolver`), `stream/stream/a-root.ts` (константа `U7_SCHOOL_ID`)
- **Причина:** `U7ModuleResolver` и `U7_SCHOOL_ID` определены в `app` (см. DEBT-2).
- **Погашает:** `dmg-core-extract` / перевод `stream` на Def
- **Критерий снятия:** маркер `DEBT-17` удалён, перенесённые файлы не импортируют `@u7-scl/app`

### DEBT-21: импорты `@u7-scl/core` в domain/wish
- **Место:** `packages/domain/src/wish/**` (`module.ts`, `wish/{a-root,errors,events}.ts`; подпути `core/domain`, `core/shared`; `WishArMeta` — в `a-root.ts`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, `ConflictError`, `NotFoundError`, `ApiModuleMeta`, `isoNow` живут в `core`; механический перенос не меняет базовые классы.
- **Погашает:** `dmg-core-extract` (Ф4) и `golden-wish`
- **Критерий снятия:** в `packages/domain/src/wish/**` нет маркеров `DEBT-21` и импортов `@u7-scl/core`

### DEBT-22: импорт `@u7-scl/app/domain` в domain/wish/module.ts
- **Место:** `packages/domain/src/wish/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. DEBT-2).
- **Погашает:** `dmg-core-extract` / `golden-wish`
- **Критерий снятия:** маркер `DEBT-22` удалён, `module.ts` не импортирует `@u7-scl/app`

### DEBT-25: импорты `@u7-scl/core` в domain/peer-review
- **Место:** `packages/domain/src/peer-review/**` (`review/{a-root,entity,errors,events}.ts`, `review-campaign/{a-root,entity,errors,events}.ts`, `*/commands/*-cmd.ts`, `errors.ts`; подпути `core/domain`, `core/shared`, `core/api`)
- **Причина:** `Aggregate`, `ArMeta`, `DomainEvent`, ошибки, `isoNow`, `UcMeta` живут в `core`; механический перенос не меняет базовые классы. `core/api` (`UcMeta`) — подпуть платформы.
- **Погашает:** `dmg-core-extract` (Ф4) и последующие треки перевода на Def
- **Критерий снятия:** в `packages/domain/src/peer-review/**` нет маркеров `DEBT-25` и импортов `@u7-scl/core`

### DEBT-26: импорт `@u7-scl/app/domain` в domain/peer-review/module.ts
- **Место:** `packages/domain/src/peer-review/module.ts` (тип `U7ModuleResolver`)
- **Причина:** тип резолвера модулей определён в `app` (см. DEBT-2).
- **Погашает:** `dmg-core-extract` / перевод `peer-review` на Def
- **Критерий снятия:** маркер `DEBT-26` удалён, `module.ts` не импортирует `@u7-scl/app`

## 2. Реэкспорты старых путей

### DEBT-3: barrel `packages/user/src/domain/index.ts`
- **Место:** `packages/user/src/domain/index.ts`
- **Причина:** потребители (≈96 файлов) импортируют `@u7-scl/user/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/user`; barrel удалён

### DEBT-8: barrel `packages/course/src/domain/index.ts`
- **Место:** `packages/course/src/domain/index.ts`
- **Причина:** потребители импортируют `@u7-scl/course/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/course`; barrel удалён

### DEBT-13: barrel `packages/questionnaire/src/domain/index.ts`
- **Место:** `packages/questionnaire/src/domain/index.ts`
- **Причина:** потребители импортируют `@u7-scl/questionnaire/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/questionnaire`; barrel удалён

### DEBT-18: barrel `packages/stream/src/domain/index.ts`
- **Место:** `packages/stream/src/domain/index.ts`, `packages/stream/src/api/errors.ts` (ошибки перенесены в `domain/stream/errors.ts`, т.к. домен импортировал их из api)
- **Причина:** потребители импортируют `@u7-scl/stream/domain` и `../errors`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/stream`; barrel удалён

### DEBT-23: barrel `packages/wish/src/domain/index.ts`
- **Место:** `packages/wish/src/domain/index.ts`
- **Причина:** потребители импортируют `@u7-scl/wish/domain`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/wish`; barrel удалён

### DEBT-27: barrel `packages/peer-review/src/domain/index.ts`
- **Место:** `packages/peer-review/src/domain/index.ts`, `packages/peer-review/src/api/errors.ts` (если ошибки перенесены в домен)
- **Причина:** потребители импортируют `@u7-scl/peer-review/domain` и `../errors`; переписывать их не входит в трек.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** потребители импортируют `@u7-scl/domain/peer-review`; barrel удалён

## 3. `User` в `app`

### DEBT-4: реэкспорт `User`/`Role` в app
- **Место:** `packages/app/src/domain/user.ts`
- **Причина:** `User`, `UserSchema`, `Role`, `RoleSchema`, `UserArMeta` импортируются из `@u7-scl/app/domain` во всём репозитории; канонический владелец теперь `domain/user`.
- **Погашает:** последний трек миграции
- **Критерий снятия:** потребители импортируют из `@u7-scl/domain/user`; `app/src/domain/user.ts` удалён

## 4. Прочее

### DEBT-9: `v.isoDateTime` в схемах domain/course (DOM-12)
- **Место:** `packages/domain/src/course/{course,lesson,module,step}/entity.ts` (`createdAt`, `updatedAt`; `biome-ignore lint/plugin`)
- **Причина:** схемы перенесены без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что DEBT-5 для user).
- **Погашает:** перевод `course` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-9` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-10: приватный метод `#filterPublished` (CODE-02)
- **Место:** `packages/domain/src/course/module/a-root.ts` (`#filterPublished`; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `course` на Def (фильтрация — в Policy/DQS)
- **Критерий снятия:** маркер `DEBT-10` и `biome-ignore` удалены, метод вынесен по правилам

### DEBT-14: `v.isoDateTime` в схемах domain/questionnaire (DOM-12)
- **Место:** `packages/domain/src/questionnaire/questionnaire/{entity.ts,likert/likert-questionnaire.ts}` (`biome-ignore lint/plugin`)
- **Причина:** схемы перенесены без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что DEBT-5, DEBT-9).
- **Погашает:** перевод `questionnaire` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-14` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-15: приватные члены `#…` в QuestionnaireAr (CODE-02)
- **Место:** `packages/domain/src/questionnaire/questionnaire/a-root.ts` (10 методов и поле `#engine`; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `questionnaire` на Def (логика — в Policy/DQS)
- **Критерий снятия:** маркеры `DEBT-15` и `biome-ignore` удалены, методы вынесены по правилам

### DEBT-19: `v.isoDateTime` в схемах domain/stream (DOM-12)
- **Место:** `packages/domain/src/stream/{stream,student}/entity.ts` (9 мест; `biome-ignore lint/plugin`)
- **Причина:** схемы перенесены без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что DEBT-5, DEBT-9, DEBT-14).
- **Погашает:** перевод `stream` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-19` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-20: приватные методы `#…` в StudentAr (CODE-02)
- **Место:** `packages/domain/src/stream/student/a-root.ts` (2 метода; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `stream` на Def (логика — в Policy/DQS)
- **Критерий снятия:** маркеры `DEBT-20` и `biome-ignore` удалены, методы вынесены по правилам

### DEBT-24: базовые поля и `v.isoDateTime` в схеме domain/wish (DOM-11, DOM-12)
- **Место:** `packages/domain/src/wish/wish/wish.state.ts` (`uuid`, `createdAt`, `updatedAt`; `biome-ignore lint/plugin`)
- **Причина:** схема перенесена без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что DEBT-5, DEBT-9, DEBT-14, DEBT-19); DOM-11 — базовые поля только через `BaseEntityFields`. Переход на `BaseEntityFields` и `F.timestamp` — Ф2 golden-wish (вместе с `WishArDef`: фолбэк `updatedAt` и числовые даты требуют Ar на `dmg-core`).
- **Погашает:** `golden-wish` (перевод `wish` на Def, `F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-24` и `biome-ignore` удалены, базовые поля — `...BaseEntityFields`, даты описаны через поля Def

### DEBT-28: `v.isoDateTime` в схеме domain/peer-review (DOM-12)
- **Место:** `packages/domain/src/peer-review/shared/schema.ts` (`isoMinuteField`; `biome-ignore lint/plugin`)
- **Причина:** схема перенесена без изменений; DOM-12 запрещает `v.isoDateTime` в схемах домена (то же, что DEBT-5, DEBT-9, DEBT-14, DEBT-19, DEBT-24).
- **Погашает:** перевод `peer-review` на Def (`F.timestamp`)
- **Критерий снятия:** маркеры `DEBT-28` и `biome-ignore` удалены, даты описаны через поля Def

### DEBT-29: приватный метод `#validateText` в ReviewAr (CODE-02)
- **Место:** `packages/domain/src/peer-review/review/a-root.ts` (`static #validateText`; `biome-ignore lint/plugin`)
- **Причина:** перенос без изменения кода; CODE-02 запрещает приватные члены в Ar.
- **Погашает:** перевод `peer-review` на Def (валидация текста — в Policy)
- **Критерий снятия:** маркер `DEBT-29` и `biome-ignore` удалены, метод вынесен по правилам

### DEBT-30: barrel `packages/dossier/src/index.ts`
- **Место:** `packages/dossier/src/index.ts`
- **Причина:** пакет `@u7-scl/dossier` публикует корень `.`; потребителей в коде нет, но публичный путь сохранён на время миграции.
- **Погашает:** последний трек миграции (критерий завершения §5 `migration.md`)
- **Критерий снятия:** пакет `@u7-scl/dossier` удалён; код живёт в `@u7-scl/domain/dossier`

## 5. Инструменты проверки

### DEBT-31: граф `dependsOn` домена задан вручную
- **Место:** `scripts/domain-debt.ts` (`DOMAIN_GRAPH`)
- **Причина:** у модулей домена ещё нет `defineModule`; граф для ARC-04/05 продублирован руками и может разойтись с `dependsOn` (D-01).
- **Погашает:** `golden-wish` (Ф12: `WishModuleDef`, контрактные `ModuleDef` зависимостей) — после этого граф строится из `ModuleDef`
- **Критерий снятия:** `DOMAIN_GRAPH` удалён, `arch:check` берёт граф из Def модулей

## 6. Тактические решения перехода (TR)

Решения, которые orchestrator принял сам в автономном режиме ([agents.md](./agents.md) §9). На ревизии по ним видно, что сделано временно ради перехода, а что задумано. Номера не переиспользуются. Шаблон:

```
### TR-<n>: <краткое решение>
- **Трек / фаза:** <где принято>
- **Контекст:** <что мешало, какие были варианты>
- **Решение:** <что сделано>
- **Пересмотреть:** <что проверить на ревизии; DEBT-<n>, если есть временный код>
```
