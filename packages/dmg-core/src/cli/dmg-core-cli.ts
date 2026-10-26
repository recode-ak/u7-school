import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CliConfig } from './cli-config';
import { Delivery } from './delivery';
import { InstructionsBlock } from './instructions-block';
import type { PackageSource } from './package-source';

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
 * Команды доставки пакета в проект:
 *   init         — создать `dmg-core.json` (если нет) и выполнить sync;
 *   sync         — обновить копии скилов, ролей и вставку в инструкции;
 *   sync --check — сообщить о расхождениях, ничего не меняя.
 */
export class DmgCoreCli {
  private readonly block: InstructionsBlock;
  private readonly config: CliConfig;

  constructor(private readonly pkg: PackageSource) {
    this.block = new InstructionsBlock(pkg.version);
    this.config = new CliConfig(pkg);
  }

  async init(root: string): Promise<CliResult> {
    const path = join(root, CliConfig.file);
    if (!(await Bun.file(path).exists())) {
      const defaults = this.config.defaults();
      await writeFile(path, `${JSON.stringify(defaults, null, 2)}\n`);
    }
    return this.sync(root);
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

  /** Настройки проекта → доставка; строка — сообщение об ошибке конфига */
  private async prepare(root: string): Promise<Prepared | string> {
    const text = await readFile(join(root, CliConfig.file), 'utf8').catch(
      () => undefined,
    );
    if (text === undefined) {
      return `нет ${CliConfig.file} — запусти dmg-core init`;
    }
    try {
      const settings = this.config.parse(JSON.parse(text));
      return {
        delivery: new Delivery(this.pkg, settings),
        instructions: settings.instructions ?? undefined,
      };
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
