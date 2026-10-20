# Aggregate — гайд

**Назначение:** Def агрегата (`<A>ArDef`: статусы, переходы, отказы) и класс Ar, который отвечает за правила и мутации одного агрегата: `packages/domain/src/<m>/<a>/<a>.ar.ts`.

> Эталон — модуль `wish` после Ф2. События и ошибки в нём пока минимальные (TR-1 в [debt.md](../debt.md) §6): `WishEvents` — пустая группа, `WishErrors` — только отказы переходов. Полные группы появятся в Ф3–4 (гайды «events» и «errors»).

---

## 1. Когда применять

- У сущности есть жизненный цикл (статусы и переходы) или инварианты, которые нужно держать в одном месте.
- Решение принимается по данным одного агрегата. Если нужно несколько агрегатов или чужой модуль, это DCS (DOM-06). Если вопрос «можно ли» зависит от субъекта, это Policy (DOM-05).
- Структура полей описана в state ([state.md](./state.md)), а Ar её не дублирует.

## 2. Команда

`bun run gen aggregate <m>.<a> --write` создаёт state, events, errors, Ar, Policy и repo. Заполни TODO в Def (`statuses`, `transitions` с `from`/`to`/`rejects`) и методы Ar. Без паспорта `<m>.module.ts` генератор не работает: legacy-модуль переводится вручную по шаблону из [aggregate.ts](../../../scripts/gen/kinds/aggregate.ts), как в эталоне.

## 3. Эталон

- [wish.ar.ts](../../../packages/domain/src/wish/wish/wish.ar.ts): `WishArDef` (6 статусов, 4 перехода, `rejects` для каждого статуса вне `from`), `WishAr` с приватным конструктором, `create`/`restore`/`snapshot`, переходы через `this.transition`.
- [wish.ar.test.ts](../../../packages/domain/src/wish/wish/wish.ar.test.ts): `checkDefs` по Def, `create`, `restore` legacy-записи, round trip `snapshot`, успех и каждый отказ перехода.
- [wish.errors.ts](../../../packages/domain/src/wish/wish/wish.errors.ts) и [wish.events.ts](../../../packages/domain/src/wish/wish/wish.events.ts): минимальные группы по TR-1.
- Образец платформы: [task.ar.ts](../../../packages/dmg-core/src/testing/example/todo/task/task.ar.ts).

## 4. Чеклист правил

- DOM-02 — переходы и `create` возвращают `Result`, предикаты `can*` возвращают `boolean`.
- DOM-03 — `create` (новый агрегат) и `restore` (из хранилища) разделены, Ar не создаёт другой Ar.
- DOM-04 — наружу идут идентификаторы и методы-вопросы, геттеров на каждое поле нет.
- DOM-14 — `uuid` и момент `at` приходят аргументами, статус меняет только `transition`.
- MAN-12 — у каждого перехода `rejects` покрывает все статусы вне `from` ошибками своей группы.
- MAN-01 — у Def есть `label` и `description`, у статусов есть `label`.
- ERR-01 — штатный отказ возвращается как `Err` и не бросается.
- CODE-02 — `private`, а не `#private`.

## 5. Типичные ловушки

- **Две фабрики на две ветки.** Если начальный статус выбирается по внешним данным (у `wish` по пулу анкеты), нужна одна `create` с полем `status: 'expressed' | 'pending'`. Ветку выбирает UC, потому что Ar пула не видит.
- **Свой список статусов в предикатах.** `can*` читают `from` из Def (`WishArDef.transitions[op].from`), иначе правила разойдутся. Предикаты нужны, пока ER спрашивают о переходе ради идемпотентности, а своего способа платформа не даёт.
- **`crypto.randomUUID()` и `Date.now()` в Ar.** В домене часов нет: `uuid` и `at` берёт прикладной слой (DOM-14, ARC-03).
- **`snapshot()` вне репозитория.** Снимок нужен только для записи. UC и UI спрашивают Ar или DQS (DOM-01). В legacy UC/ER `restore`/`snapshot` пока вызываются напрямую, это временно (TR-2).
- **`Result` в legacy-UC.** До Ф3–4 `err` перехода превращается в прежнее исключение через [legacy-reject.ts](../../../packages/wish/src/api/legacy-reject.ts) (TR-1). В новый код эту обёртку не переносить.

## 6. Как тестировать

На каждый переход нужны тест успеха (статус `to`, `updatedAt = at`, `version + 1`) и тест каждого отказа из `rejects` (TST-01). Для `create` проверь каждую ветку статуса, для `restore` — legacy-запись через `<A>ArDef.state` (фолбэк D-36), для `snapshot` — round trip. Описания и `rejects` проверяет `checkDefs` (до паспорта модуля — через пробный `defineModule`, как в эталоне). Тесты держи в пределах 10–20 строк ([testing.md](../testing.md), TST-04).
