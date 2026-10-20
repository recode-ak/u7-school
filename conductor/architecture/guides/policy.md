# Policy — гайд

**Назначение:** права субъекта на действие над агрегатом (`<A>Policy = definePolicy({ rules })` из именованных `rule`) и соседний уровень — доменные правила без субъекта (`<A>Rules = defineRules({ rules })` из `domainRule`, D-40). Файлы — `packages/domain/src/<m>/<a>/<a>.policy.ts` и `<a>.rules.ts`. Место среди Ar / DCS / DQS — [domain-modeling.md](../domain-modeling.md) §1.

> Эталон — модуль `wish` после Ф6–7. UC ещё legacy-классы (до Ф8): Policy вызывается вручную через `evaluate`, доменное правило — через `check`, отказ поднимается мостом TR-1 ([debt.md](../debt.md) §6). С `defineUseCase` они подключаются полями `policy` и `rules` контракта: `UseCaseFromDef` исполняет `load → Policy → rules → execute`.

---

## 1. Когда применять

Выбор по вопросу, на который отвечает правило:

| Вопрос | Где | Пример `wish` |
|---|---|---|
| «Может ли **этот субъект** это сделать?» | Policy, отказ `ACCESS_DENIED` (`kind: access`) | отменить желание может только автор — `canCancel` |
| «Каков агрегат сам по себе?» | метод-вопрос Ar | `WishAr.isActive()` |
| «Допустимо ли действие при состояниях агрегатов?» — без субъекта | доменное правило (D-40), отказ — своя ошибка `Result` | одно активное желание на (user, target) — `WishRules.rules.unique` |
| Мутация нескольких агрегатов | DCS | — (в `wish` нет) |

- Критерий — **участвует ли субъект**, а не число агрегатов (D-40): Policy может смотреть на несколько агрегатов. Правило зависит только от состояний, а не от субъекта, — это не Policy. Перенос уникальности в Policy сменил бы `conflict` + `status` на `access` и сломал бы ветвление бота (вопрос 7 брифа `wish`).
- Право, которое выполняется всегда, не заводи: у `create-*` желание всегда за вызывающего — с Ф8 Def UC создания ссылается на `allowAll` из `dmg-core` (legacy-UC сейчас без Policy).

## 2. Команда

`bun run gen aggregate <m>.<a> --write` создаёт `<a>.policy.ts` с пустыми `rules`. Генератора `<a>.rules.ts` пока нет — вручную по эталону. Без паспорта модуля (legacy) — вручную по шаблонам `scripts/gen/kinds/aggregate.ts`.

## 3. Эталон

- [wish.policy.ts](../../../packages/domain/src/wish/wish/wish.policy.ts): `rule` `isAuthor` с `label`/`denyMessage`, контекст `WishCtx` — `ReadonlyAr<WishAr>`, правило спрашивает Ar (`isOwnedBy`), а не читает поля.
- [wish.policy.test.ts](../../../packages/domain/src/wish/wish/wish.policy.test.ts): автор — разрешено, чужой — отказ с `denyMessage`.
- [wish.rules.ts](../../../packages/domain/src/wish/wish/wish.rules.ts) и [тест](../../../packages/domain/src/wish/wish/wish.rules.test.ts): `domainRule` `unique` со ссылкой на `WISH_ALREADY_EXISTS`; ошибку со статусом существующего строит Ar — `alreadyExists()` (D-39), правило оборачивает её в `err`.
- [wish.ar.ts](../../../packages/domain/src/wish/wish/wish.ar.ts): методы-вопросы `isActive`, `isOwnedBy`, `isFor`; `alreadyExists()` возвращает `ErrorOf`, а не `Result` — иначе `ReadonlyAr` его вырежет; активные статусы типизированы ключами `WishArDef.statuses`.
- [cancel-wish-uc.ts](../../../packages/wish/src/api/wish/cancel-wish-uc.ts): `canCancel.evaluate` → `CoreErrors.ACCESS_DENIED` через мост.
- Образец платформы: [task.policy.ts](../../../packages/dmg-core/src/testing/example/todo/task/task.policy.ts), [task.rules.ts](../../../packages/dmg-core/src/testing/example/todo/task/task.rules.ts).

## 4. Чеклист правил

- DOM-05 — Policy из именованных `rule` с `label` и `denyMessage`; возвращает решение, не бросает.
- DOM-06 — мутация нескольких агрегатов — DCS; проверка без мутации — доменное правило, не Policy и не UC.
- DOM-02 — методы-вопросы Ar (`isActive`, `isOwnedBy`) не возвращают `Result`.
- DOM-04 — Ar отдаёт вопросы, а не геттер на поле; данные для ошибки — методом, строящим ошибку (`alreadyExists()`, D-39).
- DOM-15 — в Policy только права субъекта.
- DOM-16 — доменное правило: `name`, `label`, `description`, `error` своей группы; `check` возвращает `Result` только с этой ошибкой (тип); ошибка правила — в `errors` UC (ERR-02, `checkDefs`).
- DOM-10 — правило названо по смыслу права (`canCancel`), а не по полю.
- API-01 — UC не решает: ни `if` по статусам, ни своя проверка уникальности.
- DOM-01 — Policy и доменные правила не импортируют `…state`: тип цели берётся из входа Ar (`CreateWish['target']`).

## 5. Типичные ловушки

- **Вопрос о статусе в «политике».** Legacy `WishPolicy.isActive(status)` — не право, а свойство агрегата: метод Ar.
- **Ограничение предметной области как право.** Уникальность — не `ACCESS_DENIED`: UI ветвится по `conflict` и `payload.status`.
- **«Последнее» вместо «всех».** Правило получает все желания пользователя на цель: при равных `createdAt` активное может быть не первым.
- **Правило верит выборке.** Правило само отбрасывает чужие желания и другие цели (`isOwnedBy`, `isFor`): неточная выборка вызывающего не даст ложного `conflict`.
- **Спекулятивное правило.** «Пользователь создаёт за себя» при `userId` из субъекта всегда истинно — `allowAll` в Def UC, а не правило.
- **Проверка без мутации в DCS.** Уникальность ничего не меняет — это доменное правило; DCS — только когда меняются несколько агрегатов (DOM-06).
- **Геттер ради payload ошибки.** Ar не отдаёт `status` наружу, чтобы правило собрало ошибку: ошибку строит сам Ar.
- **Недостижимая ветка без теста.** Отказ `canCancel` через UC сейчас недостижим (желание ищется по актору), но ветка покрыта тестом UC.

## 6. Как тестировать

Каждое правило — разрешение и отказ (TST-02), проверяются `allowed` и `denyMessage`. Доменное правило — нет желаний, активное каждого статуса, только неактивные, чужие и на другую цель; в отказе — `code` и `payload.status`; плюс тест UC на эту ошибку (TST-03). Ar — каждый метод-вопрос по всем статусам ([testing.md](../testing.md)).
