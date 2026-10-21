# Use case — гайд

**Назначение:** операция модуля для вызывающего — контракт `<N>UcDef = defineUseCase(...)` (`packages/domain/src/<m>/<a>/uc/<n>.uc.ts`) и реализация `<N>Uc extends UseCaseFromDef` (`packages/<m>/src/<a>/uc/<n>.uc.ts`).

---

## 1. Когда применять

- Действие пользователя, транспорта или другого модуля над агрегатом модуля: command меняет состояние, query только читает (различия — Ф9).
- UC техничен (API-01, D-08): загрузить → отдать домену → `uow.register`. Решение по состоянию, входу или ответу чужого модуля — в домене: право субъекта — Policy ([policy.md](./policy.md)), допустимость без субъекта — доменное правило в `rules`, выбор статуса и данных — метод Ar ([aggregate.md](./aggregate.md)).
- Реакция на событие — не UC, а ER (Ф10).
- Вызов другого модуля — через его фасад, Def вызываемого UC — в `calls` (D-42, [facade.md](./facade.md)). Побочный эффект в чужом модуле — место выбирает Нурболат по каждому случаю (D-41).

## 2. Команда

`bun run gen uc <m>.<a> <имя> --write` — пара Def + реализация с тестами, строка в `<M>ModuleDef.useCases` и в карте модуля. Требует `<m>.module.ts` (`gen module <m> [--adopt]`). Заполнить: `label`/`description`, `callers`, `policy`, `rules`, `calls`, схемы, `errors`, `emits` (заготовка ссылается на несуществующее событие — замени или убери).

## 3. Эталон

- [create-course-wish.uc.ts (Def)](../../../packages/domain/src/wish/wish/uc/create-course-wish.uc.ts): `rules: [courseEnrollable, unique]` — порядок правил = порядок отказов; `calls` на UC внешних `course`/`questionnaire`; вход — из state (`WishCourseTargetVo`, D-39); `emits` нет — события создания нет.
- [create-course-wish.uc.ts (реализация)](../../../packages/wish/src/wish/uc/create-course-wish.uc.ts): `load` собирает контекст Policy и правил (`enrollment` из фасада, желания из репозитория), `execute` — `WishAr.createForCourse` (результат `{ wish, outcome, questionnaire? }`) → `uow.register(wish)` → запуск анкеты, если она есть, до фиксации (D-41, вариант 1) → `outcome` из домена.
- [wish.rules.ts](../../../packages/domain/src/wish/wish/wish.rules.ts): правило над ответом чужого модуля (`courseEnrollable`) и над агрегатами (`unique`).
- [wish.module.ts (карта)](../../../packages/wish/src/wish.module.ts): `WishDeps` — репозиторий и фасады зависимостей; субъект модуля.

## 4. Чеклист правил

- API-01 — в UC нет `if` по состоянию, статусу, входу; ветвление только по ответу метода-вопроса Ar.
- API-02 — сохранение через `uow.register`, ручного `save`/`publish` нет.
- API-05 — реализация наследует `UseCaseFromDef`, свойства Def не повторяются (MAN-09).
- MAN-04 — публикуются только события из `emits`.
- MAN-05 — каждый вызов фасада покрыт `calls`; вызываемый UC объявляет `module` в `callers`; в тесте фасады — через `fakeFacadeCall` (сверяет `calls`).
- MAN-11 — `callers` объявлены; субъект — через `this.subject(caller)`, не через `kind`.
- ERR-02 — ошибки каждого правила и проброшенные ошибки зависимостей — в `errors`.
- DOM-16 — правило возвращает ошибку своей группы.

## 5. Типичные ловушки

- Решение «курс недоступен → ошибка» в `load` через `if` → доменное правило в `rules`, `load` только кладёт ответ в контекст.
- Выбор статуса по пулу в UC → фабрика Ar (`createForCourse`) решает сама.
- UC знает, что передать в чужой контракт (`{ courseId }`) или какой `outcome` вернуть → это строит домен в результате создания (`CourseWishCreated`).
- Данные «что сделать после создания» в поле Ar вне state → скрытое состояние; верни их результатом фабрики (ревью Ф8, TR-12).
- Тест собирает реальные адаптеры чужих пакетов → ARC-06; в тесте UC — фейки типов фасадов из домена, связку проверяют тесты фасадов владельца.
- Существующие записи в тесте сохраняются через `restore` + `save` → `VersionConflict`; пиши файл фикстуры или создавай через `create` + UoW.

## 6. Как тестировать

Каждая ошибка UC — с `code` и «ничего не записано»; порядок правил (отказ первого при нарушении обоих); каждый исход выхода; сбой вызова чужого модуля — ответ UC и отсутствие записи; недопустимый вызывающий — `UNAUTHORIZED`. Репозиторий — настоящий во временном каталоге ([create-course-wish.uc.test.ts](../../../packages/wish/src/wish/uc/create-course-wish.uc.test.ts)); smoke модуля — [wish.module.test.ts](../../../packages/wish/src/wish.module.test.ts). Общее — [testing.md](../testing.md).
