# Генератор в проекте

**Назначение:** как генератор пакета работает в u7-school. Сокращения, структура, имена и сам генератор — документация платформы [naming.md](../../node_modules/dmg-core/docs/reference/naming.md) (генератор — §5).

---

## Команда и раскладка

`bun run gen …` проекта — это `dmg-core gen …` из документации пакета. Раскладка — секция `gen` в [`dmg-core.json`](../../dmg-core.json):

| Поле | Значение в проекте |
|---|---|
| `domain` | `domain/src/{m}` |
| `app` | `modules/{m}/src` |
| `domainImport` | `@u7-scl/domain/{m}` |

Она совпадает с `layout` приложения домена `DomainArch` (`scripts/domain-arch.ts`). Меняешь одно — меняй и другое; расхождение ловит приёмка `scripts/gen-e2e.e2e.ts` (`bun run gen:e2e`, шаг `check`; срез `genprobe` в настоящих каталогах → biome, tsc, тесты, `ArchChecker`).

## Новый прикладной пакет

Генератор пишет только исходники. Для нового модуля пакет `modules/<m>/` заводится руками до `gen module`:

- `package.json`: `name` — `@u7-scl/<m>`, `private: true`, `type: module`, `module`/`exports` — `src/index.ts`, `scripts` как у соседних пакетов (`test`, `lint`, `tslint`, `format`, `check`), зависимости `@u7-scl/domain` и `dmg-core` — `workspace:*`;
- `tsconfig.json`: `{ "extends": "../../tsconfig.json", "compilerOptions": {} }`;
- `src/index.ts`: `export { create<M>Module, type <M>Deps } from './<m>.module';`.

Затем `bun install` и `bun run gen module <m> --write`.

Вход модуля домена для других — `contract.ts` (D-45): генератор его не создаёт, он пишется по образцу `domain/src/wish/contract.ts`. Второй вход — `testing.ts` (D-70): фикстуры владельца для тестов зависимых (`@u7-scl/domain/<m>/testing`), импортирует только тестовый код; образец — `domain/src/user/testing.ts`.
