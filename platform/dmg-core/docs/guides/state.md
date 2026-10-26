# State — гайд

**Назначение:** схема entity агрегата — единственное место структуры его состояния: `<domain>/<m>/<a>/<a>.state.ts`.

---

## 1. Когда применять

- Описываешь, из чего состоит агрегат: поля, статус, value object (VO).
- VO, который нужен только этому агрегату (у задачи — `TaskAssignmentVo`), лежит в том же файле. VO, общий для модуля, — в `<m>/shared/`, общий для приложения — в `<domain>/shared/` ([naming.md](../naming.md) §2).
- Правила переходов и запреты сюда не пишутся: им место в Ar и Policy ([aggregate.md](./aggregate.md), [policy.md](./policy.md)).
- Для вывода UC схему не копируй: DTO выводится из state через `v.pick`/`v.omit` (DOM-11).

## 2. Команда

`dmg-core gen aggregate <m>.<a> --write` создаёт `<a>.state.ts` вместе со всеми артефактами агрегата: events, errors, Ar, Policy, repo. Заполни TODO полями и замени заглушку статуса. Генератору нужен паспорт `<m>.module.ts` ([module.md](./module.md)).

## 3. Образец

- [task.state.ts](../../src/testing/example/todo/task/task.state.ts): `TaskState`, `TaskStatus` и `TaskAssignmentVo` — у каждого одно имя и для схемы, и для типа; необязательные поля (`completedAt`, `assignment`) — `v.optional` с описанием.
- [task.state.test.ts](../../src/testing/example/todo/task/task.state.test.ts): «принимает / отклоняет» для VO и статуса, разбор ISO-дат (в т. ч. без зоны) в числа, описания у всех полей.
- [state.ts](../../src/testing/example/todo/state.ts): реэкспорт схем state для своего прикладного слоя (репозиторий, выход query). Наружу модуля state не выходит: остальной код получает форму данных из контракта (D-45).

## 4. Чеклист правил

- DOM-11 — базовые поля только через `...BaseEntityFields`, остальные идентификаторы — `F.uuid('<кого>')`. Свои `v.uuid()` запрещены.
- DOM-12 — даты через `F.timestamp`. `v.isoDateTime`, `v.isoTimestamp`, `v.isoDate` и `v.isoTime` не используются.
- MAN-02 — `description` у каждого свойства, включая ветки `variant` и `v.optional`. Даёт его `F.*` или `v.description`.
- DOM-01 — state импортируют только Ar своего агрегата, Def контрактов своего модуля и репозиторий; остальные идут через доменный API.
- DOM-13 — у VO нет `createdAt`/`updatedAt` и идентичности.
- CODE-01 — файл `<a>.state.ts`, схема `<A>State`, имена VO по [naming.md](../naming.md) §1.

## 5. Типичные ловушки

- **Чужая схема ради `uuid`.** `UserState.entries.uuid` создаёт зависимость от state другого модуля. Правильно: `F.uuid('исполнителя')`.
- **Свои тексты ошибок в полях.** Тексты валидации задаёт `F.*` единообразно, а сообщения пользователю — слой ошибок (`ErrorDef.define`) и UI. DTO команд выводятся из state, поэтому свой текст из state попал бы во вход UC.
- **Сырые данные через экспортированную схему.** Репозиторий разбирает `<A>ArDef.state`: только в нём работает фолбэк `updatedAt = createdAt` для старых записей (D-36). Через `<A>State` такие записи не пройдут схему.
- **Два `optional` вместо ветки.** Если набор полей зависит от вида, это `v.variant` по полю-дискриминатору, а не несколько `optional`: схема должна проверять инвариант.

## 6. Как тестировать

Для каждого VO и статуса проверь через `v.safeParse`, что допустимое значение принимается, а недопустимое отклоняется. Тесты — 10–20 строк ([testing.md](../testing.md), TST-04). Описания полей проверяет `checkDefs` по паспорту модуля ([todo.module.test.ts](../../src/testing/example/todo/todo.module.test.ts)). Фолбэк `updatedAt` проверяй разбором через `<A>ArDef.state`, а не `<A>State`. Логику переходов тестируй в Ar, а не в state.
