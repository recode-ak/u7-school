# Модуль User

Модуль «User» (Пользователи) отвечает за учётные записи, роли и идентификацию
пользователей платформы U7. Модуль живёт на DMG: `UserModuleDef`
(`@u7-scl/domain/user/contract`) — 8 UC, агрегат `UserAr`, репозиторий сборки
`<dbDir>/users/users.json`.

## Ответственность

- Хранение профиля пользователя: `uuid`, имя, `telegramId`, роли.
- Ролевая модель (`GUEST`, `SUBSCRIBER`, `MENTOR`, `AUTHOR`, `ADMIN`) и права на
  её изменение.
- Профили для других модулей: чтение по `uuid`, списку `uuid`, `telegramId`;
  адреса Telegram для уведомлений.

## Как взаимодействовать

UC вызываются через корень сборки (`U7App`): в боте — контроллеры, руками —
скрипт `call-uc`:

```bash
bun run scripts/call-uc.ts list-users '{}'
bun run scripts/call-uc.ts getUser '{"uuid":"<uuid>"}'
```

Имя UC — Def-имя (`getUser`) или kebab-case (`get-user`). Субъект — резолвер
`Caller` приложения: в боте это `UserAr` из Telegram-профиля, в `call-uc` — Nur
по умолчанию. Чтения открыты гостю, команды изменения ролей — администратору.

## Доступные действия

### Чтения (гость и пользователь)

- **`getUser`** — профиль по `uuid`; нет пользователя — `USER_NOT_FOUND`.
- **`getUserByTelegramId`** — профиль по Telegram ID (вход бота для
  незарегистрированного гостя).
- **`getUsersByIds`** — пакет профилей по списку `uuid` (до 100).
- **`listUsers`** — список с фильтрами (`role`, `name`, `telegramId`) и
  сортировкой `field:dir`.
- **`getTelegramAddresses`** — адреса Telegram по списку пользователей; только
  система (адресация уведомлений).

### Команды (администратор)

- **`registerGuest`** — регистрация гостя; `telegramId` должен быть свободен
  (иначе `USER_TELEGRAM_ID_TAKEN`).
- **`addRoleToUser`** — выдача роли; повторная выдача ничего не меняет.
- **`removeRoleFromUser`** — снятие роли; последняя роль заменяется на `GUEST`.

## Ошибки

- `USER_NOT_FOUND` — нет пользователя (по `uuid` или `telegramId`).
- `USER_TELEGRAM_ID_TAKEN` — `telegramId` занят другим пользователем.
- `INPUT_VALIDATION_ERROR` — вход не прошёл схему UC.
- Отказ Policy (`canManageRoles` — роли, `canRegisterGuest` — регистрация) — «Недостаточно прав для выполнения действия».
