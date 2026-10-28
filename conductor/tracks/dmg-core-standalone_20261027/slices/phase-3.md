# Бриф: Фаза 3 — агентная приёмка

## Прогон 1 (2026-10-28, monorepo, Sonnet)

**Условия:** пустой каталог вне репо, только tarball `dmg-core-0.1.0.tgz` (`bun pm pack`), доступ к `/home/nur/dev` запрещён. Задача: monorepo, модуль `todo`, агрегат `Task`, UC `create`, вызов через CLI-раннер, `check` зелёный.

**Итог:** `check` зелёный (33 теста, 0 нарушений `arch:check`), раннер вызвал `todo.create` и записал задачу в `data/task.json`. Каркас `init --profile monorepo` зелёный сразу после `bun install`.

**Читал:** `llms.txt` → `guides/project.md` → `guides/app.md` → `naming.md` §5 → `guides/aggregate.md`, `guides/use-case.md` → образцы `src/testing/example/` (todo/task, app/todo, runner/example-cli.ts, expect-result.ts). Не открывал: `rules.md`, `layers.md`, `testing.md`, `errors-result.md`, скил, агенты.

### Где застрял

1. `tsc`: `Property 'deps' does not exist on type 'CreateUc'`. Правильно — `this.resolve.<repo>`; в `use-case.md` §3 этого нет, нашёл только в образце.
2. `arch:check`: `MAN-06: событие todo.task.completed никто не публикует`. Правила нет ни в `aggregate.md`, ни в чек-листе `project.md`. Решил вторым UC `complete`.

### Угадал или додумал

| # | Пробел | Где не хватило | Вид |
|---|---|---|---|
| G1 | `this.resolve.<имя>` в UC | `guides/use-case.md` §3 | док |
| G2 | сигнатура `execute(input, loaded, uow, caller)`; в заготовке `execute()` без параметров | заготовка `gen uc`, `use-case.md` | каркас/док |
| G3 | `callers: ['user']` в заготовке, а CLI каркаса даёт гостя (знал из ловушек `project.md` §7) | заготовка `gen uc` | каркас/док |
| G4 | код ошибки `<префикс ErrorDef>_<ключ>` для `expectErr` | `errors-result.md`/`testing.md` не открывал — проверить | док |
| G5 | MAN-06: каждое событие эмитит какой-то UC | `aggregate.md`, чек-лист `project.md` | док |
| G6 | `gen uc` всегда пишет `emits: [<A>Events.created]` (`src/gen/kinds/operation.ts:134`) — для `complete` молча неверно | генератор | каркас |
| G7 | схемы `input`/`output` из `TaskState.entries.<поле>` | `use-case.md` | док |
| G8 | ключ и путь репозитория в `app.ts` после `gen aggregate` (подсказки нет) | `project.md` §4, вывод `gen aggregate` | каркас/док |
| G9 | `Identified` в заготовке против `ExampleUser` в образце | `use-case.md`/`module.md` | док |
| G10 | команда раннера: TODO в заготовке вместо минимального кода | каркас раннера, `project.md` §4 п.3 | каркас/док |
| G11 | где можно брать uuid (в Ar нельзя, в UC образец — `crypto.randomUUID()`) | `aggregate.md`/`use-case.md` | док |

### Расхождения

- R1: вывод `gen module` — «package.json корня сборки» (`src/gen/kinds/app-module.ts:108`), а нужен `app/package.json`; `project.md` точнее.
- R2: дочерние `package.json` с `"dmg-core": "^0.1.0"` держатся на `overrides` с абсолютным путём к tarball — при переезде tarball правка руками (известно, решение 2026-10-28; упомянуть в `project.md`?).
