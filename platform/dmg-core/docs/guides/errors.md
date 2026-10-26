# Errors — гайд

**Назначение:** Def ошибок агрегата (`<A>Errors = ErrorDef.define('<PREFIX>', { … })` — словарь `ErrorDef`): код, `kind`, `label`, `description`, схема payload. Файл — `<domain>/<m>/<a>/<a>.errors.ts`. Модель ошибки и `Result` — [errors-result.md](../errors-result.md).

---

## 1. Когда применять

- Штатный отказ операции агрегата или UC: переход из недопустимого статуса, дубль, «не найдено». Такой отказ — значение `Err`, а не `throw` (ERR-01).
- Ошибки переходов Ar (`rejects`), доменных правил и UC модуля живут в одной группе агрегата; UC ссылается на них.
- Ошибку зависимости бери по ссылке через её контракт (`UserErrors.NOT_FOUND` в `errors` UC `assignTask`). Свою заводи, только когда смысл другой: «исполнитель неактивен» (`TASK_ASSIGNEE_INACTIVE`) — не то же, что «пользователя нет».

## 2. Команда

`dmg-core gen aggregate <m>.<a> --write` создаёт `<a>.errors.ts` с пустой группой.

## 3. Образец

- [task.errors.ts](../../src/testing/example/todo/task/task.errors.ts): отказы переходов (`conflict`), `NOT_FOUND` (`not_found`), ошибки доменных правил (`TOO_MANY_OPEN`, `ASSIGNEE_INACTIVE`); payload через `F.*`.
- [task.errors.test.ts](../../src/testing/example/todo/task/task.errors.test.ts): коды с префиксом `TASK_`, `kind`, разбор payload, `make`.
- [assign-task.uc.ts](../../src/testing/example/todo/task/uc/assign-task.uc.ts): `errors` UC — свои ошибки и `UserErrors.NOT_FOUND` по ссылке (ERR-03).
- [user.errors.ts](../../src/testing/example/users/user/user.errors.ts): группа модуля-владельца, на которую ссылается зависимый модуль.

## 4. Чеклист правил

- ERR-01 — штатный отказ — `Err`; `throw` только для бага и сбоя.
- ERR-03 — ошибки зависимости — по ссылке через её контракт; своя ошибка — только при смене смысла.
- ERR-04 — коды UPPER_SNAKE с префиксом группы и уникальны в приложении. `checkDefs` сверяет только Def; коды кода вне Def он не видит.
- ERR-05 — ошибка не знает транспорт: нет HTTP-статусов и текстов UI.
- MAN-01 — `label` и `description` у ошибки; MAN-02 — `description` у каждого поля payload.
- MAN-12 — каждая ошибка из `rejects` перехода объявлена в группе своего агрегата.
- `kind` — по смыслу ([errors-result.md](../errors-result.md) §2): отказ перехода — `conflict`, отсутствие — `not_found`, невалидный вход — `validation`.

## 5. Типичные ловушки

- **Чужой код в своей группе.** `USER_NOT_FOUND` уже есть у `users` — коды уникальны в приложении. Нужна своя — префикс группы и своё описание смысла.
- **Два `optional` вместо веток.** «Ровно один из двух идентификаторов» — `v.union` двух `strictObject`, иначе схема не проверяет инвариант.
- **`payload | undefined`.** Payload объявленной ошибки обязателен по схеме: вызывающий ветвится по нему (`TASK_TOO_MANY_OPEN` несёт `limit`).
- **Текст экрана в `label`.** `label` — короткое имя отказа, `description` — когда он возникает (ERR-05); формулировки экрана — дело UI.
- **`err`/`make` как колбэк.** Def — экземпляр класса: `list.map(TaskErrors.NOT_FOUND.err)` теряет `this`. Передавай стрелку: `() => TaskErrors.NOT_FOUND.err()`.
- **Смена кода как смена поведения.** Перед переименованием кодов проверь, по чему ветвятся вызывающие: код — часть контракта модуля.

## 6. Как тестировать

Группа: префикс и `kind` каждого кода, разбор payload. Ar: каждый отказ из `rejects` — конкретный `code` (TST-01). UC: тест на каждую собственную ошибку по `code` и `kind`, а не по факту отказа ([errors-result.md](../errors-result.md) §4, [testing.md](../testing.md)).
