import { namedImport, sortImports, sortNames } from '../../gen/import-order';
import { WIRING_MARKERS } from '../../gen/kinds/app-wiring';
import type {
  ScaffoldFile,
  ScaffoldImports,
  ScaffoldLayoutData,
} from './project-scaffold.types';
import type { ScaffoldLayout } from './scaffold-layout';

/**
 * Импорт шаблона: источник и имена (`type X` — только тип) или пространство
 * имён (`import * as <namespace>`).
 */
type Import =
  | { readonly from: string; readonly names: readonly string[] }
  | { readonly from: string; readonly namespace: string };

/**
 * Исходники приложения в каркасе — одни шаблоны на все профили, по
 * учебному приложению пакета (`src/testing/example/{app,runner,shared}`):
 * тип пользователя в домене (D-53), пустой корень сборки (D-50), раннер
 * CLI с единственным чтением окружения (ARC-09) и тесты к ним. Каталоги и
 * спецификаторы импортов между частями — из раскладки профиля
 * (`ScaffoldLayout`); у пакетов workspaces — ещё и входы `src/index.ts`.
 * Модулей нет: их добавляет `dmg-core gen module`. Импорты платформы —
 * только публичные входы пакета (`dmg-core`, `dmg-core/app`,
 * `dmg-core/testing`).
 */
export class AppSources {
  private readonly layout: ScaffoldLayoutData;
  private readonly from: ScaffoldImports;

  constructor(layout: ScaffoldLayout) {
    this.layout = layout.data;
    this.from = layout.data.imports;
  }

  files(): ScaffoldFile[] {
    const { domain, app, runner } = this.layout;
    return [
      { path: `${domain}/shared/app-user.ts`, content: this.appUser() },
      { path: `${app}/app.types.ts`, content: this.appTypes() },
      { path: `${app}/app.ts`, content: this.app() },
      {
        path: `${app}/app-caller-resolver.ts`,
        content: this.callerResolver(),
      },
      { path: `${app}/app.test.ts`, content: this.appTest() },
      { path: `${runner}/runner-env.types.ts`, content: this.envTypes() },
      { path: `${runner}/runner-env.ts`, content: this.env() },
      { path: `${runner}/runner-env.test.ts`, content: this.envTest() },
      { path: `${runner}/runner-cli.types.ts`, content: this.cliTypes() },
      { path: `${runner}/runner-cli.ts`, content: this.cli() },
      { path: `${runner}/runner-cli.test.ts`, content: this.cliTest() },
      { path: `${runner}/main.ts`, content: this.main() },
      { path: `${runner}/main.test.ts`, content: this.mainTest() },
      ...this.entries(),
    ];
  }

  /** Входы пакетов workspaces; в проекте из одного пакета их нет. */
  private entries(): ScaffoldFile[] {
    if (this.layout.workspaces === undefined) return [];
    const { domain, app } = this.layout;
    return [
      {
        path: `${domain}/index.ts`,
        content: `/**
 * Вход пакета домена: общий домен приложения (D-53). Модули — подпутями
 * пакета: \`<пакет>/<m>/contract\` для другого кода, \`<пакет>/<m>\` — для
 * своего прикладного пакета.
 */
export type { AppUser } from './shared';
`,
      },
      {
        path: `${domain}/shared/index.ts`,
        content: `/** Общий домен приложения (D-53): типы, общие для модулей и приложения. */
export type { AppUser } from './app-user';
`,
      },
      {
        path: `${app}/index.ts`,
        content: `/** Вход корня сборки: приложение и его типы — для раннеров. */
export { App } from './app';
export type { AppEnv, AppPorts, CallerResolver } from './app.types';
`,
      },
    ];
  }

  /**
   * Блок импортов в порядке biome: один источник — один импорт (имена
   * сливаются), только типы — \`import type\`, длинный — по имени на строку.
   */
  private imports(list: readonly Import[]): string {
    const merged = new Map<string, string[]>();
    const namespaces: string[] = [];
    for (const item of list) {
      if ('namespace' in item) {
        namespaces.push(`import * as ${item.namespace} from '${item.from}';`);
        continue;
      }
      const { from, names } = item;
      merged.set(from, sortNames([...(merged.get(from) ?? []), ...names]));
    }
    const statements = [...merged].map(([from, names]) => {
      const types = names.every((name) => name.startsWith('type '));
      const items = types ? names.map((n) => n.slice('type '.length)) : names;
      return namedImport(items, from, types);
    });
    return sortImports([...statements, ...namespaces]);
  }

  private appUser(): string {
    return `/**
 * Пользователь приложения — им приложение замыкает дженерик \`Caller\` (D-04).
 * Общий домен (D-53): тип импортируют прикладной слой модулей, корень сборки
 * и раннер; реализации здесь нет.
 */
export type AppUser = {
  readonly uuid: string;
  /** TODO: сузить \`role\` до ролей приложения (union строк). */
  hasRole(role: string): boolean;
};
`;
  }

  private appTypes(): string {
    return `${this.imports([
      { from: 'dmg-core', names: ['type PersonCaller'] },
      {
        from: 'dmg-core/app',
        names: [
          'type AppMode',
          'type Clock',
          'type EventBus',
          'type Logger',
          'type Trace',
        ],
      },
      { from: this.from.appUser, names: ['type AppUser'] },
    ])}

/**
 * Окружение приложения (D-50) — простые данные: раннер собирает их из
 * окружения процесса, приложение само окружение не читает (ARC-09).
 */
export type AppEnv = {
  readonly mode: AppMode;
  /** Каталог данных: лог операций — \`oplog/\`, хранилища модулей — рядом. */
  readonly dataDir: string;
};

/**
 * Подмена портов контекста — для тестов и встраивания. Не задан — боевой:
 * \`InProcEventBus\`, \`ConsoleLogger\`, \`systemClock\`.
 */
export type AppPorts = {
  readonly bus?: EventBus;
  readonly logger?: Logger;
  readonly clock?: Clock;
};

/**
 * Резолвер \`Caller\` (D-50): идентичность из транспорта (uuid или её
 * отсутствие) → человек на входе. \`trace\` — для вызова модуля
 * пользователей через \`api.dispatch\` (D-51). Раннер получает резолвер
 * как \`app.callers\`.
 */
export type CallerResolver = {
  resolve(
    uuid: string | undefined,
    trace: Trace,
  ): Promise<PersonCaller<AppUser>>;
};
`;
  }

  private app(): string {
    return `${this.imports([
      { from: 'node:path', names: ['join'] },
      {
        from: 'dmg-core/app',
        names: [
          'ApiApp',
          'type AppContext',
          'ConsoleLogger',
          'InProcEventBus',
          'InProcInbox',
          'InProcOutbox',
          'JsonlOperationLog',
          'type ModuleFactory',
          'systemClock',
        ],
      },
      { from: this.from.appUser, names: ['type AppUser'] },
      {
        from: './app.types',
        names: ['type AppEnv', 'type AppPorts', 'type CallerResolver'],
      },
      { from: './app-caller-resolver', names: ['AppCallerResolver'] },
    ])}
${WIRING_MARKERS.imports}

/**
 * Приложение — корень сборки (D-50): по окружению строит контекст и модули
 * (раскладку фасадов по \`dependsOn\` делает \`ApiApp\`), отдаёт клиент \`api\`
 * и резолвер \`callers\`. Раннер передаёт окружение, строит \`Trace\` и
 * вызывает \`start()\`.
 */
export class App {
  readonly api: ApiApp<AppUser>;
  readonly callers: CallerResolver;

  constructor(env: AppEnv, ports: AppPorts = {}) {
    const context = App.context(env, ports);
    // Фабрики модулей — из входа прикладного пакета ${this.layout.moduleEntry}
    // (D-52) с замыканием на репозитории. Вставляет \`dmg-core gen module\`
    // (корень Def — и в scripts/arch-check.ts), репозитории — \`gen aggregate\`.
    const modules: ModuleFactory<AppUser>[] = [
      ${WIRING_MARKERS.modules}
    ];
    this.api = new ApiApp(context, modules);
    this.callers = new AppCallerResolver();
  }

  /** Подписывает реакции всех модулей; возвращает остановку. */
  start(): () => void {
    return this.api.subscribe();
  }

  private static context(env: AppEnv, ports: AppPorts): AppContext {
    const logger = ports.logger ?? new ConsoleLogger();
    const bus = ports.bus ?? new InProcEventBus(logger);
    return {
      bus,
      outbox: new InProcOutbox(bus),
      inbox: new InProcInbox(),
      clock: ports.clock ?? systemClock,
      logger,
      mode: env.mode,
      oplog: new JsonlOperationLog(join(env.dataDir, 'oplog')),
    };
  }
}
`;
  }

  private callerResolver(): string {
    return `${this.imports([
      {
        from: 'dmg-core',
        names: ['GuestCaller', 'type PersonCaller', 'UserCaller'],
      },
      { from: 'dmg-core/app', names: ['type Trace'] },
      { from: this.from.appUser, names: ['type AppUser'] },
      { from: './app.types', names: ['type CallerResolver'] },
    ])}

/** Единственный канал, с которого заглушка принимает uuid. */
const TRUSTED_CHANNEL = 'cli';

/**
 * Резолвер \`Caller\` приложения (D-50) — заглушка для разработки, пока нет
 * модуля пользователей. Нет uuid — гость. uuid с канала \`cli\`
 * (\`trace.channel\`) — \`UserCaller\` без ролей, uuid принимается на веру:
 * UC с \`callers: ['user']\` вызывается раннером (\`call … --user <uuid>\`)
 * без правки Def, проверки ролей в Policy отказывают. Кто запускает
 * локальный CLI, и так владеет каталогом данных.
 *
 * uuid с другого канала (HTTP, бот) или без канала — исключение (ERR-01):
 * это код проверяет, а не соглашение. Транспорт с удалённым входом до
 * модуля пользователей — дефект конфигурации; тихий гость спрятал бы его
 * за отказом в правах.
 *
 * uuid, придуманные в CLI, не совпадут с пользователями модуля
 * пользователей: данные, созданные от них, после замены резолвера —
 * чужие или ничьи.
 *
 * TODO: после модуля пользователей — \`UserCaller\` через \`api.dispatch\`
 * (конструктор принимает \`api\`), вызов от \`SystemCaller\` \`kind: 'app'\`
 * (D-51); нет uuid или пользователя — гость, прочий отказ — исключение
 * (образец — учебное приложение dmg-core).
 */
export class AppCallerResolver implements CallerResolver {
  async resolve(
    uuid: string | undefined,
    trace: Trace,
  ): Promise<PersonCaller<AppUser>> {
    if (uuid === undefined) return new GuestCaller();
    if (trace.channel?.name !== TRUSTED_CHANNEL) {
      throw new Error(
        \`Резолвер Caller: uuid принимается только с канала \${TRUSTED_CHANNEL} — подключи модуль пользователей\`,
      );
    }
    return new UserCaller({ uuid, hasRole: () => false });
  }
}
`;
  }

  private appTest(): string {
    return `import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GuestCaller, UserCaller } from 'dmg-core';
import { Trace } from 'dmg-core/app';
import { AwaitingBus, MemoryLogger } from 'dmg-core/testing';
import { App } from './app';

// Приложение целиком: окружение → контекст, резолвер Caller, запуск и
// остановка реакций. Порты подменены, данные — во временном каталоге.

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';
const REQ = Trace.fromRequest({ requestId: 'r-1' });
const CLI = Trace.fromRequest({ requestId: 'r-2', channel: { name: 'cli' } });
const HTTP = Trace.fromRequest({ requestId: 'r-3', channel: { name: 'http' } });

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'app-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function makeApp(): App {
  return new App(
    { mode: 'test', dataDir: dir },
    { bus: new AwaitingBus(), logger: new MemoryLogger() },
  );
}

describe('App.start', () => {
  it('повторный start() без остановки — исключение; после остановки — можно', () => {
    const app = makeApp();
    const stop = app.start();
    expect(() => app.start()).toThrow();
    stop();
    expect(() => app.start()).not.toThrow();
  });
});

describe('App.callers', () => {
  it('нет идентичности — GuestCaller на любом канале', async () => {
    expect(await makeApp().callers.resolve(undefined, CLI)).toBeInstanceOf(
      GuestCaller,
    );
  });

  it('модуля пользователей нет, канал cli — по uuid UserCaller без ролей', async () => {
    const caller = await makeApp().callers.resolve(USER, CLI);

    expect(caller).toBeInstanceOf(UserCaller);
    expect(caller.toLog()).toEqual({ kind: 'user', subjectId: USER });
    expect(caller instanceof UserCaller && caller.user.hasRole('admin')).toBe(
      false,
    );
  });

  it('модуля пользователей нет, uuid не с канала cli — исключение конфигурации', async () => {
    const app = makeApp();
    for (const trace of [REQ, HTTP]) {
      await expect(app.callers.resolve(USER, trace)).rejects.toThrow(
        'Резолвер Caller: uuid принимается только с канала cli',
      );
    }
  });
});
`;
  }

  private envTypes(): string {
    return `/** Переменные окружения раннера: словарь, как \`process.env\`. */
export type EnvVars = Readonly<Record<string, string | undefined>>;
`;
  }

  private env(): string {
    return `${this.imports([
      { from: 'dmg-core/app', names: ['type AppMode'] },
      { from: this.from.appTypes, names: ['type AppEnv'] },
      { from: './runner-env.types', names: ['type EnvVars'] },
    ])}

const MODES: readonly AppMode[] = ['test', 'development', 'production'];

/**
 * Окружение раннера → \`AppEnv\` (ARC-09: окружение процесса читает только
 * точка входа и передаёт сюда словарём). Переменные: \`APP_MODE\` (по
 * умолчанию \`development\`), \`APP_DATA_DIR\` (обязателен). Неверный режим
 * или нет каталога — исключение (ошибка конфигурации, ERR-01).
 */
export class RunnerEnv {
  constructor(private readonly vars: EnvVars) {}

  toAppEnv(): AppEnv {
    return {
      mode: RunnerEnv.mode(this.vars.APP_MODE),
      dataDir: RunnerEnv.dataDir(this.vars.APP_DATA_DIR),
    };
  }

  private static dataDir(raw: string | undefined): string {
    if (raw === undefined || raw === '') {
      throw new Error('APP_DATA_DIR: не задан каталог данных');
    }
    return raw;
  }

  private static mode(raw: string | undefined): AppMode {
    if (raw === undefined || raw === '') return 'development';
    const mode = MODES.find((m) => m === raw);
    if (mode === undefined) {
      throw new Error(\`APP_MODE: «\${raw}» — ожидается \${MODES.join(' | ')}\`);
    }
    return mode;
  }
}
`;
  }

  private envTest(): string {
    return `import { describe, expect, it } from 'bun:test';
import { RunnerEnv } from './runner-env';
import type { EnvVars } from './runner-env.types';

// Разбор переменных окружения раннера в AppEnv (ARC-09: читает только
// точка входа, класс получает их словарём).

const DIR = '/tmp/app';

const parse = (vars: EnvVars) => new RunnerEnv(vars).toAppEnv();

describe('RunnerEnv.toAppEnv', () => {
  it('все переменные заданы', () => {
    expect(parse({ APP_MODE: 'production', APP_DATA_DIR: DIR })).toEqual({
      mode: 'production',
      dataDir: DIR,
    });
  });

  it('по умолчанию — development', () => {
    expect(parse({ APP_DATA_DIR: DIR }).mode).toBe('development');
  });

  it('нет APP_DATA_DIR (или пустой) — исключение конфигурации', () => {
    expect(() => parse({})).toThrow('APP_DATA_DIR: не задан каталог данных');
    expect(() => parse({ APP_DATA_DIR: '' })).toThrow('APP_DATA_DIR');
  });

  it('неизвестный режим — исключение с перечнем допустимых', () => {
    expect(() => parse({ APP_DATA_DIR: DIR, APP_MODE: 'prod' })).toThrow(
      'APP_MODE: «prod» — ожидается test | development | production',
    );
  });
});
`;
  }

  private cliTypes(): string {
    return `/**
 * Порт вывода CLI: строки в stdout и stderr. Точка входа отдаёт \`console\`,
 * тест — буфер; глобальные \`console\` и \`process\` раннер не трогает.
 */
export type CliIo = {
  out(line: string): void;
  err(line: string): void;
};
`;
  }

  private cli(): string {
    return `${this.imports([
      { from: 'dmg-core', names: ['err', 'F', 'ok', 'type Result'] },
      { from: 'dmg-core/app', names: ['Trace'] },
      { from: 'valibot', namespace: 'v' },
      { from: this.from.app, names: ['type App'] },
      { from: './runner-cli.types', names: ['type CliIo'] },
    ])}

/**
 * Коды выхода процесса: 0 — успех, 1 — ошибка ввода (argv), 2 — отказ
 * операции (\`Err\` из \`call\`, в том числе неизвестная операция и вход не
 * по схеме), 3 — ошибка окружения: \`EXIT_CONFIG\` ставит \`main.ts\`, до CLI
 * дело не доходит.
 */
export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_REJECTED = 2;
export const EXIT_CONFIG = 3;

export const USAGE = [
  'Использование: APP_DATA_DIR=data bun ${this.layout.runner}/main.ts <команда>',
  "  call <module>.<operation> [--input '<json>'] [--user <uuid>] — вызов UC",
  '  whoami [--user <uuid>] — вид вызывающего',
].join('\\n');

type CliCommand = 'call' | 'whoami';

/** Значения опций \`--<имя> <значение>\` любой команды. */
type CliOptions = { input?: string; user?: string };

/**
 * Опции, разрешённые команде (проверка в рантайме); \`--user\` — общая,
 * без неё вызов от гостя.
 */
const OPTIONS: Record<CliCommand, readonly (keyof CliOptions)[]> = {
  call: ['input', 'user'],
  whoami: ['user'],
};

const USER_ID = F.uuid('пользователя');

/** Разобранная команда CLI. */
type CliRequest =
  | { readonly command: 'whoami'; readonly user?: string }
  | {
      readonly command: 'call';
      readonly module: string;
      readonly uc: string;
      readonly input: unknown;
      readonly user?: string;
    };

/**
 * CLI-раннер — транспорт: разбирает argv, строит \`Trace\` (канал \`cli\`,
 * новый \`requestId\` на запуск), получает \`Caller\` от резолвера приложения
 * по идентичности (\`--user\`) и печатает результат. Без команды или с
 * \`--help\` — справка.
 *
 * - \`call <module>.<operation>\` — любой UC приложения по имени Def модуля
 *   и Def UC (\`todo.createTask\`, как в логе операций): \`--input\` — JSON
 *   входа (по умолчанию \`{}\`, проверяет схема UC), \`Result\` JSON в stdout.
 * - \`whoami\` — вид вызывающего.
 *
 * Своя команда с разбором аргументов под UC — по образцу учебного раннера
 * dmg-core (\`api.dispatch\` с Def — типизированный \`Result\`).
 */
export class RunnerCli {
  constructor(private readonly app: App) {}

  async run(argv: readonly string[], io: CliIo): Promise<number> {
    const [command] = argv;
    if (command === undefined || command === '--help') {
      io.out(USAGE);
      return EXIT_OK;
    }
    const parsed = RunnerCli.parse(argv);
    if (!parsed.ok) {
      io.err(parsed.error);
      io.err(USAGE);
      return EXIT_USAGE;
    }
    const request = parsed.value;
    const trace = Trace.fromRequest({
      requestId: crypto.randomUUID(),
      channel: { name: 'cli' },
    });
    const caller = await this.app.callers.resolve(request.user, trace);
    if (request.command === 'whoami') {
      io.out(JSON.stringify({ kind: caller.kind }));
      return EXIT_OK;
    }
    const res = await this.app.api.dispatchByName(
      request.module,
      { uc: request.uc, input: request.input },
      caller,
      trace,
    );
    io.out(JSON.stringify(res));
    return res.ok ? EXIT_OK : EXIT_REJECTED;
  }

  /** argv → запрос; ошибка ввода — текст для stderr. */
  private static parse(argv: readonly string[]): Result<CliRequest, string> {
    const [command, ...rest] = argv;
    if (!RunnerCli.isCommand(command)) {
      return err(\`неизвестная команда: \${command}\`);
    }
    const address = command === 'call' ? rest[0] : undefined;
    const args = command === 'call' ? rest.slice(1) : rest;
    const parsed = RunnerCli.options(command, args);
    if (!parsed.ok) return parsed;
    const { input, user } = parsed.value;
    if (user !== undefined && !v.is(USER_ID, user)) {
      return err(\`--user: не uuid — \${user}\`);
    }
    if (command === 'whoami') return ok({ command, user });
    return RunnerCli.call(address, input, user);
  }

  /** Адрес \`<module>.<operation>\` и JSON входа → запрос \`call\`. */
  private static call(
    address: string | undefined,
    raw: string | undefined,
    user: string | undefined,
  ): Result<CliRequest, string> {
    if (address === undefined || address.startsWith('--')) {
      return err('call: нужен адрес <module>.<operation>');
    }
    const [module, uc, ...extra] = address.split('.');
    if (!module || !uc || extra.length > 0) {
      return err(\`call: адрес «\${address}» — ожидается <module>.<operation>\`);
    }
    let input: unknown = {};
    if (raw !== undefined) {
      try {
        input = JSON.parse(raw);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return err(\`call: --input — не JSON: \${reason}\`);
      }
    }
    return ok({ command: 'call', module, uc, input, user });
  }

  private static isCommand(name: string | undefined): name is CliCommand {
    return name !== undefined && Object.hasOwn(OPTIONS, name);
  }

  /** Пары \`--имя значение\` из разрешённых для команды, каждая — один раз. */
  private static options(
    command: CliCommand,
    args: readonly string[],
  ): Result<CliOptions, string> {
    const options: CliOptions = {};
    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i] ?? '';
      const value = args[i + 1];
      const name = OPTIONS[command].find((option) => \`--\${option}\` === flag);
      if (name === undefined) {
        return err(\`\${command}: неизвестная опция \${flag}\`);
      }
      if (options[name] !== undefined) {
        return err(\`\${command}: \${flag} указан дважды\`);
      }
      if (value === undefined) {
        return err(\`\${command}: нет значения у \${flag}\`);
      }
      options[name] = value;
    }
    return ok(options);
  }
}
`;
  }

  private cliTest(): string {
    return `${this.imports([
      {
        from: 'bun:test',
        names: ['afterEach', 'beforeEach', 'describe', 'expect', 'it'],
      },
      { from: 'node:fs', names: ['mkdtempSync', 'rmSync'] },
      { from: 'node:os', names: ['tmpdir'] },
      { from: 'node:path', names: ['join'] },
      { from: 'dmg-core/testing', names: ['MemoryLogger'] },
      { from: this.from.app, names: ['App'] },
      { from: './runner-cli', names: ['RunnerCli', 'USAGE'] },
      { from: './runner-cli.types', names: ['type CliIo'] },
    ])}

// CLI-раннер: argv → резолвер Caller → вывод; коды выхода. Вывод — в буфер
// io, данные — во временном каталоге.

const USER = '5e3d1c2b-7a6f-4e8d-b9c0-a1f2e3d4c5b6';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'runner-cli-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** Буфер вывода: строки stdout и stderr. */
class BufferIo implements CliIo {
  readonly stdout: string[] = [];
  readonly stderr: string[] = [];
  out(line: string): void {
    this.stdout.push(line);
  }
  err(line: string): void {
    this.stderr.push(line);
  }
}

async function run(...argv: string[]) {
  const io = new BufferIo();
  const app = new App(
    { mode: 'test', dataDir: dir },
    { logger: new MemoryLogger() },
  );
  const code = await new RunnerCli(app).run(argv, io);
  return { code, io };
}

describe('RunnerCli: whoami', () => {
  it('без --user — гость, код 0', async () => {
    const res = await run('whoami');

    expect(res.code).toBe(0);
    expect(res.io.stdout).toEqual(['{"kind":"guest"}']);
  });

  it('--user — пользователь (резолвер без модуля пользователей), код 0', async () => {
    const res = await run('whoami', '--user', USER);

    expect(res.code).toBe(0);
    expect(res.io.stdout).toEqual(['{"kind":"user"}']);
  });

  it('--user без значения — ошибка ввода, код 1', async () => {
    const res = await run('whoami', '--user');

    expect(res.code).toBe(1);
    expect(res.io.stdout).toEqual([]);
    expect(res.io.stderr).toEqual(['whoami: нет значения у --user', USAGE]);
  });

  it('--user не uuid — ошибка ввода, код 1', async () => {
    const res = await run('whoami', '--user', 'admin');

    expect(res.code).toBe(1);
    expect(res.io.stderr).toEqual(['--user: не uuid — admin', USAGE]);
  });
});

describe('RunnerCli: call', () => {
  it('модуль не подключён — Result OPERATION_NOT_FOUND в stdout, код 2', async () => {
    const res = await run(
      'call',
      'missing.create',
      '--input',
      '{"title":"Хлеб"}',
      '--user',
      USER,
    );

    expect(res.code).toBe(2);
    expect(res.io.stderr).toEqual([]);
    expect(JSON.parse(res.io.stdout.join(''))).toMatchObject({
      ok: false,
      error: {
        code: 'OPERATION_NOT_FOUND',
        payload: { module: 'missing', uc: 'create' },
      },
    });
  });

  it('без адреса — ошибка ввода, код 1', async () => {
    const res = await run('call');

    expect(res.code).toBe(1);
    expect(res.io.stderr).toEqual([
      'call: нужен адрес <module>.<operation>',
      USAGE,
    ]);
  });

  it('адрес без операции — ошибка ввода, код 1', async () => {
    const res = await run('call', 'todo');

    expect(res.code).toBe(1);
    expect(res.io.stderr).toEqual([
      'call: адрес «todo» — ожидается <module>.<operation>',
      USAGE,
    ]);
  });

  it('--input не JSON — ошибка ввода, код 1', async () => {
    const res = await run('call', 'todo.createTask', '--input', '{title}');

    expect(res.code).toBe(1);
    expect(res.io.stdout).toEqual([]);
    expect(res.io.stderr[0]).toStartWith('call: --input — не JSON');
  });

  it('неизвестная или повторная опция — ошибка ввода, код 1', async () => {
    const unknown = await run('call', 'todo.createTask', '--title', 'Хлеб');
    const twice = await run('call', 'a.b', '--user', USER, '--user', USER);

    expect(unknown.code).toBe(1);
    expect(unknown.io.stderr).toEqual([
      'call: неизвестная опция --title',
      USAGE,
    ]);
    expect(twice.io.stderr).toEqual(['call: --user указан дважды', USAGE]);
  });
});

describe('RunnerCli', () => {
  it('без команды — справка в stdout, код 0', async () => {
    const res = await run();

    expect(res.code).toBe(0);
    expect(res.io.stdout).toEqual([USAGE]);
    expect(res.io.stderr).toEqual([]);
  });

  it('--help — справка, код 0', async () => {
    expect((await run('--help')).code).toBe(0);
  });

  it('неизвестная команда — stderr, код 1', async () => {
    const res = await run('drop-all');

    expect(res.code).toBe(1);
    expect(res.io.stdout).toEqual([]);
    expect(res.io.stderr).toEqual(['неизвестная команда: drop-all', USAGE]);
  });
});
`;
  }

  private main(): string {
    return `#!/usr/bin/env bun
/**
 * Точка входа раннера (D-50): окружение → \`App\`, запуск реакций, одна
 * команда CLI, код выхода; ошибка окружения — \`EXIT_CONFIG\`. \`process\` —
 * только здесь (ARC-09).
 *
 *   APP_DATA_DIR=data bun ${this.layout.runner}/main.ts whoami --user <uuid>
 *   APP_DATA_DIR=data bun ${this.layout.runner}/main.ts call todo.createTask \\
 *     --input '{}' --user <uuid>
 */

${this.imports([
  { from: this.from.app, names: ['App'] },
  { from: this.from.appTypes, names: ['type AppEnv'] },
  { from: './runner-cli', names: ['EXIT_CONFIG', 'RunnerCli'] },
  { from: './runner-env', names: ['RunnerEnv'] },
])}

// Ошибка окружения — ошибка конфигурации запуска: сообщение без стека и
// EXIT_CONFIG. Прочие исключения не ловятся — это сбой, нужен стек.
let env: AppEnv | undefined;
try {
  env = new RunnerEnv(process.env).toAppEnv();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = EXIT_CONFIG;
}

if (env !== undefined) {
  const app = new App(env);
  const stop = app.start();
  try {
    process.exitCode = await new RunnerCli(app).run(process.argv.slice(2), {
      out: (line) => console.log(line),
      err: (line) => console.error(line),
    });
  } finally {
    stop();
  }
}
`;
  }

  private mainTest(): string {
    return `import { afterEach, beforeEach, expect, it } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EXIT_CONFIG } from './runner-cli';

// Точка входа целиком: окружение процесса → приложение → код выхода.

const MAIN = join(import.meta.dir, 'main.ts');

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'main-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function run(vars: Record<string, string>, args: readonly string[]) {
  const proc = Bun.spawnSync(['bun', MAIN, ...args], {
    env: { ...process.env, ...vars },
  });
  return {
    code: proc.exitCode,
    stdout: proc.stdout.toString(),
    stderr: proc.stderr.toString(),
  };
}

it('--help — справка, код 0', () => {
  const res = run({ APP_DATA_DIR: dir }, ['--help']);

  expect(res.code).toBe(0);
  expect(res.stdout).toContain('Использование:');
});

it('whoami — вызывающий из резолвера приложения, код 0', () => {
  const res = run({ APP_DATA_DIR: dir }, ['whoami']);

  expect(res.code).toBe(0);
  expect(JSON.parse(res.stdout)).toEqual({ kind: 'guest' });
});

it('call — Result JSON в stdout; модуль не подключён — код 2', () => {
  const res = run({ APP_DATA_DIR: dir }, ['call', 'missing.create']);

  expect(res.code).toBe(2);
  expect(JSON.parse(res.stdout)).toMatchObject({
    ok: false,
    error: { code: 'OPERATION_NOT_FOUND' },
  });
});

it('неизвестная команда — код 1 у процесса', () => {
  expect(run({ APP_DATA_DIR: dir }, ['drop-all'])).toMatchObject({
    code: 1,
    stdout: '',
  });
});

it('ошибка окружения — код EXIT_CONFIG, сообщение без стека в stderr', () => {
  const res = run({ APP_DATA_DIR: '' }, ['--help']);

  expect(res.code).toBe(EXIT_CONFIG);
  expect(res.stdout).toBe('');
  expect(res.stderr.trim()).toBe('APP_DATA_DIR: не задан каталог данных');
});
`;
  }
}
