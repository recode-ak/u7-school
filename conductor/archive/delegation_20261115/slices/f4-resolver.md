# Срез Ф4: резолвер с заявкой — каркас и образец (ФР-6, ФР-7)

**Репо:** `~/dev/tools/dmg/dmg-core`. Решение — D-89 (черновик), пункт «Резолвер приложения». Ф3 дала `DelegationCheck`, `DelegationClaim`, `DelegationStore`, `DelegationRecord`, `DELEGATION_DENIED` (`dmg-core/app`, `core-errors.ts`).

## Контракт резолвера

`resolve(uuid: string | undefined, trace: Trace, claim?: DelegationClaim): Promise<Result<PersonCaller<U>, DelegationDenied>>` — отказ делегирования — `err(DELEGATION_DENIED)`; дефект (сбой `getUser` вне «не найден») — по-прежнему исключение (ERR-01). Без заявки — как раньше, обёрнуто в `ok`.

С заявкой:

1. `uuid` (личность от транспорта) нет или `uuid !== claim.actorId` → `DELEGATION_DENIED { reason: 'invalid' }`.
2. `DelegationCheck.verify(claim)` → отказ — как есть.
3. Оба пользователя (`principalId`, `actorId`) загружены и активны; нет или неактивен → `invalid`.
4. `ok(new DelegateCaller(principal, actor, delegationId, record.readOnly))` — `readOnly` **из записи**, не из заявки.

Тихого входа «как сам себе» нет: заявка при отказе не превращается в `UserCaller`. Исключение порта `DelegationStore` — дефект, пробрасывается (ERR-01), не превращается в гостя. Пустые поля заявки (`''`) — `invalid` до обращения к порту. Тип отказа — `DelegationDenied` (`dmg-core/app`); контракт резолвера — `Result<PersonCaller<U>, DelegationDenied>`.

## Границы

| Файл | Что |
|---|---|
| `src/testing/example/app/example-delegation-store.ts` | `ExampleDelegationStore implements DelegationStore` — записи в памяти (конструктор принимает `DelegationRecord[]`) |
| `src/testing/example/app/example-caller-resolver.ts` | контракт выше; `DelegationCheck` строится из порта и `clock` контекста |
| `src/testing/example/app/example-app.types.ts`, `example-app.ts` | `ExampleAppPorts.delegations?: DelegationStore`; не задан — делегирование не подключено (`disabled`) |
| `src/testing/example/runner/example-cli.ts` (+ `.types.ts`) | общие опции `--on-behalf <uuid>` и `--delegation <id>` (обе или ни одной; одна — ошибка ввода `EXIT_USAGE`) → `DelegationClaim { principalId, actorId: --user, delegationId }`; отказ резолвера — JSON отказа в stdout (как `Result` UC) и `EXIT_REJECTED`; `USAGE` |
| `src/cli/scaffold/app-sources.ts` | шаблоны каркаса: тип `CallerResolver` — контракт выше; заглушка `AppCallerResolver` с заявкой → `DELEGATION_DENIED { reason: 'disabled' }` (порта нет); `RunnerCli` — те же опции и обработка отказа; шаблон теста приложения/раннера — случай отказа |
| тесты | red от dmg-test-designer: резолвер образца, резолвер каркаса (в тестах шаблонов/e2e каркаса), раннеры |
| документы | `guides/project.md` (резолвер каркаса) и др. по `docs:impact` — минимально; гайд делегирования — Ф6 |

## Red-тесты (dmg-test-designer)

Резолвер образца (`example-app.test.ts` или рядом с резолвером), порт — `ExampleDelegationStore`, часы — порт `clock`:

1. Успех: `DelegateCaller`, `subject()` — замещаемый, `actor` — заместитель, `readOnly` из записи (запись `readOnly: true`, в заявке поля нет).
2. Каждый отказ `DelegationCheck` доходит как есть: нет записи, истекла, отозвана (по одному случаю на причину — не повторять тесты Ф3 целиком, достаточно одного «отказ проверки возвращается как есть» + `disabled` без порта).
3. Чужой заместитель: `uuid` транспорта ≠ `claim.actorId` → `invalid`; заявка без `uuid` → `invalid`.
4. Нет пользователя: замещаемый не найден / неактивен → `invalid`.
5a. Пустое поле заявки → `invalid`, порт не вызывается; исключение порта пробрасывается.
5. Без заявки — прежнее поведение (`ok(UserCaller)`, `ok(GuestCaller)`).

Каркас: резолвер заглушки с заявкой → `disabled` (тест шаблона или e2e каркаса — где проверяются шаблоны).

Раннеры: образец и каркас печатают отказ и выходят с `EXIT_REJECTED`; одна из двух опций — `EXIT_USAGE`.

## Критерии приёмки

- `bun run check && bun run e2e` зелёные; `docs:covers --strict` чист.
- `grep -rln "DelegationStore" src/testing/example/app` не пуст.

## Правила

ERR-01, D-50 (корень сборки), D-51 (`SystemCaller` `kind: 'app'`), ARC-09 (окружение читает раннер), TST-08/09, CODE-04, D-89.

## Отчёты

### dmg-test-designer (Sonnet)

`src/testing/example/app/example-delegation.test.ts` (резолвер образца: успех, `readOnly` из записи, отказ проверки как есть, `disabled`, чужой заместитель, без `uuid`, нет/удалён замещаемый или заместитель, пустые поля — порт не вызван, исключение порта пробрасывается, без заявки — прежнее); `src/testing/example/runner/example-cli-delegation.test.ts` (отказ → JSON и `EXIT_REJECTED`, одна опция или не uuid → `EXIT_USAGE`, `USAGE`); `src/cli/scaffold/project-scaffold.test.ts` — 5 тестов текста шаблонов (`toContain`: `claim?: DelegationClaim`, `Result<PersonCaller<AppUser>, DelegationDenied>`, `reason: 'disabled'`, опции раннера, `caller.ok`, `ok(new GuestCaller())`) — строки можно подправить под имена автора. Поведение заглушки — e2e каркаса. Старые тесты резолвера правит автор. 16 pass / 7 fail.

### dmg-api-author (Sonnet)

`ExampleDelegationStore`; резолвер образца — `Result<PersonCaller, DelegationDenied>` (пустые поля → личность → `DelegationCheck` → оба пользователя активны → `DelegateCaller` с `readOnly` из записи); `ExampleAppPorts.delegations?`; раннер образца — `--on-behalf`/`--delegation`, отказ — JSON и `EXIT_REJECTED`; шаблоны каркаса (тип, заглушка `disabled`, `RunnerCli`, шаблонные тесты с отказом); `guides/project.md` — одно предложение. Отклонения: `toContain('resolved.ok')`; ARC-07 в `arch-checker.test.ts` — новый тест в ожидаемом списке. `check` 1722 pass, `e2e` ok.

### dmg-access-auditor (Sonnet, пилот)

Обходов и «тихого входа» нет; `readOnly` только из записи; отказ в раннерах не теряется. Info → Ф6 (гайд): самоделегирование (`principalId === actorId`) запрещать при выдаче — образец доверяет хранилищу. Warn без действия (покрытие каркаса — делегирование выключено по замыслу).

### dmg-reviewer (Opus)

Error нет. Major (автору): CODE-04 — две `D-NN` в одном JSDoc (резолвер образца, шаблоны каркаса); TST-08 — дубль «без заявки», тесты текста шаблонов тестов. Minor: тесты текста шаблонов 1–3 (оставить сигнатуру), слабый случай `actorId: ''`, тавтология `USAGE`, лишняя пересборка пользователя, необязательный `clock`, импорт типов из двух мест. ARC-07 в `arch-checker.test.ts` — оправдано (соглашение образца). Ratchet-кандидат: число `D-NN` на блок JSDoc — в `docs:jsdoc`. Вне границ → Ф6: `guides/app.md:30-31` — резолвер с заявкой и `Result`.

### Итог среза

Правки по ревью внесены (CODE-04, лишние тесты удалены, `clock` обязателен). Пакет `15a894d` (срез), `192ef14` (`verified`). `check` — 1714 pass / 0 fail, `e2e` — ok.
