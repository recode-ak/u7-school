# Итог трека golden-wish

## Результат
Модуль `wish` переведён на DMG и стал эталоном проекта. Домен — `packages/domain/src/wish`: state на `F.*`, `WishAr` (`create(): Result`, `restore`, `view()`), события и ошибки через `define*`, `WishPolicy`, доменное правило `unique`, `WishFulfillmentDcs`, `WishInvitationDcs`, `WishModuleDef`. Прикладной слой — `packages/wish/src`: 4 UC, 4 ER (`*FromDef`), JSON-репозиторий, UoW, `ModuleFromDef`. Приложение работает на DMG-модуле (`apps/u7-bot/src/create-dmg-modules.ts`), legacy `wish` удалён. Формат `data/wish/` не менялся.

## Гайды
11 гайдов по видам артефактов — guides/ (Job — заготовка, эталона нет). Ссылки гайдов на эталон и ID правил проверяет `scripts/guides-check.test.ts`. Роли агентов и скилл `architecture` ссылаются на гайды.

## Решения
- Решения платформы: D-37…D-44 ([decisions.md](../../architecture/decisions.md)) — внешний модуль, доступ к state, доменное правило vs Policy, межмодульный эффект, связь «UC → UC» и `Facade<M>`, `Caller`, `view()`.
- Тактические: TR-1…TR-23 (debt.md §6) — что временно ради перехода.

## Гейт закрытия
`CI=true bun test`: 3734 pass, 0 fail (388 файлов); `bun run check` зелёный, `arch:check`: нарушений нет. Промежуточных состояний и регрессов нет. `data/` не затронут.

## Отклонения от плана
- Ф12: 67 legacy-тестов `wish` удалены вместе с legacy-кодом — их случаи покрыты тестами DMG UC/ER и домена (TR-21, TR-22).
- Ф13: тест `checkDefs` по модулям домена перенесён из `packages/domain/src` в `arch:check` (TR-23); `archCheck` домена не подключён — DEBT-33.

## Долг
- Погашены: DEBT-21, DEBT-22, DEBT-24, DEBT-31.
- Новые: DEBT-32 (субъект адаптера анкет — entity `User`), DEBT-33 (`archCheck` домена не подключён — ARC-04 платформы не знает подпути `/contract`).
- Остаются: barrel DEBT-23; общие DEBT-1, DEBT-2 — за `user`. Входной долг следующих треков — migration.md §6.

## Открытые вопросы к ревизии
- DEBT-33: открыть подпути `/contract`, `/state` в ARC-04 платформы или перевести домен на импорт через `index.ts`.
- TR-21 п. 4: `update_id` до стори (трек ui-manifests) — уйдёт `warn` в `executeUc`.
- Сверка поведения с `../u7-school-v0.2.6` по «Сохраняемому поведению» брифа slices/wish.md.
