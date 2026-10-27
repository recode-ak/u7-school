# Caller — кто вызывает

**Назначение:** абстракция вызывающей стороны для UC, Policy и аудита (D-43). Классы `Caller` и `Trace` — в `dmg-core` (дженерик пользователя замыкает пакет приложения); делегирование — §3.

---

## 1. Иерархия

`Caller<U>` — абстрактный класс; вид — `kind`, остальное — методы:

```ts
abstract class Caller<U extends { uuid: string }> {
  abstract readonly kind: 'guest' | 'user' | 'delegate' | 'system';
  abstract subject(): U | undefined;          // от чьего имени — для Policy и домена
  abstract person(): PersonCaller<U> | undefined; // исходный человек — для вложенных вызовов
  abstract toLog(): CallerLog;                // форма для лога операций
}
type PersonCaller<U> = GuestCaller<U> | UserCaller<U> | DelegateCaller<U>;
```

| Класс | Кто | `subject()` | `person()` |
|---|---|---|---|
| `GuestCaller` | не зарегистрирован (канал — в `Trace.channel`) | нет | он сам |
| `UserCaller(user)` | авторизованный пользователь | он сам | он сам |
| `DelegateCaller(subject, actor, delegationId)` | заместитель действует от имени другого по делегированию | **тот, кого замещают** | он сам |
| `SystemCaller(from, person?)` | операция приложения: UC/ER/Job своего или другого модуля; `from: OperationRef` — `{ kind, module, name }` вызвавшей операции | `person?.subject()` | `person` |

- Матрёшки нет: `person` по типу не `SystemCaller`; вложенный вызов передаёт `caller.person()` пришедшего.
- ER и Job — `SystemCaller` без `person`: субъекта нет. Job — не гость (гость — реальный посетитель); «кто породил» для ER — через `trace.cause` к записи операции-причины в логе.
- Свой или чужой модуль — сравнение `from.module` с модулем вызываемого; отдельного вида `module` нет.
- `toLog()`: `{ kind: 'guest' }` · `{ kind: 'user', subjectId }` · `{ kind: 'delegate', subjectId, actorId, delegationId }` · `{ kind: 'system', from, person? }`.

Различие *субъект* (от чьего имени) и *исполнитель* (кто физически) — практика делегирования полномочий (ERP «замещение», OAuth Token Exchange RFC 8693 `act`). Это **не** impersonation: делегирование ограничено сроком и набором прав, отзывается, все действия видны в аудите.

## 2. Ключевые правила

1. Def UC объявляет допустимые виды: `callers: ('guest' | 'user' | 'delegate' | 'system')[]`. Недопустимый вид отсекается до запуска UC (`UNAUTHORIZED`).
2. Policy и домен работают только с **субъектом** (`caller.subject()`): `Rule.evaluate(subject, ctx)`; вид вызывающего Policy не знает и делегирование не проверяет — право и возможность даёт приложение, решение — люди. Policy вызывается всегда; правило без субъекта — отказ (`ACCESS_DENIED`).
3. Системный вызов без субъекта разрешается только явно: отдельный UC (`callers: ['system']`, `allowAll`) или переопределение `protected checkPolicy` в наследнике `UseCaseFromDef` — ответственность наследника.
4. Межмодульный вызов — `this.call(def, input, caller, trace)` базы `OperationFromDef`: только Def из `calls` (по типу — UC с `'system'` в `callers`); база подставляет `SystemCaller(this.ref, caller.person())` и идёт через фасад модуля-владельца (`Facade<M>.handle`). Рантайм-проверки `calls` нет.
5. След — класс `Trace`: `requestId` (вход транспорта: `Trace.fromRequest`; клиент не передал — создаётся с `warn`, ERR-07), `cause` (запрос, событие или прогон Job), `correlationId` (вся цепочка), `channel?: { name, visitorId? }` (задаётся на входе, идёт по цепочке). ER — `Trace.fromEvent` (канал события не переносится — в конверте его нет), Job — `Trace.forJob(def)` (причина — прогон с именем Job). `toLog()` — форма для лога операций, `toEnvelope()` — для конверта события.
6. Конверт события несёт `cause` и `correlationId`, но не `caller`: аудит «кто» — лог операций (`OperationLog`, `toLog()` вызывающего), «из-за чего» — `trace.cause`.
7. Транспорт строит `Caller` и `Trace` на входе (бот — по идентификатору пользователя в канале и активному делегированию, HTTP — по токену) и вызывает `ModuleFromDef.handle`; внутрь UC они передаются неизменными.

## 3. Делегирование

Делегирование — агрегат модуля пользователей приложения, а не платформы: `from`, `to`, область (роли или правила), `validFrom`/`validTo`, причина, отзыв; события `<m>.delegation.granted/revoked/expired`. Пока приложение его не реализовало, `delegate` в `callers` объявляется, но транспорт его не строит.

## 4. Связанные файлы

- [decisions.md](./decisions.md) — D-43
- [manifests.md](./manifests.md) — поле `callers` в `UseCaseDef.define`
- [errors-result.md](./errors-result.md) — `UNAUTHORIZED`, `ACCESS_DENIED`
