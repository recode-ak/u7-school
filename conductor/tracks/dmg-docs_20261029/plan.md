# Plan: dmg-docs_20261029

Каждая фаза — отдельная сессия. Код — TDD (red → запуск → green). Правки пакета — коммит в `~/dev/tools/dmg/dmg-core` (зелёные `check` и `e2e`), затем в u7-school `bun install`, `dmg:sync`/`agents:sync` при изменении доставляемых файлов, `check`, коммит с SHA пакета. Данные `data/` не трогаем; пушей и деплоя нет.

## Фаза 0: Базовая линия [checkpoint: d257e23]

- [x] Task: Зафиксировать базовую линию: `bun test`, `bun run e2e` пакета и u7-school; точный замер `dmg-core/src` (доля комментариев, блоки ≥12 строк, строки с `D-NN`, `TR-NN`) в черновике `summary.md` f9868e4
- [x] Task: Conductor - User Manual Verification 'Фаза 0' (Protocol in workflow.md) d257e23

## Фаза 1: Правило и решение [checkpoint: d78ad64]

- [x] Task: Решение `D-NN` в `decisions.md` пакета: типы документов, ответственность, направление ссылок, критерий «оправдан»; обсудить с Нурболатом dmg-core@5752f08 (D-59; reference — каталог `docs/reference/`, предел JSDoc — review + warn в `check`)
- [x] Task: Правило о комментариях в `rules.md` пакета (новый ID) dmg-core@3a47e97 (CODE-04)
- [x] Task: Раздел «Как устроена документация» в `docs/index.md`: типы, ответственность, кто и когда актуализирует; таблица «что куда» (правило, способ, поток, контракт) dmg-core@1dd6285
- [x] Task: Правило и критерий в промптах `domain-author`, `api-author` (пакет), `migrator`, `tech-lead` (`.agents-core/roles`), проверка в `reviewer`; строка «Документы» в формате брифа среза (`tech-lead`); `agents:sync` d99bc260 (dmg-core@c8ed69f; авторы пакета — через общий блок `common.md`)
- [x] Task: Conductor - User Manual Verification 'Фаза 1' (Protocol in workflow.md) d78ad64

## Фаза 2: Проверки, роль и concepts

- [x] Task: Тест ссылок (`docs/`, `llms.txt`, JSDoc `@see`) в `bun run check` dmg-core@685b566 (расширен `docs-check`: направление по типам, якоря, `checkSee`; `guides/facade.md` — ссылки на исходники в `covers:`)
    - [x] Тесты: битая ссылка, ссылка на несуществующий файл, ссылка против направления; red
    - [x] Реализация; green
- [ ] Task: Проверка `covers:` во front-matter concepts — `warn` в `check`, блок в гейте релиза (`RELEASING.md`)
    - [ ] Тесты: исходник менялся позже документа → warn; red
    - [ ] Реализация; green
- [ ] Task: Команда `docs:impact <пути>` и триггер в `agent-gate.ts` (правка `dmg-core/src/{app,kernel,domain}` без `docs/` и `decisions.md` — предупреждение); `covers:` и у guides
    - [ ] Тесты: путь совпал с `covers` → документ в списке; не совпал → пусто; правка без docs → предупреждение; red
    - [ ] Реализация; green
- [ ] Task: Роль `documentarian` в `.agents-core/roles/` (только чтение, список расхождений, триггер — после фазы, менявшей документы, и перед релизом); пилот ведётся в `summary.md`
- [ ] Task: Каталог `concepts/`, `docs/index.md`, `llms.txt` с двумя входами
- [ ] Task: Concepts: «Путь вызова UC», «Слои и зависимости», «Жизненный цикл агрегата и событий», «Как читать модуль» (mermaid, `covers:`)
- [ ] Task: Ревью reviewer; вызов `documentarian` (пилот)
- [ ] Task: Conductor - User Manual Verification 'Фаза 2' (Protocol in workflow.md)

## Фаза 3: Нарезка существующих docs

- [ ] Task: `transport`, `errors-result`, `caller` — нормативная часть в reference, объяснение — в concepts
- [ ] Task: `layers`, `domain-modeling`, `manifests` — то же
- [ ] Task: `testing`, `rules`, `naming`, `typescript` — в reference; `guides/` — обновить ссылки
- [ ] Task: Ссылки в `llms.txt`, скилах, `AGENTS.md` u7-school; `dmg:sync`; тест ссылок зелёный
- [ ] Task: Ревью reviewer; вызов `documentarian`
- [ ] Task: Conductor - User Manual Verification 'Фаза 3' (Protocol in workflow.md)

## Фаза 4: Стрижка JSDoc

- [ ] Task: `kernel` — для каждого сценария сначала сверка с тестами, недостающие (red → green), затем сокращение комментария
- [ ] Task: `domain` — то же
- [ ] Task: `app` (`UnitOfWork.commit`, `CommandReplay`, `use-case-from-def`, `reaction`) — сценарии сбоев в именованные тесты, выжимка в concepts
- [ ] Task: `arch`, `cli` (комментарии `scaffold/app-sources.ts` — в шаблоны), `testing`
- [ ] Task: `D-NN` из середины фраз — в шапки; `@see` на документы
- [ ] Task: Ревью reviewer; вызов `documentarian`
- [ ] Task: Conductor - User Manual Verification 'Фаза 4' (Protocol in workflow.md)

## Фаза 5: Финал

- [ ] Task: Повторный замер, сверка с базовой линией, `check` и `e2e` пакета и проекта
- [ ] Task: `bun install` в u7-school, SHA пакета; `summary.md` с разделом «Пилот ролей» (`documentarian`)
- [ ] Task: Conductor - User Manual Verification 'Фаза 5' (Protocol in workflow.md)
