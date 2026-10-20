# Policy — гайд

**Назначение:** права субъекта на действие над агрегатом (`<A>Policy = definePolicy({ rules })` из именованных `rule`). Файл — `packages/domain/src/<m>/<a>/<a>.policy.ts`. Место среди Ar / DCS / DQS — [domain-modeling.md](../domain-modeling.md) §1.

> **D-39/D-40 (после Ф5):** уникальность переезжает из DCS в декларативное доменное правило, геттер `WishAr.status` — в метод `alreadyExists()`; гайд обновится вместе с кодом (Ф6–7). Критерий ниже уже действует.

> Эталон — модуль `wish` после Ф5. UC ещё legacy-классы (до Ф8): правило вызывается вручную через `evaluate`, отказ поднимается мостом TR-1 ([debt.md](../debt.md) §6). С `defineUseCase` Policy подключается полем `policy` контракта.

---

## 1. Когда применять

Выбор по вопросу, на который отвечает правило:

| Вопрос | Где | Пример `wish` |
|---|---|---|
| «Может ли **этот субъект** это сделать?» | Policy, отказ `ACCESS_DENIED` (`kind: access`) | отменить желание может только автор — `canCancel` |
| «Каков агрегат сам по себе?» | метод-вопрос Ar | `WishAr.isActive()` |
| «Допустимо ли действие при состояниях агрегатов?» — без субъекта | доменное правило (D-40), отказ — своя ошибка `Result` | одно активное желание на (user, target) — сейчас `WishDcs.checkUnique` |

- Критерий — **участвует ли субъект**, а не число агрегатов (D-40): Policy может смотреть на несколько агрегатов. Правило зависит только от состояний, а не от субъекта, — это не Policy. Перенос уникальности в Policy сменил бы `conflict` + `status` на `access` и сломал бы ветвление бота (вопрос 7 брифа `wish`).
- Право, которое выполняется всегда, не заводи: у `create-*` желание всегда за вызывающего — с Ф8 Def UC создания ссылается на `allowAll` из `dmg-core` (legacy-UC сейчас без Policy).

## 2. Команда

`bun run gen aggregate <m>.<a> --write` создаёт `<a>.policy.ts` с пустыми `rules`. DCS — `bun run gen dcs <m> <имя> --write`. Без паспорта модуля (legacy) — вручную по шаблонам `scripts/gen/kinds/aggregate.ts` и `service.ts`.

## 3. Эталон

- [wish.policy.ts](../../../packages/domain/src/wish/wish/wish.policy.ts): `rule` `isAuthor` с `label`/`denyMessage`, контекст `WishCtx` — `ReadonlyAr<WishAr>`, правило спрашивает Ar (`isOwnedBy`), а не читает поля.
- [wish.policy.test.ts](../../../packages/domain/src/wish/wish/wish.policy.test.ts): автор — разрешено, чужой — отказ с `denyMessage`.
- [wish.dcs.ts](../../../packages/domain/src/wish/wish.dcs.ts) и [тест](../../../packages/domain/src/wish/wish.dcs.test.ts): уникальность — `Result` с `WISH_ALREADY_EXISTS` и статусом существующего.
- [wish.ar.ts](../../../packages/domain/src/wish/wish/wish.ar.ts): методы-вопросы `isActive`, `isOwnedBy`, `isFor`; активные статусы типизированы ключами `WishArDef.statuses`.
- [cancel-wish-uc.ts](../../../packages/wish/src/api/wish/cancel-wish-uc.ts): `canCancel.evaluate` → `CoreErrors.ACCESS_DENIED` через мост.
- Образец платформы: [task.policy.ts](../../../packages/dmg-core/src/testing/example/todo/task/task.policy.ts).

## 4. Чеклист правил

- DOM-05 — Policy из именованных `rule` с `label` и `denyMessage`; возвращает решение, не бросает.
- DOM-06 — мутация нескольких агрегатов — DCS; проверка без мутации — доменное правило, не Policy и не UC.
- DOM-02 — методы-вопросы Ar (`isActive`, `isOwnedBy`) не возвращают `Result`.
- DOM-04 — Ar отдаёт вопросы, а не геттер на поле; данные для ошибки — методом, строящим ошибку (геттер `status` уходит в Ф6–7, D-39).
- DOM-15 — в Policy только права субъекта.
- DOM-10 — правило названо по смыслу права (`canCancel`), а не по полю.
- API-01 — UC не решает: ни `if` по статусам, ни своя проверка уникальности.
- DOM-01 — DCS и Policy не импортируют `…state`: тип цели берётся из входа Ar (`CreateWish['target']`).

## 5. Типичные ловушки

- **Вопрос о статусе в «политике».** Legacy `WishPolicy.isActive(status)` — не право, а свойство агрегата: метод Ar.
- **Ограничение предметной области как право.** Уникальность — не `ACCESS_DENIED`: UI ветвится по `conflict` и `payload.status`.
- **«Последнее» вместо «всех».** DCS получает все желания пользователя на цель: при равных `createdAt` активное может быть не первым.
- **DCS верит выборке.** Сервис сам отбрасывает чужие желания и другие цели (`isOwnedBy`, `isFor`): неточная выборка вызывающего не даст ложного `conflict`.
- **Спекулятивное правило.** «Пользователь создаёт за себя» при `userId` из субъекта всегда истинно — `allowAll` в Def UC, а не правило.
- **Недостижимая ветка без теста.** Отказ `canCancel` через UC сейчас недостижим (желание ищется по актору), но ветка покрыта тестом UC.

## 6. Как тестировать

Каждое правило — разрешение и отказ (TST-02), проверяются `allowed` и `denyMessage`. DCS — нет желаний, активное каждого статуса, только неактивные; в отказе — `code` и `payload.status`; плюс тест UC на эту ошибку (TST-03). Ar — каждый метод-вопрос по всем статусам ([testing.md](../testing.md)).
