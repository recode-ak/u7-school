# Facade — гайд

**Назначение:** runtime-API модуля для других модулей — контракт `<M>FacadeDef = defineFacade(...)` (`packages/domain/src/<m>/<m>.facade.ts`) и in-proc реализация `implementFacade` (`packages/<m>/src/<m>.facade.ts`). Заводится **только по потребителю** (D-38).

> У `wish` фасада нет: другим модулям он не нужен, UI ходит через `appApi`. Эталон формы — учебный модуль `todo` платформы.

---

## 1. Когда применять

- Есть потребитель: UC/ER/Job **другого** модуля, у которого этот модуль в `dependsOn`, вызывает его по `calls` (ARC-04, API-04). Нет такого потребителя — фасада нет.
- UI и внешние адаптеры фасад не используют: они вызывают UC через `appApi` (ARC-08).
- Модуль не выставляет «на вырост» чтение всех агрегатов: метод появляется вместе с первым вызывающим и описывает его вопрос («задача по id»), а не таблицу.
- Изменение состояния другого модуля — не через фасад-«сеттер», а событием и его ER ([events.md](./events.md)).

## 2. Команда

`bun run gen module <m> --facade --write` создаёт `<m>.facade.ts` в домене и в пакете и подключает их к паспорту и карте модуля. Без `--facade` фасада нет нигде; добавить позже — те же два файла вручную по шаблону `scripts/gen/kinds/module.ts` и `app-module.ts`, поле `facade` в `defineModule` и в карте `ModuleFromDef`.

## 3. Эталон

- [todo.facade.ts (контракт)](../../../packages/dmg-core/src/testing/example/todo/todo.facade.ts): `method<[args], Ret>()({ label, description, errors })`; возврат — `ReadonlyAr`, ошибки — ссылками на `ErrorDef` своей группы.
- [todo.facade.ts (реализация)](../../../packages/dmg-core/src/testing/example/app/todo/todo.facade.ts): `implementFacade(TodoFacadeDef, { … })` над репозиторием из `deps`; отсутствие — `err` заявленной ошибки, а не `undefined`.
- [todo.module.ts (паспорт)](../../../packages/dmg-core/src/testing/example/todo/todo.module.ts) — поле `facade`; [todo.module.ts (карта)](../../../packages/dmg-core/src/testing/example/app/todo/todo.module.ts) — `facade: todoFacade`.
- [wish.module.ts](../../../packages/domain/src/wish/module.ts) — модуль без фасада (до Ф12 — legacy-мета).

## 4. Чеклист правил

- API-04 — межмодульно только фасады; метод возвращает `Result` и `ReadonlyAr`, не state и не изменяемый Ar.
- ARC-04 — потребитель импортирует контракт через `index.ts` модуля и только по `dependsOn`.
- ERR-02 — фасад возвращает только ошибки из `errors` метода и базовые.
- ERR-03 — потребитель не переводит ошибки фасада без смены смысла.
- MAN-01 — у фасада и каждого метода `label` и `description`.
- MAN-05 — ER вызывает только фасады из своих `calls`.

## 5. Типичные ловушки

- **Фасад «на будущее».** Пустой или спекулятивный фасад — лишний контракт, который придётся сопровождать; `gen module` без `--facade` его не создаёт.
- **Фасад для UI.** UI — через `appApi` и UC с `callers`, а не через фасад.
- **Legacy-фасады зависимостей.** `CourseFacade` и др. возвращают `boolean`/`undefined` без `Result` — это не `defineFacade`; переводятся в треках своих модулей (бриф `wish`, вопрос 5).
- **State наружу.** Метод отдаёт `ReadonlyAr`, а не снапшот: иначе потребитель читает поля, минуя вопросы Ar (D-39).

## 6. Как тестировать

Каждый метод — успех и каждая ошибка из `errors` (проверяется `code`); возвращаемый Ar — только для чтения (тип). Потребитель в тестах получает фасад-заглушку по `FacadeApi<typeof <M>FacadeDef>` ([testing.md](../testing.md)).
