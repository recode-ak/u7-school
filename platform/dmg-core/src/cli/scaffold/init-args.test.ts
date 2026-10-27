import { describe, expect, it } from 'bun:test';
import { GenError } from '../../gen/cli';
import { InitArgs } from './init-args';

// Разбор аргументов `dmg-core init [--profile …] [--name …] [--dry-run]`.

describe('InitArgs: разбор', () => {
  it('без аргументов — прежний init (профиля нет)', () => {
    expect(InitArgs.parse([])).toEqual({
      profile: undefined,
      name: undefined,
      dryRun: false,
    });
  });

  it('профиль, имя и dry-run в любом порядке', () => {
    expect(InitArgs.parse(['--profile', 'single'])).toEqual({
      profile: 'single',
      name: undefined,
      dryRun: false,
    });
    expect(
      InitArgs.parse([
        '--dry-run',
        '--name',
        '@acme/school',
        '--profile',
        'monorepo',
      ]),
    ).toEqual({ profile: 'monorepo', name: '@acme/school', dryRun: true });
  });
});

describe('InitArgs: ошибки ввода — GenError', () => {
  const cases: [string, string[], string][] = [
    ['--name без профиля', ['--name', 'acme'], '--profile'],
    ['--dry-run без профиля', ['--dry-run'], '--profile'],
    ['неизвестный профиль', ['--profile', 'web'], 'web'],
    ['--profile без значения', ['--profile'], '--profile'],
    ['значение — другой флаг', ['--profile', '--dry-run'], '--profile'],
    ['--name без значения', ['--profile', 'single', '--name'], '--name'],
    ['лишний аргумент', ['--profile', 'single', 'extra'], 'extra'],
    ['неизвестный флаг', ['--profile', 'single', '--write'], '--write'],
    [
      'повтор флага',
      ['--profile', 'single', '--profile', 'monorepo'],
      '--profile',
    ],
  ];

  for (const [title, argv, mention] of cases) {
    it(title, () => {
      expect(() => InitArgs.parse(argv)).toThrow(GenError);
      expect(() => InitArgs.parse(argv)).toThrow(mention);
    });
  }
});
