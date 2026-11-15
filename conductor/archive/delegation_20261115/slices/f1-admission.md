# Срез Ф1: допуск заместителя (ФР-1–4)

**Репо:** `~/dev/tools/dmg/dmg-core` (не `node_modules/dmg-core`). Решение — D-89 (черновик) и D-25 в `docs/decisions.md` пакета. Spec — `../spec.md` ФР-1–4.

## Границы

| Файл | Что |
|---|---|
| `src/kernel/caller/caller.types.ts` | новый `DeclaredCaller = 'guest' \| 'user' \| 'system'` (словарь `callers`); `CallerKind` (четыре вида) остаётся — вид класса и лога; `readOnly?: boolean` в `DelegateCallerJson` и в ветке `delegate` у `CallerLog` |
| `src/kernel/caller/caller.ts` | абстрактный `declaredKind(): DeclaredCaller` у `Caller` (у `DelegateCaller` — `'user'`, у остальных — свой `kind`); `DelegateCaller` — четвёртый параметр `readonly readOnly = false`; `toLog`/`toJSON` пишут `readOnly: true` только при `true` (форма обычного заместителя не меняется — старые записи и ключ отсева повторов те же); `fromJSON` читает `readOnly` (необязательно, `v.optional(v.boolean())`) |
| `src/index.ts` | экспорт типа `DeclaredCaller` |
| `src/domain/contracts/use-case-def.types.ts` | `callers: readonly [DeclaredCaller, ...DeclaredCaller[]]`; необязательный `personal?: boolean` в `Common` с JSDoc (UC недоступен заместителю — прямо и во вложенном вызове); `NormalizedUseCase.callers: readonly DeclaredCaller[]`, `NormalizedUseCase.personal: boolean` |
| `src/domain/contracts/use-case-def.ts` | `readonly personal: boolean` (= `spec.personal ?? false`), в нормализованной форме |
| `src/kernel/errors/core-errors.ts` | `UNAUTHORIZED`: описание — «вид вызывающего не входит в `callers` или операция недоступна заместителю (`personal`, `readOnly`)»; payload — `callerKind` + необязательный `reason: 'personal' \| 'readOnly'` |
| `src/app/use-case/use-case-from-def.ts` | `protected checkCaller` сверяет `callers` с `caller.declaredKind()`; **новый приватный шаг** допуска заместителя сразу после `checkCaller` в `run`: заместитель — `caller.person()?.kind === 'delegate'` (прямо и за `SystemCaller`); `def.personal` → `UNAUTHORIZED {callerKind: caller.kind, reason: 'personal'}`; `readOnly` и `def.type === 'command'` → `UNAUTHORIZED {…, reason: 'readOnly'}`. Шаг не `protected`: наследник не обходит его переопределением. JSDoc `handle` — порядок шагов |
| `src/graph/` (normalize, граф) | `personal` в нормализованной форме и выводе графа — где выводятся `callers` |
| `src/app/oplog/operation-log-feed.ts` | лента: у заместителя с `readOnly` — пометка «только чтение» |
| образец и фикстуры | `src/testing/example/**` и `src/domain/contracts/contracts.fixture.ts`: `'delegate'` из `callers` убрать; тесты на делегата (`assign-task.uc.test.ts`, `complete-task.uc.test.ts`, `list-tasks.uc.test.ts`, `module-from-def.test.ts`) — заместитель проходит по `user` |
| документы | по `bun run docs:impact <пути>` — минимально, чтобы `docs:covers --strict` был чист; полная правка документов — Ф6 |

Генератор (`src/gen`) и каркас (`src/cli/scaffold`) `'delegate'` в `callers` не пишут — не трогать.

## Поведение «было → станет»

- Было: `callers: ['user']` отказывает `DelegateCaller`; нужно `['user', 'delegate']`. Станет: проходит, Policy получает замещаемого (`subject()`), лог — оба идентификатора.
- Было: `'delegate'` в `callers` допустим. Станет: ошибка типа.
- Новое: `personal`, `readOnly` — отказ `UNAUTHORIZED` заместителю, прямо и от `SystemCaller` с заместителем; query при `readOnly` проходит.
- Не меняется: `SystemCallableUc`/`SystemCalls` (по `'system'` в `callers`), Policy, ключ отсева повторов (`command-replay.ts`) для заместителя без `readOnly`.

## Red-тесты (dmg-test-designer)

1. `DelegateCaller` проходит UC с `callers: ['user']`; Policy получает замещаемого; запись oplog — `subjectId`, `actorId`, `delegationId`.
2. `'delegate'` в `callers` — `@ts-expect-error` (TST-10: негативный тест гарантии, одна ошибка в строке, с пояснением).
3. `personal`: отказ заместителю прямо и от `SystemCaller` с заместителем (через фасад/`call`); `user` и `system` с `user` — проходят.
4. `readOnly`: command — отказ (прямо и от `SystemCaller`), query — успех.
5. `toJSON`/`fromJSON`/`toLog` с `readOnly` и без (старая форма читается, `readOnly` = `false`).
6. `normalize` и граф показывают `personal` (`src/graph/normalize.test.ts`).

Сценарии кладутся в существующие файлы тестов по месту (`caller.test.ts`, `use-case-from-def*.test.ts`, `normalize.test.ts`, тесты фасада/модуля) — TST-08/09: поведение платформы — в тестах платформы, не в образце.

## Критерии приёмки

- `bun run check` зелёный, тестов ≥ 1655.
- `grep -rn "'delegate'" src/testing/example src/domain/contracts/contracts.fixture.ts src/graph --include=*.ts` — только вид класса и лог, не `callers`.
- `grep -n "personal" src/graph/normalize.test.ts` не пуст.
- `bun run docs:covers --strict` без предупреждений.

## Правила

MAN-11, MAN-05, D-43 (Policy вызывается всегда), API-05 (шаги `UseCaseFromDef`), TST-08, TST-09, TST-10, CODE-04 (JSDoc — только невыводимое), D-59 (документы).

## Отчёты

### dmg-test-designer (Sonnet)

Red-тесты в `caller.test.ts`, `use-case-from-def.test.ts`, `normalize.test.ts`: 16 падают по делу (нет `declaredKind`, `readOnly`, `personal`, `reason`), остальные 117 по затронутым каталогам зелёные. Уточнение порядка: шаг допуска сначала проверяет `personal`, потом `readOnly` (принято). UC собирает хелпер `ucWith` с `as never` — убрать после появления `personal` в типе. Заместитель за `SystemCaller` — через `handle` напрямую. Существующие тесты на делегата (образец, `module-from-def.test.ts`, `normalize.test.ts:119`) правит автор вместе с удалением `'delegate'` из `callers`.

### dmg-api-author (Opus)

`DeclaredCaller`, `Caller.declaredKind()`, `DelegateCaller.readOnly` (в JSON и логе только при `true`), `personal` в Def и нормализованной форме, `UNAUTHORIZED.reason`, приватный `checkDelegate` после `checkCaller` (сначала `personal`, потом `readOnly` для command), лента oplog — «только чтение». `'delegate'` убран из образца и фикстур. Документы минимально: `reference/{caller,errors-result,oplog,manifests}.md`, `concepts/{caller,uc-path}.md`, `guides/use-case.md`. Отклонения: `ucWith` разделён для query (`emits: []`); `core-errors.test.ts` — ожидаемые ключи payload; `reference/caller.md` правлен вне `docs:impact` (нет `covers:`). После коммита — `verified` для документов из `covers:`, не задетых по смыслу. `check`: 1677 pass.

### dmg-reviewer (Opus)

Error нет. Minor: дубль теста `personal: false` (TST-08), место негативного теста типа `callers` — `use-case-def.test.ts`, `D-89` не в первом предложении JSDoc (CODE-04, 2 места); вопросы: `as unknown as` в `ucWith`, нет сквозного сценария через `call`. Всё — автору на правку.

### dmg-access-auditor (Sonnet, пилот)

Обхода и утечки нет. Warn: нет сквозного теста через настоящий `call`/фасад (принято); нет теста «переопределённый `checkCaller` не снимает `checkDelegate`» (принято); `fromJSON` без `readOnly` → `false` (fail-open — по замыслу D-89: старые записи; `readOnly` резолвер берёт из записи — Ф4); `personal` по умолчанию `false` (по замыслу D-89, какие UC помечать — гайд Ф6). Пересечение с ревьюером — сквозной сценарий.

### Итог среза

Правки по ревью и аудиту: дубль убран, негативный тест типа — в `use-case-def.test.ts`, `ucWith` без приведения, сквозной `personal` через настоящий фасад (`operation-from-def.test.ts`; `readOnly` сквозным не проверяется — MAN-14), тест «переопределённый `checkCaller` не снимает шаг допуска», `D-89` в первом предложении JSDoc. Пакет: `64af7d9` (срез), `484db75` (`verified`). `check` — 1678 pass / 0 fail (база 1655); `docs:covers --strict` — чисто.
