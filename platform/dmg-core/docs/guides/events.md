# Events — гайд

**Назначение:** Def событий агрегата (`<A>Events = defineEvents('<m>.<a>', { … })`): имя, `label`, `description`, схема payload. Файл — `<domain>/<m>/<a>/<a>.events.ts`.

---

## 1. Когда применять

- Произошёл факт, на который реагирует другой модуль или UI: имя в прошедшем времени (`completed`, `assigned`).
- Событие порождает агрегат через `emit` в `transition` или `change` — так событие и смена состояния не расходятся ([aggregate.md](./aggregate.md)). Факт без смены статуса (`assigned`) — тоже от агрегата, через `change`.
- Если факт не меняет состояние агрегата, а решение принято по ответам чужих модулей, событие строит ER через `<A>Events.<e>.make`. Метод Ar ради одного события не заводи: мутация растит `version` и требует записи.
- События чужих модулей, на которые ты реагируешь, описывает их контракт (D-37, D-45), а не твой модуль.

## 2. Команда

`dmg-core gen aggregate <m>.<a> --write` создаёт `<a>.events.ts` с пустой группой.

## 3. Образец

- [task.events.ts](../../src/testing/example/todo/task/task.events.ts): пять событий; общие поля payload вынесены в константу, поля — через `F.*`; `assigned`/`unassigned` — без смены статуса.
- [task.ar.ts](../../src/testing/example/todo/task/task.ar.ts): `complete` порождает `completed` через `emit` в `transition`; `assign` — `unassigned` прежнего и `assigned` нового в одной `change`.
- [task.events.test.ts](../../src/testing/example/todo/task/task.events.test.ts): FQN, допустимый и недопустимый payload.
- Подписчик из другого модуля: [release-removed-user-tasks.er.ts](../../src/testing/example/todo/task/er/release-removed-user-tasks.er.ts) — `on: [UserEvents.removed]` из контракта `users`.

## 4. Чеклист правил

- MAN-01 — `label` и `description` у события; описание — про факт, а не про причину.
- MAN-02 — `description` у каждого поля payload; поля — через `F.*` ([manifests.md](../manifests.md) §3).
- MAN-06 — у события есть публикующий (`emits` UC/ER/Job) или модуль внешний.
- MAN-08 — FQN `module.aggregate.event` своего модуля и агрегата.
- DOM-14 — `occurredAt` в домене не создаётся: конверт (`occurredAt`, `eventId`) строит UoW.

## 5. Типичные ловушки

- **Короткое имя вместо FQN.** Имя — `<m>.<a>.<e>` (`todo.task.assigned`). Подписчик берёт `<A>Events.<e>.name` или Def, а не строку-литерал.
- **Интерфейс события рядом с Def.** Тип payload выводится из схемы (`v.InferOutput<typeof <A>Events.<e>.payload>`); ручной интерфейс разойдётся с Def.
- **Событие, собранное вручную после перехода.** Бери события Ar (`pullEvents()`), не строй тот же payload в UC или ER.
- **Необязательные поля вместо веток.** Если набор полей зависит от вида, payload — `v.variant`, а не несколько `optional`.
- **Лишние данные в контракте.** В payload — только поля, нужные подписчикам: событие — часть контракта модуля, его меняют осторожно.

## 6. Как тестировать

Ar: событие в результате успешной операции и отсутствие событий при отказе и повторе. Def: имя-FQN, разбор допустимого и отказ недопустимого payload (по ветке на `variant`). Публикация из UC/ER — по имени и payload, без литерала полного конверта (TST-04, [testing.md](../testing.md)).
