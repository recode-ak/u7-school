# Итог трека dmg-core-oop_20261027

## Базовая линия (2026-10-27, до начала работ, `48f2e13a`)

| Прогон | pass | fail | файлов |
|---|---|---|---|
| `CI=true bun test` (весь репозиторий) | 3981 | 0 | 423 |
| `CI=true bun test` в `platform/dmg-core` | 709 | 0 | 83 |

## Фаза 1: ревью reviewer (2026-10-27)

Замечаний `error` нет. Исправлено: `AnyDomainRule`/`AnyRulesDef` — через `DefOf`, как у остальных видов; в `AggregateDef` убран промежуточный тип с `never`, переходы нормализуются внутри `normalize()` (без публичного `normalizedTransitions`); тесты типов `make`/`err` у `ErrorDef`, своя ошибка и контравариантность `check` у `DomainRuleDef`; удалён неиспользуемый `buildErrors`; `normalize.ts` — общая ветка делегирования; комментарий прототипа (замена в Фазе 3); `manifests.md` — `schemas()`/`texts()`; D-40 — ссылка на новый DSL.

Оставлено сознательно: стиль импортов (в `kernel` — относительные, в `domain` — `#core/…`, как в пакете); `add(...)` в `describedDefs` уйдёт в Фазе 3; публичный экспорт `Def`/`DefOf` — по потребителю (хеш контракта, документация).

## Фаза 2: ревью reviewer (2026-10-27)

Замечаний `error` нет. Исправлено: DOM-05 в `rules.md` — на `Rule.of`; комментарий `allowAll`; тест типов пересечения субъекта и контекста у `Rule.anyOf` (не только через обёртку `anyOf`, которая уйдёт в Фазе 7).

Оставлено сознательно:
- `allowed`/`denied` — значения-утилиты `Decision`, как `ok`/`err` у `Result` (спека, «За рамками»): решение политики — не правило, в иерархию `Rule` не входит. Спека п.3 перечисляет `denied` среди заменяемого, но иерархия заменяет только конструкторы правил.
- `RuleNode` удалён из экспорта без обёртки: это была структура правила, её заменил класс `Rule`; потребителей в репо нет.
- Повтор полей `name`/`label`/`denyMessage` в `NamedRule` и `AnyOfRule` — три поля; промежуточный класс ради них — лишний уровень иерархии.

## Фазы 3–7 (2026-10-27)

- **Фаза 3:** `OperationDef` и виды операций, `ModuleDef`; `normalize`/`describe` без `switch`; контрактный тест `kind-switch.test`.
- **Фаза 4:** `DefIndex.from(roots)`, `Violation.format()`, `ArchChecker` (`DefChecker` + `FileChecker`), `ArchChecker.defsOf(roots).report()` для тестов модулей.
- **Фаза 5:** шаблоны генератора — `OperationTemplate` → `UseCaseTemplate`/`ReactionTemplate`/`JobTemplate`, таблица планировщиков; шаблоны в `gen`, не в Def (решено с Нурболатом). Вывод генерации не изменился (побайтная сверка).
- **Фаза 6:** `Lock`, `VersionedRepository` (D-36), `MemoryLogger`/`RecordingBus`/`MemoryBus`.
- **Фаза 7:** весь репозиторий на `XxxDef.define`, обёртки `define*` удалены; `Declared` — один тип; документация, D-48; бриф трека удалён.

## Финал: гейт качества (2026-10-27)

| Прогон | pass | fail | файлов |
|---|---|---|---|
| `CI=true bun test` (весь репозиторий) | 4107 | 0 | 441 |
| `CI=true bun test` в `platform/dmg-core` | 835 | 0 | 101 |
| `tsc --noEmit` | зелёный | | |
| `biome check` | 0 ошибок | | 56 предупреждений — как до трека, в чужом коде |
| `arch:check` | нарушений нет | | |

Триаж: красных тестов нет — промежуточных состояний и регрессов нет. Рост против базовой линии: +126 тестов по репо, +126 в `dmg-core` (тесты классов, типов, `kind-switch`, двойников, репозитория).

Тесты не исчезли: удалённых без переноса тестовых файлов нет. Переименованы с сохранением сценариев (сверено ревью фаз): `check-defs.test` → `def-checker.test`, `check-files.test` → `file-checker.test`, `arch-check.test` → `arch-checker.test`, `define-errors.test` → `error-def.define.test`, `define-events.test` → `event-def.define.test`, `domain-rule.test` → `domain-rule-def.define.test`; тесты обёрток переведены на API классов; прототип Фазы 0 — сценарии в `use-case-def.test`.

Критерии приёмки спеки:
- В `graph`, `arch`, `gen` нет `switch` по `dmg`/`op`/`kind` — `kind-switch.test`; исключение — сравнения `args.kind === 'module'|'aggregate'` в `gen/validate.ts` (проверка ввода CLI, описано в тесте).
- `bun test`, `tsc`, `biome`, `arch:check` — зелёные.
- Тесты типов п.2 — `def-types.test`, тесты типов видов.
- Гайды `dmg-core/docs`, `llms.txt`, `conductor/architecture/` обновлены; `TRACK-DMG-CORE-OOP.md` удалён.
