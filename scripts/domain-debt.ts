/**
 * Allowlist долга домена (трек domain-package). Только уменьшается:
 * новая запись допустима вместе с записью в
 * `conductor/tracks/domain-package_20261020/debt.md` и маркером
 * `// DEBT(<id>)` в коде. Сверку делает `bun run arch:check`.
 */
export const DOMAIN_DEBT_ALLOWLIST: readonly string[] = [
  'D-1',
  'D-2',
  'D-3',
  'D-4',
  'D-5',
  'D-6',
  'D-7',
  'D-8',
  'D-9',
  'D-10',
  'D-11',
  'D-12',
  'D-13',
  'D-14',
  'D-15',
  'D-16',
  'D-17',
  'D-18',
  'D-19',
  'D-20',
  'D-21',
  'D-22',
  'D-23',
  'D-24',
];

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
