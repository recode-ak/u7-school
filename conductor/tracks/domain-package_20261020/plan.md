# Plan: domain-package_20261020

Трек #3 из [migration.md](../../architecture/migration.md). Перенос механический, поведение не меняется. TDD здесь означает: **тесты-стражи (проверки `arch:check`, долг) пишутся до переноса и красные**, перенесённые тесты модулей остаются зелёными. `bun run check` зелёный после каждой задачи.

**Правила переноса (для каждого модуля, бриф `migrator`):**
- `git mv` кода и тестов в `packages/domain/src/<m>/`, история сохраняется; логика не правится, только импорты.
- В `packages/<m>/src/domain/index.ts` остаётся barrel-реэкспорт (долг `D-<n>`).
- Импорты `@u7-scl/app`/`@u7-scl/core` остаются как есть, но каждый помечается `// DEBT(<id>)`, заносится в allowlist и в `debt.md`.
- Перед стартом модуля `migrator` читает `debt.md` и этот план; по завершении обновляет их.

## Фаза 1: Страховка — проверки и реестр долга

- [x] Task: Завести `debt.md` (шаблон записи: ID, место, причина, погашающий трек, критерий снятия; группы долга по спеке Ф4)
- [x] Task: Тесты-стражи Ф3 в `arch:check` (red на фикстурах-нарушителях): импорты между `domain/<m>` по `dependsOn` и без циклов; `domain` не импортирует `packages/<m>`, `ui`, `infra`, `apps`
    - [x] Реализовать проверки до green
- [x] Task: Проверка долга: сверка маркеров `DEBT(<id>)` в коде ↔ allowlist `app`/`core` в домене ↔ `debt.md` (red на рассинхроне в обе стороны; allowlist только уменьшается)
- [x] Task: Подтвердить `dependsOn` графа модулей (user ← course, questionnaire ← stream ← wish, peer-review) и порядок переноса; расхождение — вопрос пользователю
- [x] Task: Шаблон брифа `migrator` на модуль (в `debt.md` или треке): правила переноса, чеклист, формат записи долга
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md)

## Фаза 2: user (+ `User` из `app`)

- [x] Task: Инвентаризация: `domain/` модуля `user` (21 + 2 теста), `User` в `app`, внешние потребители; зафиксировать в `debt.md`
- [x] Task: Перенести `domain/` в `packages/domain/src/user/`; подпути `.`, `./state`; barrel в `packages/user/src/domain`
- [x] Task: Перенести `User` из `app` в `domain/user`; в `app` реэкспорт (долг)
- [x] Task: Каркас `@u7-scl/domain/user/contract` (реэкспорт фасада, событий, ошибок, если они есть)
- [x] Task: Записать долги модуля, `bun run check` зелёный
- [x] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: course и questionnaire

> Заметки к старту (по итогам Ф2): `course` — 73 файла, импортирует `@u7-scl/user/domain` (28 раз → `@u7-scl/domain/user`), `core/domain|shared|infra`, `app/domain`, алиасы `#domain-legacy/status`, `#domain-legacy/module/entity`. `questionnaire` — 35 файлов, `user/domain` ×2, `core/*`, `app/domain` ×2. Следующие ID долга — с D-6. Бриф — по обновлённому `slices/_template.md`; потребители внутри пакета (`api`/`infra`) правятся по алиасу. Перед вызовом агента: `git status --short` и замер числа тестов модуля.

- [x] Task: `course` (55 + 18): перенос по правилам, barrel, `contract`, долги (`7c61714c`)
- [x] Task: `questionnaire` (27 + 8): перенос по правилам, barrel, `contract`, долги (`081baabb`)
- [x] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: stream, wish, peer-review

> Заметки к старту (по итогам Ф3): следующие ID долга — с D-16. Образцы брифов — `slices/course.md`, `slices/questionnaire.md`. Порядок: `stream` → `wish` → `peer-review` (peer-review зависит от stream). Замеры до переноса (`bun test packages/<m>/src/domain`): `stream` — 220 pass, 10 тест-файлов, 31 файл кода; `wish` — 40 pass, 4, 13; `peer-review` — 99 pass, 8, 27. Импорты: `stream` — `core/api` ×13 (новый подпуть: тоже D-<n>), `core/domain|shared`, `app/domain` ×3, `course/domain` ×12 и `user/domain` ×6 (→ `@u7-scl/domain/<dep>`), алиасы `#domain-legacy/stream/policy`, `#domain-legacy/status`; `wish` — `course|questionnaire|user|stream/domain` (→ `@u7-scl/domain/<dep>`), `core/domain|shared`, `app/domain`; `peer-review` — `core/api` ×7, `core/domain|shared`, `user`, `stream`, `app/domain`. Каждый долг ставит оркестратор до вызова агента; линтерные нарушения (DOM-12 `v.isoDateTime`, CODE-02 `#private`) мигратор помечает `biome-ignore … (долг не заведён)`, оркестратор заменяет на `DEBT(D-<n>)`. Маркер многострочного импорта — комментарием в конце строки `from`. После агента удалять пустые каталоги в старом `domain`. Правка `biome.json` (`!@u7-scl/domain/**`) уже сделана в Ф3.

- [x] Task: `stream` (31 + 10): перенос по правилам, barrel, `contract`, долги (`45149ee0`)
- [x] Task: `wish` (13 + 4): перенос по правилам, barrel, `contract`, долги (`c9797fd4`). Блок «Входной долг» для `golden-wish` оформляется в Ф5 (задача «Передача контекста»)
- [x] Task: `peer-review` (27 + 8): перенос по правилам, barrel, `contract`, долги (`4e7601ec`)
- [x] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: dossier, документация, передача контекста

> Заметки к старту (по итогам Ф4): следующие ID долга — с D-30 (занято D-1…D-29). `dossier` — плоский пакет без `domain/`: `packages/dossier/src/{categories,scores}.ts` + 2 теста (14 pass до переноса), из внешних — только `valibot`, импортов `core|app` нет (долг по core не нужен; barrel — новый D-30; возможно линтерные D-31+ после отчёта). `dependsOn: []`; потребителей `@u7-scl/dossier` в коде нет, кроме комментария в `domain/peer-review/peer-review-question-pool.ts` и правил `biome.json` (ARC-06 для course/dossier — проверить, что пути `packages/dossier/**` остаются верными). Корень `packages/dossier/src/index.ts` станет barrel. Реестр на конец Ф4 — D-1…D-29. Владельцы долга для итогового реестра: Def-перевод модулей — `golden-wish` (wish: D-21, D-22, D-23, D-24 + общие D-1, D-2 по core) и последующие треки (user D-5, course D-9/D-10, questionnaire D-14/D-15, stream D-19/D-20, peer-review D-28/D-29); core/app-долги (D-1, D-2, D-6, D-7, D-11, D-12, D-16, D-17, D-21, D-22, D-25, D-26) — `dmg-core-extract` Ф4; barrel-долги (D-3, D-8, D-13, D-18, D-23, D-27, D-4) — последний трек миграции. Трек `golden-wish` ещё не заведён (в `conductor/tracks/` его нет) → «Входной долг» оформить пометкой в `migration.md`. Образцы брифов: `slices/stream.md`, `slices/wish.md`, `slices/peer-review.md`. Приёмы: `api/errors.ts`, на который ссылается домен, переносится в домен с реэкспортом `// DEBT(D-<barrel>)`; удалять `#domain-legacy/*` из `package.json` пакета; после агента — пустые каталоги; `biome-ignore … (долг не заведён)` заменять на `DEBT(D-<n>)` (grep «долг не заведён»). Гейт закрытия трека: сверка числа тестов с исходным (3211 pass на конец Ф4).

- [x] Task: `dossier` (отдельный пакет, 2 файла + тесты): перенести в `domain/dossier`, barrel в старом пакете, долги [c13b10c3]
- [ ] Task: Документация (Ф5): раздел «Состояние переноса» в `migration.md`, ссылка на `debt.md` в строке трека, правки `legacy.md` §6 при необходимости
- [ ] Task: Передача контекста: блок «Входной долг» в spec/plan `golden-wish` (если трек уже заведён) или пометка в `migration.md`; в `dmg-core-extract` Фаза 4 ссылка на готовые каркасы `contract`
- [ ] Task: Гейт закрытия трека по `workflow.md`: `CI=true bun test` по репозиторию, триаж красных, сверка числа тестов с исходным, `summary.md` трека (pass/fail, итоговый реестр долга с владельцами)
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)
