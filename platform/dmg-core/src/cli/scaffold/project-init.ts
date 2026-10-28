import { readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { applyPlan } from '../../gen/apply';
import type { PackageSource } from '../package-source';
import { ProjectManifest } from './project-manifest';
import { ProjectScaffold } from './project-scaffold';
import type { InitOptions } from './project-scaffold.types';

/** Файл, который каркас сливает с существующим, а не создаёт. */
const MANIFEST = 'package.json';

/** Пакет, от которого зависят пакеты monorepo. */
const DMG_CORE = 'dmg-core';

/**
 * Каркас в каталог проекта (`dmg-core init --profile`): имя проекта
 * (`--name` → `name` из package.json → имя каталога), план
 * `ProjectScaffold`, запись `applyPlan` без перезаписи.
 *
 * Существующий `package.json` сливается (`ProjectManifest`): он убирается
 * из плана, слитый текст считается до записи и пишется последним — после
 * того, как `applyPlan` проверил коллизии и записал остальное; добавлять
 * нечего — файл не переписывается и не упоминается в выводе. Конфликт
 * слияния или коллизия — `GenError` до любой записи: ничего не записано.
 * Возвращает строки вывода; первая — профиль и имя.
 */
export class ProjectInit {
  /** Подсказка следующего шага после записи каркаса. */
  static readonly next = 'Дальше: bun install, затем bun run check';

  constructor(private readonly pkg: PackageSource) {}

  async run(root: string, options: InitOptions): Promise<string[]> {
    const manifestPath = join(root, MANIFEST);
    const existing = await readFile(manifestPath, 'utf8').catch(
      () => undefined,
    );
    const manifest =
      existing === undefined ? undefined : ProjectManifest.parse(existing);
    const name = options.name ?? manifest?.name() ?? basename(resolve(root));
    const plan = new ProjectScaffold({
      profile: options.profile,
      name,
      pkg: this.pkg,
      root,
    }).plan();

    let merged: string | undefined;
    if (manifest !== undefined) {
      const scaffold = plan.files.find((f) => f.path === manifestPath);
      plan.files = plan.files.filter((f) => f !== scaffold);
      merged =
        scaffold &&
        manifest.merge(this.withOverride(scaffold.content, manifest, options));
    }

    const write = !options.dryRun;
    const result = applyPlan(plan, { write });
    if (write && merged !== undefined) {
      await writeFile(manifestPath, merged);
    }
    const lines = [`Каркас ${options.profile}: ${name}`];
    const created = write ? 'Создан' : 'Будет создан';
    for (const path of result.written)
      lines.push(`${created}: ${relative(root, path)}`);
    if (merged !== undefined)
      lines.push(`${write ? 'Дополнен' : 'Будет дополнен'}: ${MANIFEST}`);
    if (!write) lines.push('Это dry-run. Для записи убери --dry-run.');
    return lines;
  }

  /**
   * Пакеты monorepo зависят от `dmg-core` диапазоном реестра; если корень
   * поставил его не из реестра (tarball, `file:`, `link:`, путь), без
   * `overrides` `bun install` ищет пакеты в реестре и падает. Каркас
   * добавляет `overrides.dmg-core` с тем же спецификатором; другое значение
   * у проекта — конфликт слияния. В `single` пакетов нет — `overrides` нет.
   */
  private withOverride(
    scaffold: string,
    manifest: ProjectManifest,
    options: InitOptions,
  ): string {
    const spec = manifest.localSpec(DMG_CORE);
    if (options.profile !== 'monorepo' || spec === undefined) return scaffold;
    return JSON.stringify({
      ...JSON.parse(scaffold),
      overrides: { [DMG_CORE]: spec },
    });
  }
}
