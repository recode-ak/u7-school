import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { GenError } from '../gen/cli';
import { GenLayout } from '../gen/layout';
import { runGen } from '../gen/main';
import { CliConfig, type CliSettings } from './cli-config';
import { Delivery } from './delivery';
import { InstructionsBlock } from './instructions-block';
import type { PackageSource } from './package-source';
import { InitArgs } from './scaffold/init-args';
import { ProjectInit } from './scaffold/project-init';
import type { InitOptions } from './scaffold/project-scaffold.types';

/** Итог команды: ok — проект согласован с пакетом */
export interface CliResult {
  ok: boolean;
  messages: string[];
}

/** Доставка по настройкам проекта; instructions — файл для вставки */
interface Prepared {
  delivery: Delivery;
  instructions?: string;
}

/**
 * Команды пакета в проекте:
 *   init         — создать `dmg-core.json` (если нет) и выполнить sync;
 *   init --profile — каркас проекта (`ProjectInit`), затем sync;
 *   sync         — обновить копии скилов, ролей и вставку в инструкции;
 *   sync --check — сообщить о расхождениях, ничего не меняя;
 *   gen          — создать файлы модуля по раскладке `gen` (без конфига —
 *                  раскладка по умолчанию).
 */
export class DmgCoreCli {
  private readonly block: InstructionsBlock;
  private readonly config: CliConfig;

  constructor(private readonly pkg: PackageSource) {
    this.block = new InstructionsBlock(pkg.version);
    this.config = new CliConfig(pkg);
  }

  /** argv — аргументы после `init`; без `--profile` — прежнее поведение */
  async init(root: string, argv: readonly string[] = []): Promise<CliResult> {
    let args: InitArgs;
    try {
      args = InitArgs.parse(argv);
    } catch (error) {
      return this.failure(error);
    }
    if (args.profile !== undefined)
      return this.scaffold(root, {
        profile: args.profile,
        name: args.name,
        dryRun: args.dryRun,
      });
    const path = join(root, CliConfig.file);
    if (!(await Bun.file(path).exists())) {
      const defaults = this.config.defaults();
      await writeFile(path, `${JSON.stringify(defaults, null, 2)}\n`);
    }
    return this.sync(root);
  }

  /** Каркас (без перезаписи), затем sync; dry-run — только план */
  private async scaffold(
    root: string,
    options: InitOptions,
  ): Promise<CliResult> {
    let lines: string[];
    try {
      lines = await new ProjectInit(this.pkg).run(root, options);
    } catch (error) {
      return this.failure(error);
    }
    if (options.dryRun) return { ok: true, messages: lines };
    const synced = await this.sync(root);
    return {
      ok: synced.ok,
      messages: [...lines, ...synced.messages, ProjectInit.next],
    };
  }

  /** Ошибка ввода или коллизия (`GenError`) — не ok; прочее — дефект */
  private failure(error: unknown): CliResult {
    if (error instanceof GenError)
      return { ok: false, messages: [`Ошибка: ${error.message}`] };
    throw error;
  }

  async sync(root: string): Promise<CliResult> {
    const prepared = await this.prepare(root);
    if (typeof prepared === 'string')
      return { ok: false, messages: [prepared] };
    const { delivery, instructions } = prepared;
    const inspection = await delivery.inspect(root);
    await delivery.apply(root, inspection);
    if (instructions) {
      const text = await this.read(root, instructions);
      const next = this.block.apply(text);
      if (next !== text) await writeFile(join(root, instructions), next);
    }
    const messages = inspection.findings
      .filter((finding) => inspection.foreign.includes(finding.path))
      .map((finding) => `${finding.message}: ${finding.path}`);
    return { ok: messages.length === 0, messages };
  }

  async check(root: string): Promise<CliResult> {
    const prepared = await this.prepare(root);
    if (typeof prepared === 'string')
      return { ok: false, messages: [prepared] };
    const { delivery, instructions } = prepared;
    const messages = (await delivery.inspect(root)).findings.map(
      (finding) => `${finding.message}: ${finding.path}`,
    );
    if (
      instructions &&
      !this.block.isCurrent(await this.read(root, instructions))
    ) {
      messages.push(`нет вставки dmg-core или она устарела: ${instructions}`);
    }
    return { ok: messages.length === 0, messages };
  }

  /** Генератор; root — корень проекта, от него пути раскладки */
  async gen(root: string, argv: readonly string[]): Promise<CliResult> {
    const settings = await this.settings(root);
    if (settings === undefined)
      return this.generate(root, argv, this.config.defaults());
    if (typeof settings === 'string')
      return { ok: false, messages: [settings] };
    return this.generate(root, argv, settings);
  }

  private generate(
    root: string,
    argv: readonly string[],
    settings: CliSettings,
  ): CliResult {
    const messages: string[] = [];
    const code = runGen(argv, new GenLayout(settings.gen, root), (line) =>
      messages.push(line),
    );
    return { ok: code === 0, messages };
  }

  /** Настройки проекта → доставка; строка — сообщение об ошибке конфига */
  private async prepare(root: string): Promise<Prepared | string> {
    const settings = await this.settings(root);
    if (settings === undefined) {
      return `нет ${CliConfig.file} — запусти dmg-core init`;
    }
    if (typeof settings === 'string') return settings;
    return {
      delivery: new Delivery(this.pkg, settings),
      instructions: settings.instructions ?? undefined,
    };
  }

  /** Настройки из `dmg-core.json`; undefined — файла нет, строка — ошибка */
  private async settings(
    root: string,
  ): Promise<CliSettings | string | undefined> {
    const text = await readFile(join(root, CliConfig.file), 'utf8').catch(
      () => undefined,
    );
    if (text === undefined) return undefined;
    try {
      return this.config.parse(JSON.parse(text));
    } catch (error) {
      const message = (error as Error).message;
      return message.startsWith(CliConfig.file)
        ? message
        : `${CliConfig.file}: ${message}`;
    }
  }

  private read(root: string, path: string): Promise<string> {
    return readFile(join(root, path), 'utf8').catch(() => '');
  }
}
