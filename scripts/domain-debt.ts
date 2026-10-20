/**
 * Данные проверок домена для `bun run arch:check`: граф модулей и путь
 * к реестру долга `conductor/architecture/debt.md`.
 */

// DEBT-31: граф продублирован руками до появления `defineModule` у модулей
/** Граф `dependsOn` модулей домена; порядок переноса — снизу вверх. */
export const DOMAIN_GRAPH: Readonly<Record<string, readonly string[]>> = {
  user: [],
  course: ['user'],
  questionnaire: ['user'],
  stream: ['user', 'course'],
  wish: ['user', 'course', 'questionnaire', 'stream'],
  'peer-review': ['user', 'questionnaire', 'stream'],
  dossier: [],
};

export const DEBT_MD = 'conductor/architecture/debt.md';
