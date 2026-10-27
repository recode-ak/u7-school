import { describe, expect, it } from 'bun:test';
import { ExampleEnv } from './example-env';
import type { EnvVars } from './example-env.types';

// Разбор переменных окружения раннера в `ExampleAppEnv` (ARC-09: читает
// только точка входа, класс получает их словарём).

const A = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const B = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const DIR = '/tmp/example';

const parse = (vars: EnvVars) => new ExampleEnv(vars).toAppEnv();

describe('ExampleEnv.toAppEnv', () => {
  it('все переменные заданы', () => {
    expect(
      parse({
        EXAMPLE_MODE: 'production',
        EXAMPLE_DATA_DIR: '/tmp/example',
        EXAMPLE_USERS: `${A}, ${B}`,
      }),
    ).toEqual({ mode: 'production', dataDir: '/tmp/example', users: [A, B] });
  });

  it('по умолчанию: development, без пользователей', () => {
    expect(parse({ EXAMPLE_DATA_DIR: DIR })).toEqual({
      mode: 'development',
      dataDir: DIR,
      users: [],
    });
  });

  it('пустые элементы EXAMPLE_USERS отбрасываются', () => {
    expect(
      parse({ EXAMPLE_DATA_DIR: DIR, EXAMPLE_USERS: `,${A},,` }).users,
    ).toEqual([A]);
  });

  it('нет EXAMPLE_DATA_DIR (или пустой) — исключение конфигурации', () => {
    expect(() => parse({})).toThrow(
      'EXAMPLE_DATA_DIR: не задан каталог данных',
    );
    expect(() => parse({ EXAMPLE_DATA_DIR: '' })).toThrow('EXAMPLE_DATA_DIR');
  });

  it('неизвестный режим — исключение с перечнем допустимых', () => {
    expect(() =>
      parse({ EXAMPLE_DATA_DIR: DIR, EXAMPLE_MODE: 'prod' }),
    ).toThrow(
      'EXAMPLE_MODE: «prod» — ожидается test | development | production',
    );
  });
});
