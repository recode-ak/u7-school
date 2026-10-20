# Repo, DCS, DQS — гайд

**Назначение:** хранение агрегата — порт `<A>Repo` (`packages/<m>/src/<a>/<a>.repo.ts`) и его реализация (`packages/<m>/src/infra/<a>.json-repo.ts`); доменные сервисы над несколькими агрегатами — DCS/DQS (`packages/domain/src/<m>/<topic>.dcs.ts|.dqs.ts`), только когда без них нельзя.

> Эталон — модуль `wish` после Ф6–7. UC/ER ещё legacy-классы (до Ф8–11): `save` они зовут сами, без UoW. С `UseCaseFromDef` запись делает UoW (D-15), порт уже `Repository<WishAr>`.

---

## 1. Когда применять

- **Repo** — у каждого агрегата: загрузить Ar для операции и сохранить его. Только хранение (API-03): выборки по полям, без решений.
- **Доменное правило**, а не DCS — проверка без мутации по нескольким агрегатам («одно активное желание на цель», [policy.md](./policy.md)).
- **DCS** — одна операция меняет несколько агрегатов или сочетает правила с операциями; возвращает `Result` (DOM-06). В `wish` нет.
- **DQS** — вычисление на чтение поверх нескольких агрегатов, которое нужно нескольким потребителям (DOM-07). Список желаний пользователя — не DQS: query UC читает агрегаты через репозиторий. В `wish` нет.
- Не уверен — сначала метод Ar, затем правило; DCS/DQS — только по реальному потребителю ([domain-modeling.md](../domain-modeling.md) §1).

## 2. Команда

`bun run gen aggregate <m>.<a> --write` создаёт порт, `infra/<a>.json-repo.ts` и тест; в порт добавь `find*` под потребителей. `bun run gen dcs|dqs <m> <topic> --write` — заготовка сервиса с тестом. Legacy-модуль без паспорта — вручную по шаблону `scripts/gen/kinds/app-aggregate.ts`.

## 3. Эталон

- [wish.repo.ts](../../../packages/wish/src/wish/wish.repo.ts): `Repository<WishAr> & { find* }` — вход и выход `WishAr`, `undefined` при отсутствии; `Result` в порте нет — `save` бросает `VersionConflict`, UoW превращает его в `VERSION_CONFLICT`.
- [wish.json-repo.ts](../../../packages/wish/src/infra/wish.json-repo.ts): `aggregate = WishArDef`, `createLock`, `assertVersion(aggregate, ar, stored)`, запись `ar.snapshot()`; строгий разбор `v.array(WishArDef.state)` — схема дописывает `updatedAt`/`version` legacy-записям (D-36), даты читает ISO-строкой и числом, пишет числом.
- [wish.json-repo.test.ts](../../../packages/wish/src/infra/wish.json-repo.test.ts): round trip, конфликт версии, `create` с занятым uuid, битая запись, legacy-записи.
- [wish-legacy-records.integration.test.ts](../../../apps/u7-bot/tests/courses/wish-legacy-records.integration.test.ts): legacy-запись на копии фикстур проходит UC и пишется в новом формате.
- Образец платформы: [task.repo.ts](../../../packages/dmg-core/src/testing/example/app/todo/task/task.repo.ts), [task.json-repo.ts](../../../packages/dmg-core/src/testing/example/app/todo/infra/task.json-repo.ts).

## 4. Чеклист правил

- API-03 — порт принимает и возвращает Ar; `save` сверяет версию, чтение-сверка-запись под замком.
- ARC-03 — в домене нет IO: порт и реализация — в прикладном слое, домен порт не знает (резолвер — в пакете модуля).
- API-02 — в UC/ER/Job сохранение через UoW (с Ф8–11); legacy-классы пока зовут `save` сами.
- DOM-06 — DCS только для мутации нескольких агрегатов; проверка без мутации — доменное правило.
- DOM-07 — DQS только читает и не знает транспорта.
- CODE-01 — порт `<a>/<a>.repo.ts`, реализация `infra/<a>.json-repo.ts` ([naming.md](../naming.md) §3).
- TST-04 — тесты репозитория изолированы: временный файл, не `data/`.

## 5. Типичные ловушки

- **Решение в выборке.** «Текущее желание: активное последнее, иначе последнее» — выбор, а не хранение; в `wish` пока в `findCurrentByUserAndTarget` (TR-7, [debt.md](../debt.md) §6), уходит в UC/ER.
- **Мягкий разбор.** Пропуск битой записи с последующей перезаписью файла теряет её: разбор строгий, файл без неё не пишется (решение Нурболата).
- **`create` поверх legacy-записи.** Новый агрегат при занятом uuid — `VersionConflict`, а не перезапись записи версии 0 (`assertVersion`).
- **Лишняя запись.** `save(ar.snapshot())` и `restore` в UC — признак порта на state; порт работает с Ar.
- **Секунды без зоны.** `F.timestamp` принимает `YYYY-MM-DDTHH:mm` (legacy `isoNow`) и полный ISO с зоной; `…T10:00:00` без зоны — ошибка схемы.
- **DQS «на вырост».** Сервис без второго потребителя — лишний слой; query UC читает репозиторий.

## 6. Как тестировать

Каждый `find*` — совпадение и отбор; `save` — round trip, устаревшая версия, новый агрегат при занятом uuid (файл не изменён), битая запись (исключение, файл не изменён), legacy-запись без `updatedAt`/`version` — читается, после перехода `version: 1`. Временный каталог (`mkdtemp`), не `data/` ([testing.md](../testing.md)).
