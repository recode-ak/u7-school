import { definePolicy, rule } from 'dmg-core';

/**
 * Респондент анкеты есть: анкета запускается за субъекта вызывающего
 * (`caller.subject()`), поэтому системный вызов без человека — отказ.
 * `rule()` без субъекта сам возвращает отказ, `check` вызывается лишь
 * при наличии субъекта.
 */
const hasRespondent = rule<{ readonly uuid: string }>({
  name: 'hasRespondent',
  label: 'Есть респондент',
  denyMessage: 'Анкету можно запустить только за человека-респондента.',
  check: () => true,
});

/**
 * Права респондента анкеты. Назван `QuestionnaireRespondentPolicy`, потому что
 * `QuestionnairePolicy` занят legacy-объектом (`./policy.ts`) и экспортируется
 * из того же индекса; после миграции модуля анкет они сольются.
 */
export const QuestionnaireRespondentPolicy = definePolicy({
  name: 'questionnaireRespondent',
  label: 'Права респондента анкеты',
  description: 'Запустить анкету можно только за человека-респондента.',
  rules: { hasRespondent },
});
