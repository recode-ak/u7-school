# dossier — модуль агрегации «досье»

Модуль агрегации фактов по модулю учёбы и по студенту в целом (бывш. `metrics`
— карта модулей: [conductor/roadmap.md](../../conductor/roadmap.md)). Потребляет
факты из peer-review, sessions, stream и сводит их в досье; предъявление —
модуль `passport` ([digital-passport.md](../../conductor/roadmap/metrics/digital-passport.md)).
Концепция:
[conductor/roadmap/metrics/peer-review-system.md](../../conductor/roadmap/metrics/peer-review-system.md).

## Состояние

Пустой модуль на Def: `DossierModuleDef` (`domain/src/dossier/dossier.module.ts`)
без `external`, `dependsOn: []`; агрегатов, UC, ER, Job и событий нет.
Пакет — только сборка модуля (`createDossierModule`, пустые карты); корень
приложения подключает его в `U7App`.

В домене (`domain/src/dossier`) лежат перенесённые из `peer-review` схемы
оценки навыков:

- `categories.ts` — категории и подкатегории навыков, веса, маппинг;
- `scores.ts` — балл по подкатегории (`SkillScore`).

Агрегаты, репозитории и UC появятся с треком досье.

Термин «досье» закреплён за этим модулем — кампании peer-review досье не
называются (см. концепцию, §1).
