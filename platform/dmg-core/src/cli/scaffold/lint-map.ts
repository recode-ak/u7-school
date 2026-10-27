import type {
  BiomeOverride,
  ImportBan,
  LintDirs,
  LintRule,
} from './lint-map.types';

/** Каталог плагинов установленного пакета — от корня проекта. */
const PLUGINS = './node_modules/dmg-core/biome-plugins';

/** Тесты вне проверок слоёв: им можно то, что запрещено коду. */
const NOT_TESTS = '!**/*.test.ts';

/** Суффиксы файлов, где штатный отказ — `Result`, а не исключение (ERR-01). */
const OPERATIONS = ['ar', 'dcs', 'facade', 'uc', 'er'];

/** Запрет импорта entity (`…/state`, `*.state`). */
const STATE = ['**/*.state', '**/state'];

/**
 * Карта «правило → каталоги» проекта: по ней каркас строит `overrides`
 * biome.json, по ней же пишется раздел карты в `rules.md`. Одна таблица
 * правил на все профили: каталоги слоёв профиля (`LintDirs`) — параметр,
 * а не россыпь в шаблонах.
 */
export class LintMap {
  /** Профиль single: домен `src/domain`, прикладной слой и корень сборки `src/app`, раннер `src/runner`. */
  static readonly single = LintMap.of({
    domain: 'src/domain',
    app: ['src/app'],
    sources: ['src'],
    main: 'src/runner/main.ts',
    escapes: ['app', 'runner'],
    escapesTitle: 'приложение и раннер (src/app, src/runner)',
  });

  /**
   * Профиль monorepo: пакеты `domain`, `app` (корень сборки), `modules/*`
   * (прикладной слой), `runners/*`; исходники каждого — в `src`.
   */
  static readonly monorepo = LintMap.of({
    domain: 'domain/src',
    app: ['app/src', 'modules/*/src'],
    sources: ['domain/src', 'app/src', 'modules/*/src', 'runners/*/src'],
    main: 'runners/*/src/main.ts',
    escapes: ['app', 'runners', 'modules'],
    escapesTitle:
      'корень сборки, раннеры и прикладной слой (app, runners, modules)',
  });

  /** Таблица правил на каталогах профиля. */
  static of(dirs: LintDirs): LintMap {
    const all = (pattern: string) =>
      dirs.sources.map((dir) => `${dir}/${pattern}`);
    const operations = OPERATIONS.flatMap((kind) => all(`**/*.${kind}.ts`));
    const domain = `${dirs.domain}/**`;
    return new LintMap([
      {
        id: 'ARC-02',
        includes: [domain],
        imports: [
          {
            // Белый список: корень dmg-core, valibot и свои файлы.
            group: [
              '**',
              '!dmg-core',
              '!valibot',
              '!.',
              '!..',
              '!./**',
              '!../**',
            ],
            message:
              'ARC-02: домен импортирует только корень dmg-core (ядро и Def-классы) и valibot',
          },
          {
            // Относительный выход из домена в корень сборки, раннеры и
            // прикладной слой: `arch:check` его не видит (проверяет домен
            // только между модулями). Имена модулей домена из `escapes`
            // зарезервированы: импорт соседа `../app/…` даёт ложное ARC-02
            // (глоб видит спецификатор, а не путь).
            group: dirs.escapes.flatMap((dir) => [
              `**/../${dir}`,
              `**/../${dir}/**`,
            ]),
            message: `ARC-02: домен не импортирует ${dirs.escapesTitle}`,
          },
        ],
      },
      {
        id: 'DOM-01',
        includes: [
          `${domain}/*.policy.ts`,
          `${domain}/*.rules.ts`,
          `${domain}/*.dcs.ts`,
        ],
        imports: [
          {
            group: STATE,
            message:
              'DOM-01: Policy, правила и DCS не видят entity — только API Ar и контракты (D-39)',
          },
        ],
        repeats: ['ARC-02'],
      },
      { id: 'DOM-14', plugin: 'dom-14-no-clock', includes: [domain] },
      {
        id: 'DOM-11',
        plugin: 'dom-11-base-fields',
        includes: [`${domain}/*.state.ts`],
      },
      {
        id: 'DOM-01',
        includes: [...dirs.app.map((dir) => `${dir}/**`), '!**/infra/**'],
        imports: [
          {
            group: STATE,
            message:
              'DOM-01: entity видят только Ar своего агрегата и рендереры UI; используй доменный API',
          },
        ],
      },
      {
        id: 'ARC-09',
        plugin: 'arc-09-no-env',
        includes: [...all('**'), `!${dirs.main}`],
      },
      { id: 'CODE-02', plugin: 'code-02-class-members', includes: all('**') },
      { id: 'DOM-12', plugin: 'dom-12-no-iso-dates', includes: all('**') },
      {
        id: 'DOM-17',
        plugin: 'dom-17-snapshot-repo-only',
        includes: [
          ...all('**'),
          '!**/*.repo.ts',
          '!**/*-repo.ts',
          '!**/*.json-repo.ts',
          '!**/*.memory-repo.ts',
        ],
      },
      { id: 'ERR-01', plugin: 'err-01-no-throw', includes: operations },
      {
        id: 'API-02',
        plugin: 'api-02-no-manual-publish',
        includes: [...operations, ...all('**/*.job.ts')],
      },
    ]);
  }

  constructor(readonly rules: readonly LintRule[]) {}

  /** Секции `overrides` biome.json: по одной на строку карты. */
  overrides(): BiomeOverride[] {
    return this.rules.map((rule) => {
      const includes = [...rule.includes, NOT_TESTS];
      if ('plugin' in rule) {
        return { includes, plugins: [`${PLUGINS}/${rule.plugin}.grit`] };
      }
      const bans = [
        ...(rule.repeats ?? []).flatMap((id) => this.bans(rule.id, id)),
        ...rule.imports,
      ];
      return {
        includes,
        linter: {
          rules: {
            style: {
              noRestrictedImports: {
                level: 'error',
                options: {
                  patterns: bans.map((ban) => ({
                    group: [...ban.group],
                    message: ban.message,
                  })),
                },
              },
            },
          },
        },
      };
    });
  }

  /** Запреты импортов строки `id` для повтора в строке `by`; нет — дефект таблицы. */
  private bans(by: string, id: string): readonly ImportBan[] {
    const rule = this.rules.find((r) => r.id === id && 'imports' in r);
    if (rule === undefined || !('imports' in rule)) {
      throw new Error(
        `Карта линтера: ${by} повторяет ${id} — нет строки с запретом импортов`,
      );
    }
    return rule.imports;
  }
}
