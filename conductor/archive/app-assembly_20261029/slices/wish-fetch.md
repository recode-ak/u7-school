# Бриф среза: вызовы чужих модулей `wish` — в `fetch` (D-58, API-07)

Читай до старта: D-58 в `node_modules/dmg-core/docs/decisions.md`; гайд `node_modules/dmg-core/docs/guides/use-case.md` (§3 «Устройство реализации», §7 ловушки, §8 тесты). Образец — учебный `assignTask`: `node_modules/dmg-core/src/testing/example/app/todo/task/uc/assign-task.uc{,.test}.ts` (`load` — задача, `fetch` — ответ `users`, пятый параметр `UseCaseFromDef<…, Fetched>`, `override`).

## Границы

- Прикладной слой: `modules/wish/src/wish/uc/create-course-wish.uc.ts`, `create-module-wish.uc.ts` и их тесты.
- Не трогать: домен (`domain/src/wish/**` — Def, правила, Policy не меняются), другие UC и модули, `biome.json`, `data/`, `node_modules/dmg-core`.

## Решения брифа

- Policy обоих UC — `allowAll`: ответ модуля курсов Policy не нужен, поэтому `this.call(GetCourseEnrollmentUcDef | GetModuleEnrollment…)` уходит из `load` в `fetch` (сейчас это нарушение API-07 — `bunx biome lint modules/wish`).
- `load` — свои данные: `courseId`/`moduleId`, `userId` (субъект), `target`, `wishes` из репозитория. `fetch` — `{ enrollment }` (ответ модуля курсов); ошибка вызова возвращается как есть. Тип `Loaded` делится на `Loaded` и `Fetched`; `execute` получает `Loaded & Fetched` (если использует только `Loaded` — типизируй параметр так, как нужно).
- Вызов `StartQuestionnaireUcDef` в `execute` не трогаем (это не `load`).
- Поведение для пользователя не меняется: те же ответы и коды ошибок.

## Шаг — api-author

- Red уже есть: `bunx biome lint modules/wish` — API-07 в обоих UC. Новых тестов не нужно: при `allowAll` порядок «Policy → `fetch`» снаружи не наблюдаем, поведение покрыто существующими тестами.
- Перенеси вызовы в `fetch`; green — lint без API-07 и зелёные тесты. Существующие тесты не меняй.

## Критерии приёмки

- `bunx biome lint modules/wish` — без API-07.
- `bun run scripts/agent-gate.ts` зелёный.
- Существующие тесты `wish` не изменены и зелёные.

## Отчёты

### api-author (Sonnet)

Вызовы `GetCourseEnrollmentUcDef`/`GetModuleEnrollmentUcDef` перенесены из `load` в `fetch` (`override`); `Loaded` — свои данные (контекст `unique`), `Fetched` — `{ enrollment }` (контекст `courseEnrollable`/`moduleEnrollable`); `execute` не менялся. Тесты не менялись: `bun test modules/wish` — 129 pass. Lint без API-07, гейт зелёный. По ревью — JSDoc `Loaded`/`Fetched`.

### Ревью — reviewer (Opus), вся Фаза 1 (пакет + срез)

Без `error`. Warning: D-58 и гайд расходились с кодом (`ok({})` vs `unknown`, ловушка §7), устаревший JSDoc `Loaded` в `wish` — исправлено (dmg-core `c8d0e93`, автор). Note: `this.call<T>` и фикстуры с аргументами — закрыто; мёртвый `UseCaseRulesContextOf` — удалён; пометки в D-40/D-43 — добавлены; `merge` и «`F` без `fetch`» — TR-32. Question `biome.json` — правка оркестратора (TR-32).
