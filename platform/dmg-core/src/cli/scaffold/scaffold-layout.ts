import { GenLayout } from '../../gen/layout';
import { LintMap } from './lint-map';
import type {
  ScaffoldLayoutData,
  ScaffoldProfile,
} from './project-scaffold.types';

/** Scope из имени пакета: `@acme/school` → `acme`. */
const SCOPE = /^@([^/]+)\//;

/**
 * Раскладка профиля каркаса: каталоги домена, корня сборки и раннера,
 * спецификаторы импортов между ними, `gen` для `dmg-core.json`, пакеты
 * workspaces и карта линтера. Шаблоны (`AppSources`, `ProjectFiles`)
 * одни на все профили и берут отличия только отсюда.
 */
export class ScaffoldLayout {
  /** Раскладка профиля для проекта `name`; scope пакетов monorepo — из имени. */
  static of(profile: ScaffoldProfile, name: string): ScaffoldLayout {
    switch (profile) {
      case 'single':
        return ScaffoldLayout.single();
      case 'monorepo':
        return ScaffoldLayout.monorepo(SCOPE.exec(name)?.[1] ?? name);
    }
  }

  /** Один пакет: всё в `src/` (как учебный пример пакета). */
  private static single(): ScaffoldLayout {
    return new ScaffoldLayout({
      domain: 'src/domain',
      app: 'src/app',
      runner: 'src/runner',
      include: ['src', 'scripts'],
      gen: { ...GenLayout.defaults },
      imports: {
        appUser: '../domain/shared/app-user',
        app: '../app/app',
        appTypes: '../app/app.types',
      },
      moduleEntry: 'src/app/<m>/index.ts',
      packages: [],
      lint: LintMap.single,
    });
  }

  /**
   * Пакеты workspaces `@<scope>/*`: домен `domain`, корень сборки `app`,
   * прикладные пакеты `modules/*` (создаёт `gen module`), раннеры
   * `runners/*`. Домен и корень сборки импортируются по имени пакета.
   */
  private static monorepo(scope: string): ScaffoldLayout {
    const domain = `@${scope}/domain`;
    const app = `@${scope}/app`;
    return new ScaffoldLayout({
      domain: 'domain/src',
      app: 'app/src',
      runner: 'runners/cli/src',
      include: [
        'domain/src',
        'app/src',
        'modules/*/src',
        'runners/*/src',
        'scripts',
      ],
      gen: {
        domain: 'domain/src/{m}',
        app: 'modules/{m}/src',
        domainImport: `${domain}/{m}`,
        package: `@${scope}/{m}`,
      },
      imports: { appUser: `${domain}/shared`, app, appTypes: app },
      moduleEntry: `@${scope}/<m> (modules/<m>/src/index.ts)`,
      workspaces: ['domain', 'app', 'modules/*', 'runners/*'],
      packages: [
        {
          dir: 'domain',
          name: domain,
          exports: {
            '.': './src/index.ts',
            './*/contract': './src/*/contract.ts',
            './*': './src/*/index.ts',
          },
          dependencies: ['dmg-core', 'valibot'],
          workspace: [],
        },
        {
          dir: 'app',
          name: app,
          exports: { '.': './src/index.ts' },
          dependencies: ['dmg-core'],
          workspace: [domain],
        },
        {
          dir: 'runners/cli',
          name: `@${scope}/cli`,
          dependencies: ['dmg-core'],
          workspace: [domain, app],
        },
      ],
      lint: LintMap.monorepo,
    });
  }

  private constructor(readonly data: ScaffoldLayoutData) {}
}
