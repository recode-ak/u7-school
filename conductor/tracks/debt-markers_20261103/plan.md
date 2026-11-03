# Plan: debt-markers_20261103

Каждая фаза — отдельная сессия: Нурболат начинает её сам с выбранной моделью.

**Модели по фазам:** Ф0 — Opus (вместе с Ф1, одна сессия), Ф1–Ф2 — Opus (эталон проверки и формата), Ф3–Ф7 — Sonnet (механика по образцу; в Ф6 новые записи `debt.md` — на подтверждение Нурболату).

**Агенту:** в начале сессии сверь модель с этой таблицей — не совпадает, скажи Нурболату до начала работы. В конце фазы (после контрольной точки) последней строкой сообщи: «Следующая — Фаза N: <имя>, модель <Opus|Sonnet>, новая сессия».

Код — TDD (red → запуск → green). Поведение кода не меняется; данные `data/` не трогаем; пушей и деплоя нет. `bun run check` зелёный в конце каждой фазы.

Признаки и Корни по записям — черновик `tech-lead` (таблица ниже), уточняются в Ф2.

| ID (после склейки) | Место | Признак | Корень |
|---|---|---|---|
| DEBT-1 | `domain/src/{user,course,questionnaire,stream}/**` — glob на модуль | `from '@u7-scl/core` | `domain/src/**` |
| DEBT-2 | `module.ts` модулей + `stream/stream/a-root.ts` | `from '@u7-scl/app-legacy` | `domain/src/**` |
| DEBT-5 | entity из записей + `stream/date-test.test.ts` | `v\.isoDateTime` | `domain/src/**` |
| DEBT-3 | barrel'ы (у stream — ещё `api/errors.ts`), `platform/app-legacy/src/domain/user.ts` | `export \* from '@u7-scl/domain/` | `{modules,platform}/*/src/**` |
| DEBT-10 | `a-root.ts` course/questionnaire/stream | `^\s*(static\s+)?(async\s+)?(get\s+)?#\w+` | `domain/src/**/a-root.ts` |
| DEBT-32 | 2 файла questionnaire | `import type \{ User \} from '@u7-scl/domain/user'` | `modules/{course,questionnaire,stream,wish,peer-review,dossier}/src/**` |
| DEBT-34 | `scripts/domain-check.ts` | `sub !== 'index'` | сам файл |
| DEBT-35 | `invite-wishers.er.test.ts` | `rejects\.toThrow\('опубликовала событий'\)` | `modules/*/src/**` |
| DEBT-40 | тесты UC/ER/Job wish + peer-review | `mkdtemp` | `modules/*/src/**/*.{uc,er,job}.test.ts` |
| DEBT-41 | `platform/core/src/ui/bot/bot-request-context.ts` | `AsyncLocalStorage` | `{platform,runners}/*/src/**` |
| DEBT-42 | `runners/u7-cli/src/main.ts`, `scripts/call-uc.ts` | `dbDir: 'data'` | `{runners/*/src,scripts}/**` |
| DEBT-43 | `view-stream.story.ts`, `wish-invite.story.ts` | `getUTCHours\(` | `runners/u7-bot/src/**` |

## Фаза 0: Базовая линия (Opus, сессия Ф1)

- [x] Task: Зафиксировать базовую линию: `bun run check`, число тестов `bun test`; замер по корням `arch:check` (`DEBT-N` всего / в `biome-ignore` / голые, `TR-NN`, строки «временн…») — в черновик `summary.md` `1ebf7fb`
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md)

## Фаза 1: Эталон `checkDebt` (Opus)

- [ ] Task: Тесты новой `checkDebt` в `scripts/domain-check.test.ts`; red
    - [ ] Разбор записи: Место (несколько glob, «Погашает» на glob), Признак, Корень, закрытая «слит в DEBT-N»
    - [ ] Устаревший glob; погашенный glob (признак пропал в одном glob слитой записи)
    - [ ] Долг вне Места в пределах Корня; вне Корня — не ошибка
    - [ ] `DEBT-N` вне `biome-ignore`: ошибка в строгом режиме, допуск в переходном; неизвестный и закрытый ID в `biome-ignore`
    - [ ] Перенести сценарии старой `checkDebt`
- [ ] Task: Тесты ARC-02 без маркера: импорт `@u7-scl/core`/`app-legacy` в домене без `DEBT-N` — не ошибка `checkDomainImports`; red
- [ ] Task: Реализация `checkDebt({ code, debtMd, mode })` и переделка ARC-02; `arch-check.ts` пока на старой сверке; green
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

Критерии приёмки: именованный тест на каждое правило FR2/FR3; `bun test scripts/domain-check.test.ts` зелёный; число тестов ≥ базовой линии; `bun run check` зелёный.

## Фаза 2: Разметка реестра и подключение (Opus)

- [ ] Task: «Правила» `debt.md`: поля Место/Признак/Корень, «Погашает» на glob, закрытие «слит в», `DEBT-N` только в `biome-ignore`; «последний выданный — DEBT-43»
- [ ] Task: Место, Признак, Корень для всех 30 записей по таблице; поправки учёта: DEBT-35 (Место, критерий), DEBT-40 (+ peer-review), DEBT-43 (узкий признак, ввод и `formatDate` — текстом)
- [ ] Task: `arch-check.ts` — новая `checkDebt` в переходном режиме; тексты ошибок `domain-check.ts` без ID долгов
- [ ] Task: Ручная проба: убрать признак из файла Места / добавить вне Места → нарушение есть; откатить
- [ ] Task: Ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

Критерии приёмки: `bun run arch:check` — 0 нарушений; у каждой открытой записи Место и Признак; проба ловит оба случая; `bun run check` зелёный.

## Фаза 3: Голые маркеры (Sonnet)

- [ ] Task: Удалить голые `// DEBT-N` (86 в 70 файлах), хвостовые у импортов в `errors.ts` (3), упоминания в JSDoc (`scripts/call-uc.ts`, `review-render.ts`), DEBT-35 в имени теста и комментарии `invite-wishers.er.test.ts`, комментарий `domain-check.ts`; «почему» — оставить без ID
- [ ] Task: Включить строгий режим `checkDebt` в `arch:check`
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

Критерии приёмки: `rg -n '\bDEBT-\d+' <корни> | rg -v biome-ignore` — пусто; `arch:check` строгий, 0 нарушений; число тестов ≥ базовой линии; `bun run check` зелёный.

## Фаза 4: Склейка дублей (Sonnet)

- [ ] Task: Слить в `debt.md`: DEBT-1 ← 6/11/16; DEBT-2 ← 7/12/17; DEBT-5 ← 9/14/19; DEBT-3 ← 4/8/13/18/23/27/30; DEBT-10 ← 15/20 — glob со своим «Погашает»; закрытые — «слит в DEBT-N»
- [ ] Task: Перенумеровать `biome-ignore` с закрытыми ID
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

Критерии приёмки: `rg 'DEBT-(4|6|7|8|9|11|12|13|14|15|16|17|18|19|20|23|27|30)\b' <корни>` — пусто; закрытые ID помечены; `bun run check` зелёный.

## Фаза 5: `TR-NN` и паттерн адаптера (Sonnet)

- [ ] Task: Раздел «UC-адаптер над legacy-фасадом» в `migration.md` (из TR-11: где живёт, как называется, когда уходит)
- [ ] Task: Удалить `TR-NN` из кода (67 в 40 файлах + `runners/u7-bot/tests/e2e/update-replay.e2e.test.ts`); где ссылка объясняла «почему» — «адаптер над legacy-фасадом»
- [ ] Task: Проверка `TR-NN` в коде в строгом режиме `arch:check` (тест — red → green); `runners/*/tests` — в корни
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)

Критерии приёмки: `rg '\bTR-\d+'` по коду (с `runners/*/tests`) — пусто; раздел в `migration.md` есть; записи TR в §6 на месте; `bun run check` зелёный.

## Фаза 6: Комментарии «временная реализация» (Sonnet; новые записи — подтверждение Нурболата)

- [ ] Task: Пройти `rg -i 'временн|уход(ит|ят) с миграц|до миграции|после перехода'` (~73 строки в 53 файлах): для каждого — запись в `debt.md`; нет — черновик записи (Место, Признак) в отчёт на подтверждение; затем комментарий удалить, «почему» оставить
- [ ] Task: Завести подтверждённые записи; ревью reviewer
- [ ] Task: Conductor - User Manual Verification 'Фаза 6' (Protocol in workflow.md)

Критерии приёмки: каждый оставшийся «временн…» — «почему» без признака долга или файл в Месте записи (таблица в `summary.md`); `bun run check` зелёный.

## Фаза 7: Финал (Sonnet)

- [ ] Task: Документы о маркерах: `debt.md` (Правила), шапка `domain-check.ts`, `rules.md` (ARC-02), `.agents-core/roles/tech-lead.md` → `bun run agents:sync`
- [x] Task: Заготовка `roadmap/u7-comments-docs.md`: удалена вместе с кандидатом `[?]` (решение Нурболата, 2026-11-03); часть про Def и генерируемую документацию — в `migration.md` §2, строка 10+ `c84296ac`
- [ ] Task: Сравнение с базовой линией в `summary.md`
- [ ] Task: Conductor - User Manual Verification 'Фаза 7' (Protocol in workflow.md)

Критерии приёмки: `rg 'маркер.*DEBT|// DEBT-<n>'` в `conductor/architecture` и `.agents-core` — только о `biome-ignore`; число тестов ≥ базовой линии; `bun run check` зелёный.
