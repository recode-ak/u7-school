# Бриф среза: dossier (Ф1) — `dossier` на Def без поведения, DEBT-3, DEBT-34

Черновик `dmg-tech-lead` (Sonnet). Трек `legacy-removal_20261112`. Раскладка «файл → куда» — в [removal.md](./removal.md); строки этого брифа: `platform/app/src/u7-app.ts` (фабрика), тест `platform/app/tests/u7-app.test.ts` (граф).

## Границы

Правим:
- `domain/src/dossier/dossier.module.ts` (снять `external`, JSDoc, `description`); `contract.ts`, `index.ts`, `state.ts`, `categories*.ts`, `scores*.ts` — не трогать.
- `modules/dossier/`: `src/dossier.module.ts` (новый), `src/dossier.module.test.ts` (новый), `src/index.ts` (вход вместо реэкспорта домена), `package.json` (+ `dmg-core`), `README.md` (Opus).
- `platform/app/src/u7-app.ts` — фабрика `dossier` в `dmgApp`; `platform/app/package.json` — `"@u7-scl/dossier": "workspace:*"` (workspace-ссылка, не новая npm-зависимость).
- `scripts/domain-check.ts`, `scripts/arch-check.ts`; тесты `scripts/{arch-check,domain-check}.test.ts`.
- `conductor/architecture/debt.md` — только DEBT-3 и DEBT-34 (Opus, см. шаг 4).

Не трогаем: другие модули, `core/*`, `app-legacy`, `u7-cli`, `data/`, `biome.json`, `domain-arch.test.ts`, `agent-gate.test.ts`.

## Решения брифа

Принято по образцу (`wish`, `peer-review`, учебный модуль):

1. **`modules/dossier/src/index.ts` остаётся входом пакета**, но не barrel домена: `export * from './dossier.module';`. Корень сборки берёт фабрику только через вход (ARC-07; `exports['.']` пакета). Критерий spec «barrel удалён» читать как «реэкспорт домена удалён» (см. «Расхождения» в removal.md).
2. **Пустой модуль по образцу `wish.module.ts`**: `DossierDeps = ModuleDeps` (репозиториев нет); `dossierMap = { useCases: {}, reactions: {}, jobs: {} } satisfies ModuleMap<typeof DossierModuleDef, DossierDeps, Identified>` (API-05); `createDossierModule(deps)` → `new ModuleFromDef<typeof DossierModuleDef, DossierDeps, Identified>(DossierModuleDef, dossierMap, deps)`. Заготовка — `bun run gen module dossier` (dry-run, затем `--write`; флаг `--adopt` — если генератор требует: Def уже есть), руками — только `label`/`description`.
3. **`description` Def (черновик, окончательный текст — Opus вместе с README):** «Агрегация фактов об учёбе студента (peer-review, sessions, stream) в досье; предъявление — модуль passport. Пока — только схемы навыков (категории, баллы); агрегатов, UC, ER и Job нет.» JSDoc: снять «внешний модуль (D-37) … legacy-кодом», оставить «Модуль-заготовка: поведения нет».
4. **`DomainModules` упраздняется**: после снятия `external` все модули на Def, поле `dmg` лишнее. `checkContractImports(files, modules: readonly string[])` — имена всех модулей; ветка «пары legacy-модулей» (`dmg = includes(other) || includes(own)`) удаляется — проверка всегда блокирующая. `arch-check.ts:110-113`: `modules = DOMAIN_MODULES.map((m) => m.name)`.
5. **`index` как публичный вход снимается** в обоих местах `checkDomainImports` (`domain-check.ts:66` и `:89`): публичны только `contract` и `testing` (`PUBLIC_SUBPATHS`); текст нарушения — «только через contract» (без «или index»).
   - **Вариант A (рекомендую):** корень чужого модуля без подпути (`'../user'`, `'@u7-scl/domain/user'`) — тоже нарушение ARC-04 (D-45: чужой модуль только через `contract`); `checkContractImports` уже блокирует пакетную форму, относительная форма в домене не встречается (проверено grep `from '\.\./<модуль>'` по `domain/src`).
   - **Вариант B:** снять только подпуть `index`, корень без подпути оставить допустимым (минимум правки). Выбор между A и B не стратегический; при красном `arch:check` после A — откат к B с записью в TR.
6. **Порядок закрытия долга.** `checkDebt` краснеет, как только признак погашен, а запись открыта («долг погашен: сними glob или закрой запись»): признак DEBT-3 `export \* from '@u7-scl/domain/` и DEBT-34 `sub !== 'index'` исчезают на шаге 2. Поэтому закрытие DEBT-3/DEBT-34 в `debt.md` делается orchestrator'ом **сразу после шага 2 и до гейта**, а не после (в плане задача README+DEBT стоит после migrator — порядок гейта уточнить).
7. **Платформенный риск (R1).** Пустой `ModuleDef` без `external` может не пройти `ArchChecker.defsOf(DOMAIN_MODULES).report()` (проверки `DefChecker` по агрегатам, MAN-06 снимается вместе с `external`). Если красное — эскалация migrator'а в `dmg-tech-lead`/orchestrator; правка `dmg-core` вне границ этого среза.

## Шаги

1. **`dmg-test-designer` (Sonnet; не flash — 25 дефектных тестов у flash, `deepseek.md` §2)** — red:
   - `modules/dossier/src/dossier.module.test.ts` (1–2 теста, TST-09): модуль собирается из `testAppContext()` без репозиториев; `module.def === DossierModuleDef`; набор UC/ER/Job пуст. Состав Def руками не повторять (один тест «состав»: UC = `[]`).
   - `scripts/arch-check.test.ts`: тест «граф dependsOn домена» — убрать «внешний dossier» из названия и `toContain('dossier')`; вместо цепочки `not.toContain(...)` — `expect(DOMAIN_MODULES.filter((m) => m.external)).toEqual([])`.
   - `scripts/domain-check.test.ts`: правки перечислены в «Сохраняемом поведении».
   - `platform/app/tests/u7-app.test.ts`: тест «граф приложения содержит `dossier`» — **не добавлять** (дубль `modules.dossier.test` и `arch:check`, TST-08); `createDossierModule` в `U7App` проверит существующий smoke сборки.
2. **`migrator` (flash)** — green: Def, модуль пакета, `index.ts`, `package.json` (+ `"dmg-core": "file:../../../../tools/dmg/dmg-core"` — как у `wish`), фабрика в `u7-app.ts` (`{ def: DossierModuleDef, create: (deps) => createDossierModule(deps) }`, импорт `DossierModuleDef` из `@u7-scl/domain/dossier/contract`, `createDossierModule` из `@u7-scl/dossier`), `domain-check.ts` (п. 4–5), `arch-check.ts`; `bun install` (workspace-связь). Flash уместен: тесты держат поведение, правка скриптов проверяется 64 тестами `domain-check.test.ts`. Отдельной строкой в «Готово»: «тест кажется неверным — не правь, опиши»; «не ослаблять проверки в `domain-check.ts`» — `git diff --numstat` покажет удалённые строки.
3. **Гейт (orchestrator):** `bun run scripts/agent-gate.ts`, grep-критерии ниже. Затем закрыть DEBT-3, DEBT-34 (п. 6).
4. **Opus:** `modules/dossier/README.md` (назначение; источники фактов — peer-review, sessions, stream; связь с `passport`; ссылка на `conductor/roadmap/metrics/peer-review-system.md`; «пустой модуль: схемы `categories`/`scores` в `domain/src/dossier`»), окончательный `description`, записи DEBT-3/DEBT-34 → закрыты (строкой «погашен, `legacy-removal` Ф1», как у DEBT-6…).
5. **`dmg-reviewer` (Opus).**

## Было → станет

| Было | Станет | Ссылка |
|---|---|---|
| `DossierModuleDef`: `external: true`, JSDoc «внешний модуль» | без `external`; `description` — текущее понимание | `domain/src/dossier/dossier.module.ts:3-14` |
| `modules/dossier/src/index.ts`: `export * from '@u7-scl/domain/dossier'` | `export * from './dossier.module'` | `modules/dossier/src/index.ts:1` |
| фабрики модуля нет | `modules/dossier/src/dossier.module.ts`: `DossierDeps`, `dossierMap`, `createDossierModule` | образец `modules/wish/src/wish.module.ts:21-53` |
| `U7App.dmgApp`: 6 фабрик | 7: + `DossierModuleDef` | `platform/app/src/u7-app.ts:209-253` |
| `DomainModules {all, dmg}`; `checkContractImports` пропускает пары legacy | `readonly string[]`; все модули блокируются | `scripts/domain-check.ts:149-195` |
| `crossModule`/относительный путь: `sub !== 'index'` | только `contract`/`testing` | `scripts/domain-check.ts:66, 89` |
| `arch-check.ts`: `dmg: DOMAIN_MODULES.filter(!external)` | убрано | `scripts/arch-check.ts:110-113` |
| DEBT-3, DEBT-34 открыты | закрыты | `conductor/architecture/debt.md:72-79, 183-189` |

## Сохраняемое поведение

- Для пользователя бота ничего не меняется: `dossier` — пустой модуль, UC/ER/Job/событий нет; `U7App` отдаёт тот же `apiApp`.
- Тесты, закрепляющие состав модулей и граф (грепом по `*.test.ts`):
  - `scripts/arch-check.test.ts:51-62` — граф (`dossier: []`) и `external` (ожидание `toContain('dossier')` — **меняется**); `:36-42` `assemblyPackages` (на Ф1 не меняется — `@u7-scl/cli` уйдёт в Ф6).
  - `scripts/domain-check.test.ts`: `:20-29` «через index — без нарушений» (**меняется** по п. 5: A — теперь нарушение; B — остаётся); `:44, :66` тексты «только через contract или index» (**меняются** на «только через contract»); `:141-152` и `:270-272` фикстура `{all, dmg}` (**меняется** на массив); `:298-309` «модуль на Def импортирует чужой legacy» (удалить как дубль следующего кейса: legacy-модулей нет); `:332-336` «пары legacy-модулей не проверяются» (**удалить**: поведения нет).
  - `scripts/domain-arch.test.ts` — раннеры (`u7-cli` ещё на месте), на Ф1 не меняется. `scripts/agent-gate.test.ts` — не затронут (ws-фикстуры).
- Вне границ: тестов, перечисляющих модули `U7App`, нет (проверено grep `createUserModule|factories` по `*.test.ts`).
- Данные `data/` не затрагиваются; форматов нет.

## Внешние зависимости

- `dmg-core`: `ModuleDef`, `ModuleFromDef`, `ModuleDeps`, `ModuleMap`, `Identified`; `dmg-core/testing`: `testAppContext`.
- `dependsOn: []` — связей нет и не добавляется.
- Входящих событий и адаптеров нет.

## Открытые вопросы

Стратегических нет.

Тактические (предлагаемое решение):
1. A или B из п. 5 — **A**, откат на B при красном `arch:check` (с TR).
2. `biome.json` `platform/app/src/**`: нет строки ARC-07 для `@u7-scl/dossier/**`, как у остальных пакетов — **не добавлять** (у пакета нет подпутей; правка вне среза).
3. `bun install` меняет `bun.lock` (workspace-ссылка) — ожидаемо, не регресс.

## Правила (ID `rules.md`)

MAN-01 (label/description), MAN-06 (снятие `external`), MAN-10, API-05 (карта Def → класс), ARC-04 (только `contract`), ARC-06, ARC-07 (корень берёт пакет через вход), TST-06, TST-08 (дублей не плодить), TST-09 (один тест состава, платформу не тестируем), CODE-04 (комментарии).

## Документы

Срез не правит `dmg-core`. Проектные: `modules/dossier/README.md` (Opus); `conductor/architecture/debt.md` — DEBT-3, DEBT-34; `architecture/migration.md`/`rules.md` (ARC-04: «пары legacy-модулей — по долгу» → удалить фразу) — в Ф7, не здесь.

## Критерии приёмки

- `grep -rn "external" domain/src/dossier` — пусто.
- `grep -n "sub !== 'index'" scripts/domain-check.ts` — пусто; `grep -n "dmg:" scripts/arch-check.ts scripts/domain-check.ts` — пусто.
- `grep -n "@u7-scl/domain" modules/dossier/src/index.ts` — пусто (и во всём `modules/dossier/src`, кроме `dossier.module.ts`, который импортирует `@u7-scl/domain/dossier/contract`).
- `bun run arch:check` — зелёный; `dossier` в `ArchChecker.defsOf(...)` как обычный модуль; DEBT-3 и DEBT-34 закрыты в `debt.md`.
- `bun run check` зелёный; число тестов не ниже базовой линии Ф0 (+1…2 нового `dossier.module.test.ts`, −2 удалённых в `domain-check.test.ts` по списку выше; удалённые перечислены в отчёте).
- `bun test modules/dossier scripts/domain-check.test.ts scripts/arch-check.test.ts` — зелёный.
