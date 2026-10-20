# State — гайд

**Назначение:** схема entity агрегата, то есть единственное место структуры его состояния: `packages/domain/src/<m>/<a>/<a>.state.ts`.

> Эталон — модуль `wish`. Пока не пройдена Фаза 2, он неполон: базовые поля и даты ещё не переведены на `BaseEntityFields` и `F.timestamp` (DEBT-24), а state импортируют Policy, репозиторий и команды (legacy, DOM-01). Форма базовых полей — в [task.state.ts](../../../packages/dmg-core/src/testing/example/todo/task/task.state.ts).

---

## 1. Когда применять

- Описываешь, из чего состоит агрегат: поля, статус, value object (VO).
- VO, который нужен только этому агрегату (у `wish` это `WishTarget`), лежит в том же файле. VO, общий для модуля, лежит в `<m>/shared/`, общий для школы — в `domain/src/shared/` ([naming.md](../naming.md) §2).
- Правила переходов и запреты сюда не пишутся: им место в Ar и Policy (гайды «aggregate» и «policy»).
- Для вывода UC схему не копируй: DTO выводится из state через `v.pick`/`v.omit` (DOM-11).

## 2. Команда

`bun run gen aggregate <m>.<a> --write` создаёт `<a>.state.ts` вместе со всеми артефактами агрегата: events, errors, Ar, Policy, repo. Заполни TODO полями и замени заглушку статуса `['active']`. Генератору нужен паспорт `<m>.module.ts`. Если модуль legacy и переводится по фазам, state пишется вручную по `stateSrc` из [aggregate.ts](../../../scripts/gen/kinds/aggregate.ts), как в эталоне.

## 3. Эталон

- [wish.state.ts](../../../packages/domain/src/wish/wish/wish.state.ts): `WishState`, `WishTarget` и `WishStatus`, у каждого одно имя и для схемы, и для типа. `target` — это `v.variant` по `kind`, описания стоят на всём `variant` и на `kind` каждой ветки.
- [wish.state.test.ts](../../../packages/domain/src/wish/wish/wish.state.test.ts): проверки «принимает / отклоняет» и проверка описаний у собственных полей.
- [state.ts](../../../packages/domain/src/wish/state.ts): подпуть `@u7-scl/domain/<m>/state`, только для рендереров UI.

## 4. Чеклист правил

- DOM-11 — базовые поля задаются только через `...BaseEntityFields`, остальные идентификаторы — через `F.uuid('<кого>')`. Свои `v.uuid()` запрещены.
- DOM-12 — даты задаются через `F.timestamp`. `v.isoDateTime`, `v.isoTimestamp`, `v.isoDate` и `v.isoTime` не используются.
- MAN-02 — `description` есть у каждого свойства, включая свойства внутри веток `variant`. Даёт его `F.*` или `v.description`.
- DOM-01 — state импортируют только Ar своего агрегата и UI, остальные идут через доменный API.
- CODE-01 — файл `<a>.state.ts`, схема `<A>State`, имена VO по [naming.md](../naming.md) §1.

## 5. Типичные ловушки

- **Чужая схема ради `uuid`.** `CourseSchema.entries.uuid` создаёт зависимость от state другого модуля. Правильно: `F.uuid('курса')`.
- **Свои тексты ошибок в полях.** Тексты валидации задаёт `F.*` единообразно, а сообщения пользователю — слой ошибок (`defineErrors`) и UI. DTO команд выводятся из state, поэтому свой текст из state попал бы во вход UC.
- **Сырые данные через экспортированную схему.** Репозиторий разбирает `<A>ArDef.state`: только в нём работает фолбэк `updatedAt = createdAt` для legacy-записей (D-36). Через `<A>State` такие записи не пройдут схему.

## 6. Как тестировать

Для каждого VO и статуса проверь через `v.safeParse`, что допустимое значение принимается, а недопустимое отклоняется. Тесты держи в пределах 10–20 строк ([testing.md](../testing.md), TST-04). Пока у агрегата нет Def, описания полей проверяет отдельный тест. Когда Def появится, это делает `arch:check` по `a.state`. Логику переходов тестируй в Ar, а не в state.
