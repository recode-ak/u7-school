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
- [~] Task: `questionnaire` (27 + 8): перенос по правилам, barrel, `contract`, долги
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: stream, wish, peer-review

- [ ] Task: `stream` (31 + 10): перенос по правилам, barrel, `contract`, долги
- [ ] Task: `wish` (13 + 4): перенос по правилам, barrel, `contract`, долги. Блок «Входной долг» для `golden-wish` (Ф4 спеки) — какие записи он обязан погасить
- [ ] Task: `peer-review` (27 + 8): перенос по правилам, barrel, `contract`, долги
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: dossier, документация, передача контекста

- [ ] Task: `dossier` (отдельный пакет, 2 файла + тесты): перенести в `domain/dossier`, barrel в старом пакете, долги
- [ ] Task: Документация (Ф5): раздел «Состояние переноса» в `migration.md`, ссылка на `debt.md` в строке трека, правки `legacy.md` §6 при необходимости
- [ ] Task: Передача контекста: блок «Входной долг» в spec/plan `golden-wish` (если трек уже заведён) или пометка в `migration.md`; в `dmg-core-extract` Фаза 4 ссылка на готовые каркасы `contract`
- [ ] Task: Гейт закрытия трека по `workflow.md`: `CI=true bun test` по репозиторию, триаж красных, сверка числа тестов с исходным, `summary.md` трека (pass/fail, итоговый реестр долга с владельцами)
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)
