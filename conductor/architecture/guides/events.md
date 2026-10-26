# Events — гайд

**Назначение:** Def событий агрегата (`<A>Events = defineEvents('<m>.<a>', { … })`): имя, `label`, `description`, схема payload. Файл — `packages/domain/src/<m>/<a>/<a>.events.ts`.

> Эталон — модуль `wish` после Ф3–4. UoW (Ф6) и `ReactionFromDef` (Ф10) ещё нет: события публикует legacy-ER через мост (TR-4 в [debt.md](../debt.md) §6).

---

## 1. Когда применять

- Произошёл факт, на который реагирует другой модуль или UI: имя в прошедшем времени (`confirmed`, `invited`).
- Событие порождает переход Ar через `emit` — так событие и смена статуса не расходятся ([aggregate.md](./aggregate.md)).
- Если факт не меняет состояние, а решение принято по чужим фасадам (у `wish` — «пригласить на поток»), событие строит ER через `<A>Events.<e>.make`. Метод Ar ради одного события не заводи: переход растит `version` и требует записи.
- События чужих модулей, на которые ты реагируешь, описывает их контракт (D-37), а не твой модуль.

## 2. Команда

`bun run gen aggregate <m>.<a> --write` создаёт `<a>.events.ts` с пустой группой. Legacy-модуль без паспорта `<m>.module.ts` переводится вручную, как в эталоне ([state.md](./state.md) §2).

## 3. Эталон

- [wish.events.ts](../../../packages/domain/src/wish/wish/wish.events.ts): `confirmed` (из перехода) и `invited` (строит ER); payload через `F.*`, общие поля вынесены в константу, ветки по `targetKind` — `v.variant`.
- [wish.ar.ts](../../../packages/domain/src/wish/wish/wish.ar.ts): `confirm` порождает `confirmed` через `emit`.
- [wish.events.test.ts](../../../packages/domain/src/wish/wish/wish.events.test.ts): FQN, допустимый и недопустимый payload.
- Подписчик UI: [wish-invite.story.ts](../../../apps/u7-bot/src/controllers/courses/stories/wish-invite.story.ts) — имя `WishEvents.invited.name`, тип payload из схемы Def.
- Образец платформы: [task.events.ts](../../../packages/dmg-core/src/testing/example/todo/task/task.events.ts).

## 4. Чеклист правил

- MAN-01 — `label` и `description` у события.
- MAN-02 — `description` у каждого поля payload; поля — через `F.*` ([manifests.md](../manifests.md) §3).
- MAN-06 — у события есть публикующий (`emits` UC/ER). До Ф8/Ф10 в пробе `checkDefs` эталона MAN-06 отфильтрован.
- DOM-14 — `occurredAt` в домене не создаётся: момент приходит аргументом, конверт (`occurredAt`, `eventId`) строит UoW (до Ф10 — мост).
- ERR-07 — payload вне схемы на входе legacy-события не роняет операцию (`onInvalid`).

## 5. Типичные ловушки

- **Короткое имя вместо FQN.** Имя — `<m>.<a>.<e>` (`wish.wish.invited`). Подписчик берёт `<A>Events.<e>.name`, а не строку-литерал.
- **Интерфейс события рядом с Def.** Тип payload выводится из схемы (`v.InferOutput<typeof <A>Events.<e>.payload>`); ручной интерфейс разойдётся с Def.
- **Событие, собранное вручную после перехода.** Бери события Ar (`pullEvents()`), не строй тот же payload в ER.
- **Необязательные поля вместо веток.** Если набор полей зависит от вида (`courseId` у курса, `moduleId` у модуля), payload — `v.variant`, а не два `optional`.
- **Весь legacy-payload в контракт.** В Def — только поля, нужные подписчикам. `telegramId` у `invited` остался, потому что по нему UI отправляет карточку.

## 6. Как тестировать

Ar: событие в результате успешного перехода и отсутствие событий при отказе. Def: имя-FQN, разбор допустимого и отказ недопустимого payload (по ветке на `variant`). Публикация из ER — по имени и payload, без литерала полного конверта (TST-04, [testing.md](../testing.md)); полный конверт сверяет только тест самой функции, которая его строит.
