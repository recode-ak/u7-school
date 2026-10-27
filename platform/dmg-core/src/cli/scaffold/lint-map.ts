import type { BiomeOverride, ImportBan, LintRule } from './lint-map.types';

/** Каталог плагинов установленного пакета — от корня проекта. */
const PLUGINS = './node_modules/dmg-core/biome-plugins';

/** Тесты вне проверок слоёв: им можно то, что запрещено коду. */
const NOT_TESTS = '!**/*.test.ts';

/** Файлы, где штатный отказ — `Result`, а не исключение (ERR-01). */
const OPERATIONS = [
  'src/**/*.ar.ts',
  'src/**/*.dcs.ts',
  'src/**/*.facade.ts',
  'src/**/*.uc.ts',
  'src/**/*.er.ts',
];

/** Запрет импорта entity (`…/state`, `*.state`). */
const STATE = ['**/*.state', '**/state'];

/**
 * Карта «правило → каталоги» проекта: по ней каркас строит `overrides`
 * biome.json, по ней же пишется раздел карты в `rules.md`. Одна таблица на
 * профиль: каталоги слоёв профиля — здесь, а не россыпью в шаблонах.
 */
export class LintMap {
  /** Профиль single: домен `src/domain`, прикладной слой и корень сборки `src/app`, раннер `src/runner`. */
  static readonly single = new LintMap([
    {
      id: 'ARC-02',
      includes: ['src/domain/**'],
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
          // Относительный выход из домена в корень сборки и раннер:
          // `arch:check` его не видит (проверяет домен только между модулями).
          // Имена модулей домена `app` и `runner` зарезервированы: импорт
          // соседа `../app/…` даёт ложное ARC-02 (глоб видит спецификатор,
          // а не путь).
          group: [
            '**/../app',
            '**/../app/**',
            '**/../runner',
            '**/../runner/**',
          ],
          message:
            'ARC-02: домен не импортирует приложение и раннер (src/app, src/runner)',
        },
      ],
    },
    {
      id: 'DOM-01',
      includes: [
        'src/domain/**/*.policy.ts',
        'src/domain/**/*.rules.ts',
        'src/domain/**/*.dcs.ts',
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
    { id: 'DOM-14', plugin: 'dom-14-no-clock', includes: ['src/domain/**'] },
    {
      id: 'DOM-11',
      plugin: 'dom-11-base-fields',
      includes: ['src/domain/**/*.state.ts'],
    },
    {
      id: 'DOM-01',
      includes: ['src/app/**', '!**/infra/**'],
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
      includes: ['src/**', '!src/runner/main.ts'],
    },
    { id: 'CODE-02', plugin: 'code-02-class-members', includes: ['src/**'] },
    { id: 'DOM-12', plugin: 'dom-12-no-iso-dates', includes: ['src/**'] },
    {
      id: 'DOM-17',
      plugin: 'dom-17-snapshot-repo-only',
      includes: [
        'src/**',
        '!**/*.repo.ts',
        '!**/*-repo.ts',
        '!**/*.json-repo.ts',
        '!**/*.memory-repo.ts',
      ],
    },
    { id: 'ERR-01', plugin: 'err-01-no-throw', includes: OPERATIONS },
    {
      id: 'API-02',
      plugin: 'api-02-no-manual-publish',
      includes: [...OPERATIONS, 'src/**/*.job.ts'],
    },
  ]);

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
