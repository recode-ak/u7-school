# Errors — гайд

**Назначение:** Def ошибок агрегата (`<A>Errors = defineErrors('<PREFIX>', { … })`): код, `kind`, `label`, `description`, схема payload. Файл — `packages/domain/src/<m>/<a>/<a>.errors.ts`. Модель ошибки и `Result` — [errors-result.md](../errors-result.md).

> Эталон — модуль `wish` после Ф3–4. UC и ER ещё legacy-классы (до Ф8/Ф10): `Result` до вызывающих не доходит, ошибка `WishErrors` поднимается legacy-исключением через мост (TR-1 в [debt.md](../debt.md) §6).

---

## 1. Когда применять

- Штатный отказ операции агрегата или UC: переход из недопустимого статуса, дубль, «не найдено». Такой отказ — значение `Err`, а не `throw` (ERR-01).
- Ошибки переходов Ar (`rejects`) и ошибки UC модуля живут в одной группе агрегата; UC и фасад ссылаются на них.
- Ошибку зависимости бери по ссылке через её фасад. Свою заводи, только когда смысл другой: у `wish` «курс недоступен для записи» — не то же, что `COURSE_NOT_FOUND` модуля `course`.

## 2. Команда

`bun run gen aggregate <m>.<a> --write` создаёт `<a>.errors.ts` с пустой группой. Legacy-модуль без паспорта переводится вручную ([state.md](./state.md) §2).

## 3. Эталон

- [wish.errors.ts](../../../packages/domain/src/wish/wish/wish.errors.ts): 4 отказа переходов (`conflict`) и 4 ошибки UC; payload через `F.*`.
- [wish.errors.test.ts](../../../packages/domain/src/wish/wish/wish.errors.test.ts): коды с префиксом, `kind`, разбор payload.
- [legacy-error.ts](../../../packages/core/src/legacy-bridge/legacy-error.ts): `toLegacyError` — перевод `Err` в legacy-исключение для stories, вызывающих `appApi.execute(Def, …)` (TR-1); новый вызывающий код берёт `Result` из `appApi.run`.
- Образец платформы: [task.errors.ts](../../../packages/dmg-core/src/testing/example/todo/task/task.errors.ts).

## 4. Чеклист правил

- ERR-01 — штатный отказ — `Err`; `throw` только для бага и сбоя.
- ERR-03 — ошибки зависимости — по ссылке через её фасад (контракт фасада); своя ошибка — только при смене смысла.
- ERR-04 — коды UPPER_SNAKE с префиксом группы и уникальны в приложении. `checkDefs` сверяет только Def; коды legacy-модулей (`COURSE_NOT_FOUND`) он не видит — их ищи по репозиторию.
- ERR-05 — ошибка не знает транспорт: нет HTTP-статусов и текстов UI.
- MAN-01 — `label` и `description` у ошибки; MAN-02 — `description` у каждого поля payload.
- MAN-12 — каждая ошибка из `rejects` перехода объявлена в группе.
- `kind` — по смыслу ([errors-result.md](../errors-result.md) §2): отказ перехода — `conflict` (TR-3), отсутствие — `not_found`, невалидный вход — `validation`.

## 5. Типичные ловушки

- **Чужой код в своей группе.** `COURSE_NOT_FOUND` уже есть у `course` — коды уникальны в приложении. Префикс группы (`WISH_COURSE_NOT_FOUND`) и своё описание смысла.
- **Два `optional` вместо веток.** «Ровно один из `courseId`/`moduleId`» — `v.union` двух `strictObject`, иначе схема не проверяет инвариант.
- **`payload | undefined`.** Payload объявленной ошибки обязателен по схеме: вызывающий ветвится по нему (у `WISH_ALREADY_EXISTS` — `status` существующего желания).
- **Текст экрана в `label`.** `label` — короткое имя отказа, `description` — когда он возникает (ERR-05). Пока работает мост, `label` становится `message` legacy-исключения и его показывает `errorNotify`, поэтому в эталоне оставлены прежние тексты; формулировки экрана — дело UI.
- **Второй конвертер в legacy-исключение.** Перевод `kind`/кода один — `toLegacyError` из `@u7-scl/core/legacy-bridge`.
- **Смена кода как смена поведения.** Перед переименованием кодов проверь, по чему ветвится UI: бот различает ошибки `wish` по `kind`, поэтому новые коды пользователю не видны.

## 6. Как тестировать

Группа: префикс и `kind` каждого кода, разбор payload. Ar: каждый отказ из `rejects` — конкретный `code` (TST-01). UC: тест на каждую собственную ошибку по `code` и `kind`, а не по факту исключения ([errors-result.md](../errors-result.md) §5, [testing.md](../testing.md)).
