import * as v from 'valibot';
import type { Command } from '#core/domain/contracts/command';
import { F } from '#core/kernel/fields/fields';
import { err, ok, type Result } from '#core/kernel/result/result';
import { Trace } from '#core/kernel/trace/trace';
import {
  CreateTaskUcDef,
  ListTasksUcDef,
  TodoModuleDef,
} from '#core/testing/example/todo/contract';
import type { ExampleApp } from '../app/example-app';
import type { CliIo } from './example-cli.types';

/** Коды выхода: успех, ошибка ввода, бизнес-отказ (`Err` операции). */
export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_REJECTED = 2;

export const USAGE =
  'Использование: create-task --title <текст> [--user <uuid>] | list-tasks [--user <uuid>]';

/** Опции каждой команды; `--user` — общая, без неё вызов от гостя. */
const OPTIONS = {
  'create-task': ['title', 'user'],
  'list-tasks': ['user'],
} as const;

const USER_ID = F.uuid('пользователя');

type CliCommand = keyof typeof OPTIONS;
type OptionOf<C extends CliCommand> = (typeof OPTIONS)[C][number];
type Options<C extends CliCommand> = Partial<Record<OptionOf<C>, string>>;

/** Разобранная команда CLI. */
type CliRequest =
  | {
      readonly command: 'create-task';
      readonly title: string;
      readonly user?: string;
    }
  | { readonly command: 'list-tasks'; readonly user?: string };

/** UC `todo`, которые умеет CLI: одна точка `dispatch` на все команды. */
type TodoUcDef = typeof CreateTaskUcDef | typeof ListTasksUcDef;

/**
 * CLI-раннер учебного приложения (D-50) — транспорт: разбирает argv, строит
 * `Trace` (канал `cli`, новый `requestId` на запуск), получает `Caller` от
 * резолвера приложения и вызывает UC `todo` через `api.dispatch`. `Result`
 * печатает JSON в stdout. Модули не собирает, решений не принимает.
 * Новая команда — опции в `OPTIONS`, вариант `CliRequest`, ветка в
 * `parse` и в `command`.
 */
export class ExampleCli {
  constructor(private readonly app: ExampleApp) {}

  async run(argv: readonly string[], io: CliIo): Promise<number> {
    const parsed = ExampleCli.parse(argv);
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
    const res = await this.app.api.dispatch(
      TodoModuleDef,
      ExampleCli.command(request),
      caller,
      trace,
    );
    io.out(JSON.stringify(res));
    return res.ok ? EXIT_OK : EXIT_REJECTED;
  }

  /** Запрос CLI → команда UC. */
  private static command(request: CliRequest): Command<TodoUcDef> {
    switch (request.command) {
      case 'create-task':
        return CreateTaskUcDef.command({ title: request.title });
      case 'list-tasks':
        return ListTasksUcDef.command({});
    }
  }

  /** argv → запрос; ошибка ввода — текст для stderr. */
  private static parse(argv: readonly string[]): Result<CliRequest, string> {
    const [command, ...args] = argv;
    if (!ExampleCli.isCommand(command)) {
      return err(`неизвестная команда: ${command ?? '—'}`);
    }
    const parsed = ExampleCli.options(command, args);
    if (!parsed.ok) return parsed;
    const { title, user } = parsed.value;
    if (user !== undefined && !v.is(USER_ID, user)) {
      return err(`--user: не uuid — ${user}`);
    }
    switch (command) {
      case 'create-task':
        if (title === undefined) return err('create-task: нужен --title');
        return ok({ command, title, user });
      case 'list-tasks':
        return ok({ command, user });
    }
  }

  private static isCommand(name: string | undefined): name is CliCommand {
    return name !== undefined && Object.hasOwn(OPTIONS, name);
  }

  /** Пары `--имя значение` из разрешённых для команды, каждая — один раз. */
  private static options<C extends CliCommand>(
    command: C,
    args: readonly string[],
  ): Result<Options<C>, string> {
    const allowed: readonly OptionOf<C>[] = OPTIONS[command];
    const options: Options<C> = {};
    for (let i = 0; i < args.length; i += 2) {
      const flag = args[i] ?? '';
      const value = args[i + 1];
      const name = allowed.find((option) => `--${option}` === flag);
      if (name === undefined) {
        return err(`${command}: неизвестная опция ${flag}`);
      }
      if (options[name] !== undefined) {
        return err(`${command}: ${flag} указан дважды`);
      }
      if (value === undefined || value.startsWith('--')) {
        return err(`${command}: нет значения у ${flag}`);
      }
      options[name] = value;
    }
    return ok(options);
  }
}
