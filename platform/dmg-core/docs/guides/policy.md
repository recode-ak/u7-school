# Policy — гайд

**Назначение:** права субъекта на действие над агрегатом (`<A>Policy = PolicyDef.define({ rules })` из правил `Rule`) и соседний уровень — доменные правила без субъекта (`<A>Rules = RulesDef.define({ rules })` из `DomainRuleDef.define`, D-40). Файлы — `<domain>/<m>/<a>/<a>.policy.ts` и `<a>.rules.ts`. Место среди Ar / DCS / DQS — [domain-modeling.md](../domain-modeling.md) §1.

---

## 1. Когда применять

Выбор по вопросу, на который отвечает правило:

| Вопрос | Где | Пример `todo` |
|---|---|---|
| «Может ли **этот субъект** это сделать?» | Policy, отказ `ACCESS_DENIED` (`kind: access`) | выполнить и назначить задачу может владелец или администратор — `canManage` |
| «Каков агрегат сам по себе?» | метод-вопрос Ar | `TaskAr.isOpen()`, `isAssignedTo(userId)` |
| «Допустимо ли действие при состояниях агрегатов?» — без субъекта | доменное правило (D-40), отказ — своя ошибка в `Result` | не больше трёх открытых задач — `withinOpenLimit`; исполнитель активен — `assigneeActive` (над ответом `users`) |
| Мутация нескольких агрегатов | DCS ([repo.md](./repo.md)) | освобождение задач удалённого пользователя — `TaskReleaseDcs` |

- Критерий — **участвует ли субъект**, а не число агрегатов (D-40): Policy может смотреть на несколько агрегатов. Ответ зависит только от состояний — это не Policy.
- Право, которое выполняется всегда, не заводи: «создаю задачу за себя» при `ownerId` из субъекта — `allowAll` в Def UC.
- Подключение — полями `policy` и `rules` Def UC: `UseCaseFromDef` исполняет `load → Policy → rules → execute` ([use-case.md](./use-case.md)).

## 2. Правила `Rule`

Правило — экземпляр наследника абстрактного `Rule`; вид правила знает, как себя вычислить (`evaluate(subject, ctx)`) и сериализовать для графа (`normalize()`).

| Фабрика | Вид | Отказ |
|---|---|---|
| `Rule.of({ name, label, denyMessage, check })` | `NamedRule` | своё `name`/`denyMessage`; без субъекта — отказ, `check` не вызывается |
| `Rule.hasRole(role)` | `NamedRule` | `hasRole:<role>`, «Нужна роль …» |
| `Rule.allOf(...rules)` | `AllOfRule` | первое не прошедшее правило |
| `Rule.anyOf({ name, label, denyMessage }, ...rules)` | `AnyOfRule` | своё `name`/`denyMessage` |
| `allowAll` (константа) | `AllowAll` | нет; пропускает и без субъекта |

- Субъект и контекст композиции — пересечения субъектов и контекстов вложенных правил (тип).
- В графе `policy` UC — дерево `normalize()`: PO видит `label` и `denyMessage` каждого правила. Поля `description` у правила нет: смысл права несёт `label`, причину отказа — `denyMessage`; описание — у `PolicyDef`.

## 3. Команда

`dmg-core gen aggregate <m>.<a> --write` создаёт `<a>.policy.ts` с пустыми `rules`. `<a>.rules.ts` — вручную по образцу.

## 4. Образец

- [task.policy.ts](../../src/testing/example/todo/task/task.policy.ts): `Rule.of` `isOwner` с `label`/`denyMessage`, композиция `canManage` (`Rule.anyOf` с `Rule.hasRole`); контекст — `ReadonlyAr<TaskAr>`, правило спрашивает Ar (`isOwnedBy`), а не читает поля.
- [task.policy.test.ts](../../src/testing/example/todo/task/task.policy.test.ts): владелец и администратор — разрешено, чужой — отказ с `denyMessage`.
- [task.rules.ts](../../src/testing/example/todo/task/task.rules.ts) и [тест](../../src/testing/example/todo/task/task.rules.test.ts): `withinOpenLimit` над задачами владельца (порог — экспортируемая константа `OPEN_TASKS_LIMIT`) и `assigneeActive` над ответом чужого модуля (`UserActivity` из контракта `users`).

## 5. Чеклист правил

- DOM-05 — Policy из именованных правил (`Rule.of`) с `label` и `denyMessage`; возвращает решение, не бросает.
- DOM-15 — в Policy только права субъекта.
- DOM-16 — доменное правило: `name`, `label`, `description`, `error` своей группы; `check` возвращает `Result` только с этой ошибкой (тип); ошибка правила — в `errors` UC (ERR-02, `ArchChecker`).
- DOM-06 — мутация нескольких агрегатов — DCS; проверка без мутации — доменное правило, не Policy и не UC.
- DOM-02, DOM-04 — методы-вопросы Ar не возвращают `Result`; Ar отдаёт вопросы, а не геттер на поле; данные для ошибки — методом, строящим ошибку (D-39).
- DOM-10 — правило названо по смыслу права (`canManage`), а не по полю.
- DOM-01 — Policy и доменные правила не импортируют `…state`: контекст — `ReadonlyAr` и ответы из контрактов.
- API-01 — UC не решает: ни `if` по статусам, ни своя проверка предела.

## 6. Типичные ловушки

- **Вопрос о статусе в «политике».** «Задача открыта» — не право, а свойство агрегата: метод Ar.
- **Ограничение предметной области как право.** Предел открытых задач — не `ACCESS_DENIED`: вызывающий ветвится по `conflict` и `payload.limit`.
- **Правило верит выборке.** Правило само спрашивает каждый агрегат (`isOpen`): неточная выборка вызывающего не даст ложного отказа.
- **Чужой модуль в Policy.** Ответ `users` об активности — контекст доменного правила, а не Policy: Policy отвечает только за субъекта.
- **Спекулятивное правило.** Правило, которое всегда истинно, — `allowAll` в Def UC, а не `Rule.of`.
- **Геттер ради payload ошибки.** Ar не отдаёт поле наружу, чтобы правило собрало ошибку: ошибку строит сам Ar.

## 7. Как тестировать

Каждое правило Policy — разрешение и отказ (TST-02), проверяются `allowed` и `denyMessage`. Доменное правило — граница порога (под пределом, на пределе), неоткрытые задачи не считаются; в отказе — `code` и payload; плюс тест UC на эту ошибку (TST-03). Ar — каждый метод-вопрос по всем статусам ([testing.md](../testing.md)).
