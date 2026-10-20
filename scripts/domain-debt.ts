/**
 * Allowlist долга домена (трек domain-package). Только уменьшается:
 * новая запись допустима вместе с записью в
 * `conductor/tracks/domain-package_20261020/debt.md` и маркером
 * `// DEBT(<id>)` в коде. Сверку делает `bun run arch:check`.
 */
export const DOMAIN_DEBT_ALLOWLIST: readonly string[] = [];

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

export const DEBT_MD = 'conductor/tracks/domain-package_20261020/debt.md';
