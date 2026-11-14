# Бриф среза: dmg-core — единая проверка долга и тестовые хелперы (Ф2)

Репо пакета: `~/dev/tools/dmg/dmg-core` (от `ad38a74`, тег `v0.1.1` + 1). Spec — ФР-2, ФР-4, критерии 2–3; plan — Ф2. Черновик — `dmg-tech-lead`, решения — orchestrator (раздел «Решения»).

## Границы

- Пакет: `src/arch/` (новые `debt-checker.ts`, `debt-checker.types.ts`, тест), `src/arch/index.ts`, `src/arch/violation.ts` (`ArchRule` + `ARC-12`); `src/testing/` (`test-trace.ts`, `test-uuid.ts`, `temp-dir.ts`, правка `memory-repo.ts`), `src/testing/index.ts`; `docs/`, `llms.txt`, `debt.md`, `package.json` (версия); удалить `scripts/debt-check.ts` и `scripts/debt-check.test.ts`.
- Не трогать: `ArchChecker` и остальные `src/arch/*`, чужие тесты.
- u7-school — отдельные шаги Ф2 после тега: `#vX.Y.Z` в 11 `package.json`, `scripts/arch-check.ts` на `DebtChecker`, удаление `checkDebt`/`checkTempMarkers`/`checkTrMarkers` из `scripts/domain-check.ts` и их тестов.
- Тег и push — только с подтверждения Нурболата.

## Решения

1. **Класс `DebtChecker`** в `dmg-core/arch` по образцу `ArchChecker` (`src/arch/arch-checker.ts:65,83`): `check(input): Violation[]`, `report(input): string[]`; чистая логика над памятью (`check`) отдельно от диска (`static read`).
2. **Только строгий режим.** `transition` (`domain-check.ts:420`) не переносится; закрытые записи («слит в») не переносятся — закрытая запись удаляется (README долга §1).
3. **Формат долга кода — allowlist** Место / Признак / Корень (`conductor/debt/README.md` §2); ID в коде — только в строке `biome-ignore`. Маркер `// DEBT-n` пакета уходит; открытых записей в пакете нет — правится шапка `debt.md` («Последний выданный ID: DEBT-0»).
4. **ID правила — новый `ARC-12`** («долг учтён: реестры сверены с кодом»): `ArchRule`, `rules.md`. Префикс строк проекта меняется `DEBT:` → `ARC-12:`.
5. **Новые проверки сверх старых** (README их требует): «Погашает» XOR «Триггер» у записи любого реестра; строка «Последний выданный ID» есть и ≥ максимального ID реестра. Негативный тест на каждую.
6. **ID чужих реестров в коде** (`T-DEBT-n`, `D-DEBT-n`): регулярка `(?<![A-Za-z])(?:[A-Z]-)?DEBT-\d+\b`; ID с другим префиксом, чем `idPrefix`, пропускается; голый `DEBT-n` при `idPrefix: 'C-DEBT'` — «нет записи».
7. **Самопроверка временности:** `tempMarkers.skip` (glob). Проект — `['scripts/**']`, пакет — `['scripts/**', 'src/arch/debt-checker*.ts']`. `*.test.ts` в область кода не входят.
8. **`dmg-core/testing`:** `TEST_TRACE` и `testTrace(requestId?)` (свежий след `r-<счётчик>`: отсев повторов D-56 требует разных `requestId` — замена `crypto.randomUUID()`), `testUuid(n)`, `TempDir`/`useTempDir`, `MemoryRepo.where`. Политика `where` (Нурболат, 2026-11-14): `find*` фейка — через `where` (предикат по снимку), если выборка тривиальна; `unanswered` — когда тесту нужен заданный им ответ. Править `testing.md` §4 и `repo.md`.
9. **Версия** — 0.2.0 (расширение `ArchRule`, новая публичная поверхность); подтверждается при теге.

## API (черновик, детали — на авторе)

```ts
export type SourceFile = { readonly path: string; readonly text: string };
export type DebtRegistries = { readonly code?: string; readonly tests?: string; readonly product?: string };
export type DebtCheckerOptions = {
  readonly idPrefix: string; // 'DEBT' | 'C-DEBT'
  readonly tempMarkers?: { readonly skip: readonly string[] };
  readonly registryPaths?: { code: string; tests?: string; product?: string }; // для сообщений
};
export type DebtInput = {
  readonly code: readonly SourceFile[];   // исходники: Признак, ID, временность
  readonly files: readonly string[];      // пути файлов репо (без node_modules, .git, data) — для T-DEBT «Файлы»
  readonly registries: DebtRegistries;
};
export class DebtChecker {
  constructor(options: DebtCheckerOptions);
  check(input: DebtInput): Violation[];   // ARC-12
  report(input: DebtInput): string[];
  static read(root: string, layout: DebtLayout): Promise<DebtInput>; // Bun.Glob
}
```

Вызов проекта: `new DebtChecker({ idPrefix: 'C-DEBT', tempMarkers: { skip: ['scripts/**'] } }).report(await DebtChecker.read('.', LAYOUT))`; `runDebtCheck` в `arch-check.ts` — тонкая обёртка.

**Проверки по реестрам:**
- долг кода (`<idPrefix>-n`): Место, Признак (регулярка, флаг `m`), Корень, ID только в `biome-ignore`, маркеры временности, Погашает XOR Триггер, «Последний выданный ID»;
- `T-DEBT-n`: каждый glob «Файлы» находит ≥1 путь из `files`; Погашает XOR Триггер; дубль ID;
- `D-DEBT-n`: поля Суть, Причина, Критерий снятия; Погашает XOR Триггер;
- все: заголовок с неверным префиксом (например `DEBT-5` в реестре проекта) — ошибка.

## Было → станет

| Аспект | Пакет `scripts/debt-check.ts` | Проект `scripts/domain-check.ts` | Станет |
|---|---|---|---|
| Запись | `### DEBT-<n>`, поля не разбираются | `### C-DEBT-<n>`, Место/Признак/Корень, блоки ``` пропускаются, дубль — ошибка | как в проекте, префикс параметром |
| Маркер в коде | любой `DEBT-<n>` | ID только в `biome-ignore` | как в проекте |
| Связь код ↔ реестр | маркер ↔ запись | Признак в Месте; в Корне вне Места — «долг без записи» | как в проекте |
| Временность | нет | «временное решение»/«уходит с миграцией» (без регистра), «ВРЕМЕННЫЙ» — только в Месте; `scripts/` исключены | как в проекте, исключения — `tempMarkers.skip` |
| `T-DEBT`/`D-DEBT` | нет | нет | есть |
| TR | нет | `checkTrMarkers` | удаляется |
| Результат | `string[]`, `DEBT: …` | `string[]`, `DEBT: …` | `Violation[]`, `ARC-12: …` |

## Сценарии переноса (TST-08)

Из `u7-school/scripts/domain-check.test.ts` (стр. 338–680):
- разбор: «Место списком и строкой, Признак, Корень — без нарушений» (без закрытой), «без Места — ошибка», «без Признака — ошибка», «Признак — неверная регулярка», «Признак с флагом m: ^ — начало строки», «шаблон записи в «Правилах» (`C-DEBT-<n>`) не запись», «запись и поле внутри ``` не разбираются», «пункт под другим полем, после пустой строки и вложенный — не Место», «повторный заголовок — дубль»;
- Место: «glob без файлов — устаревшее место», «признак пропал в одном glob записи с двумя Местами — погашен», «признак есть хотя бы в одном файле glob — не погашен»;
- Корень: «признак в Корне вне Места — долг без записи (файл и строка)», «вне Корня — не ошибка», «Корень без файлов — ошибка», «Корень и Место с {…}», «без Корня — по всем файлам», «импорт вне Места — долг без записи» (нейтральный признак вместо `@u7-scl/core`);
- ID в коде: «голый маркер — ошибка», «упоминание в JSDoc — ошибка», «biome-ignore с ID открытой записи — без нарушений», «biome-ignore с неизвестным ID — ошибка», «старый формат D-<n> не маркер»;
- временность: «`%s` вне Места — ошибка с путём, строкой и подсказкой» (each: «Временное решение», «ВРЕМЕННЫЙ», «Уходит с миграцией»), «фраза в файле из Места — без ошибки», «без учёта регистра», «ВРЕМЕННЫЙ — только заглавными», «маркер в `scripts/*.ts` — не нарушение» (через `skip`).

Из `u7-school/scripts/arch-check.test.ts:60-90` — интеграционный «долг вне Места и неизвестный ID; голый маркер» → в пакет на `DebtChecker.read` + `TempDir`. В проекте остаётся «репозиторий — без нарушений» (`arch-check.test.ts:55`).

Из пакета `scripts/debt-check.test.ts`: «readDebt: в пакете нарушений нет» → самопроверка через `DebtChecker.read`; остальные три покрыты сценариями «погашен» / «долг без записи» / «нет записи».

**Не переносятся:** `checkTrMarkers` (журнала TR нет), переходный режим (2 теста), закрытые записи (3 теста). Список — в `summary.md`.

**Негативные (критерии Ф2):** ID не в реестре; запись без Места/Признака; `T-DEBT` на несуществующий файл; формат `D-DEBT` (нет поля; оба Погашает+Триггер; ни одного); голый `DEBT-n` при `C-DEBT`; временность вне Места; «Последний выданный ID» меньше максимального. Позитив: пустой реестр + код без маркеров — `[]`.

## `dmg-core/testing`

| Что | Сигнатура | Файл |
|---|---|---|
| `TEST_TRACE`, `testTrace` | `TEST_TRACE = Trace.fromRequest({ requestId: 'r-1' })`; `testTrace(requestId?: string): Trace` | `src/testing/test-trace.ts` |
| `testUuid` | `testUuid(n: number, prefix = '00000000'): string` → `<prefix>-0000-4000-8000-<n, 12 hex>`; проходит `F.uuid`; `n` — целое ≥ 0, иначе исключение | `src/testing/test-uuid.ts` |
| `MemoryRepo.where` | `where(predicate: (snapshot: S) => boolean): A[]` — из памяти, порядок вставки | `memory-repo.ts` |
| `TempDir`, `useTempDir` | `class TempDir { static create(prefix?); path; file(...segments); dispose(); [Symbol.dispose]() }`; `useTempDir(prefix?)` — `beforeEach`/`afterEach` | `src/testing/temp-dir.ts` |

Повторы u7-school (база — `summary.md` Ф0): `Trace.fromRequest({ requestId` 46 файлов (`'r-1'` — 18, `crypto.randomUUID()` ≈ 49); `[0-9a-f]{8}-0000-4000-8000` — 153 / 31 файл (базы нет — добавить в Ф4); `mkdtemp` 50 файлов; `unanswered` в фейках — 13 строк / 8 фейков.

## Документы

| Документ | Что |
|---|---|
| `docs/reference/rules.md` | `ARC-12`, «чем проверяется» |
| `docs/reference/testing.md` §4 | хелперы; `where` и `unanswered`; добавить `covers: src/testing/**` |
| `docs/guides/repo.md` (23, 29, 55) | `where` в фейке, `TempDir` вместо `mkdtemp` |
| `docs/concepts/layers.md`, `manifests.md` | сверить (`covers: src/arch/**`) |
| `docs/guides/project.md` (`arch:check`) | подключение `DebtChecker` потребителем |
| `docs/decisions.md` | новая D-запись: единая проверка долга, `idPrefix`, форматы реестров |
| `llms.txt`, `docs/index.md` | хелперы тестирования, учёт долга |
| `debt.md` | шапка под allowlist |

## Сохраняемое поведение

- Код выхода `arch-check.ts` и строки нарушений (кроме префикса `ARC-12:`).
- `MemoryRepo`: `seed/saved/failOn/restored` без изменений; `where` аддитивно.
- Автору: `grep -rn "ARC-11" src --include=*.test.ts` (тест соответствия rules.md ↔ `ArchRule`), тест состава `src/testing/index.ts`, если есть; `grep -rn ArchRule` в u7-school — исчерпывающих `switch` нет.

## Правила

ARC-11 (`src/arch` не импортирует `app`/`graph`), ARC-10, TST-06, TST-07, TST-08, TST-09, TST-10, CODE-04, ARC-12 (новое). Проект: типы в `*.types.ts`, классы вместо хелперов, простые типы.

## Критерии приёмки

1. `bun run check` пакета зелёный; тестов ≥ базы − удалённые `scripts/debt-check.test.ts` + перенесённые + негативные.
2. `grep -rn "checkDebt\|readDebt" src scripts` в пакете пуст; `scripts/debt-check.ts` удалён; пакет проверяет себя `DebtChecker`.
3. Негативные тесты из списка выше.
4. Экспорты: `dmg-core/arch` — `DebtChecker` и типы; `dmg-core/testing` — `TEST_TRACE`, `testTrace`, `testUuid`, `TempDir`, `useTempDir`; `MemoryRepo.where` с тестом.
5. Документы по таблице; `docs:covers` зелёный.
6. u7-school (после тега): `grep -rn "checkDebt\|checkTempMarkers\|checkTrMarkers" scripts/` пуст; `check` и `test:bot` зелёные; число тестов ≥ базы − перечисленные удалённые.

## Риски

- Без `tempMarkers.skip` пакет завалит сам себя — ловит самопроверка.
- `files` для `T-DEBT` — только пути, без чтения содержимого.
- `where` может притянуть логику в фейк — в `testing.md`: только предикат по снимку, корректность выборки — контрактный тест репозитория.
- `data/` не затрагивается.
