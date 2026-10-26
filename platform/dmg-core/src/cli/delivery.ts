import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { CliSettings } from './cli-config';
import { Marker } from './marker';
import type { PackageSource } from './package-source';

/** Ожидаемая копия; owner — файл, чья метка решает, наша ли копия */
interface Copy {
  text: string;
  owner: string;
}

/** Найденное расхождение копии с пакетом */
export interface Finding {
  path: string;
  message: string;
}

/** Итог сверки проекта с пакетом (пути от корня проекта) */
export interface Inspection {
  /** Копии, которые надо записать (нет или расходится) */
  write: string[];
  /** Свои копии без источника — файлы и каталоги скилов */
  stale: string[];
  /** Файлы проекта на месте копий — не трогаются */
  foreign: string[];
  findings: Finding[];
}

/**
 * Доставка скилов и ролей пакета в проект по настройкам: ожидаемые копии,
 * сверка с файлами проекта и запись. Своими считаются только файлы с меткой.
 */
export class Delivery {
  readonly marker: Marker;
  private readonly copies: Map<string, Copy>;

  constructor(
    private readonly pkg: PackageSource,
    private readonly settings: CliSettings,
  ) {
    this.marker = new Marker(pkg.version);
    this.copies = this.build();
  }

  /** Сверяет файлы проекта в root с ожидаемыми копиями */
  async inspect(root: string): Promise<Inspection> {
    const result: Inspection = {
      write: [],
      stale: [],
      foreign: [],
      findings: [],
    };
    const read = (path: string) =>
      readFile(join(root, path), 'utf8').catch(() => undefined);

    for (const [path, copy] of this.copies) {
      const owner = await read(copy.owner);
      if (owner !== undefined && Marker.versionOf(owner) === undefined) {
        if (!result.foreign.includes(copy.owner)) {
          result.foreign.push(copy.owner);
          result.findings.push({
            path: copy.owner,
            message:
              'файл не от dmg-core (удали его или исключи роль/скил в dmg-core.json)',
          });
        }
        continue;
      }
      const actual = await read(path);
      if (actual === copy.text) continue;
      result.write.push(path);
      result.findings.push({ path, message: this.describe(actual) });
    }

    for (const path of await this.staleCopies(root)) {
      result.stale.push(path);
      result.findings.push({ path, message: 'копия без источника' });
    }
    result.findings.sort((a, b) => a.path.localeCompare(b.path));
    return result;
  }

  /** Пишет недостающие и устаревшие копии, удаляет свои копии без источника */
  async apply(root: string, inspection: Inspection): Promise<void> {
    for (const path of inspection.write) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), this.copies.get(path)?.text ?? '');
    }
    for (const path of inspection.stale) {
      await rm(join(root, path), { recursive: true, force: true });
    }
  }

  private describe(actual: string | undefined): string {
    if (actual === undefined) return 'нет копии';
    const version = Marker.versionOf(actual);
    if (version !== undefined && version !== this.marker.version) {
      return `устарела (${version} → ${this.marker.version})`;
    }
    return 'расходится с пакетом (правлена руками?)';
  }

  private build(): Map<string, Copy> {
    const copies = new Map<string, Copy>();
    const { skills, roles } = this.settings;
    for (const dir of skills.dirs) {
      for (const name of skills.names) {
        const owner = `${dir}/${name}/SKILL.md`;
        for (const [file, text] of this.pkg.skills.get(name) ?? []) {
          copies.set(`${dir}/${name}/${file}`, {
            text: file.endsWith('.md') ? this.marker.mark(text) : text,
            owner,
          });
        }
      }
    }
    const selected = this.pkg.roles.filter((role) =>
      roles.names.includes(role.name),
    );
    for (const target of roles.targets) {
      for (const role of selected) {
        const path = `${target.dir}/${role.name}.md`;
        const text = role.render(target.format, this.marker, this.pkg.common);
        copies.set(path, { text, owner: path });
      }
      if (target.format === 'neutral') {
        const text = this.marker.mark(this.pkg.common);
        copies.set(target.common, { text, owner: target.common });
      }
    }
    return copies;
  }

  /** Свои копии (с меткой), которых нет среди ожидаемых */
  private async staleCopies(root: string): Promise<string[]> {
    const stale: string[] = [];
    const generated = async (path: string) =>
      Marker.versionOf(
        await readFile(join(root, path), 'utf8').catch(() => ''),
      ) !== undefined;

    for (const target of this.settings.roles.targets) {
      for (const file of await Delivery.scan(root, target.dir, '*.md')) {
        const path = `${target.dir}/${file}`;
        if (!this.copies.has(path) && (await generated(path))) stale.push(path);
      }
    }
    for (const dir of this.settings.skills.dirs) {
      for (const file of await Delivery.scan(root, dir, '*/SKILL.md')) {
        const name = file.split('/')[0] ?? '';
        if (!(await generated(`${dir}/${file}`))) continue;
        if (!this.settings.skills.names.includes(name)) {
          stale.push(`${dir}/${name}`);
          continue;
        }
        for (const inner of await Delivery.scan(
          root,
          `${dir}/${name}`,
          '**/*',
        )) {
          const path = `${dir}/${name}/${inner}`;
          if (!this.copies.has(path)) stale.push(path);
        }
      }
    }
    return stale;
  }

  private static async scan(
    root: string,
    dir: string,
    pattern: string,
  ): Promise<string[]> {
    const paths: string[] = [];
    const glob = new Bun.Glob(pattern);
    try {
      for await (const path of glob.scan({ cwd: join(root, dir), dot: true })) {
        paths.push(path);
      }
    } catch {
      return [];
    }
    return paths.sort();
  }
}
