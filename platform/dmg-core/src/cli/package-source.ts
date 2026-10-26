import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Role } from './role';

/** Файлы скила: путь от каталога скила → содержимое */
export type SkillFiles = Map<string, string>;

/** Что пакет поставляет в проект: скилы, роли и общий блок ролей */
export class PackageSource {
  private constructor(
    readonly version: string,
    readonly skills: Map<string, SkillFiles>,
    readonly roles: Role[],
    readonly common: string,
  ) {}

  /** Читает поставку из корня пакета (`skills/`, `agents/`, `package.json`) */
  static async load(root: string): Promise<PackageSource> {
    const manifest = JSON.parse(
      await readFile(join(root, 'package.json'), 'utf8'),
    ) as { version: string };

    const skills = new Map<string, SkillFiles>();
    const skillPaths = await PackageSource.scan(root, 'skills', '**/*');
    for (const path of skillPaths) {
      const [name, ...rest] = path.split('/');
      if (!name || rest.length === 0) continue;
      const files = skills.get(name) ?? new Map<string, string>();
      files.set(
        rest.join('/'),
        await readFile(join(root, 'skills', path), 'utf8'),
      );
      skills.set(name, files);
    }

    const roles: Role[] = [];
    for (const path of await PackageSource.scan(root, 'agents/roles', '*.md')) {
      const file = `agents/roles/${path}`;
      roles.push(Role.parse(file, await readFile(join(root, file), 'utf8')));
    }

    const common = await readFile(join(root, 'agents/common.md'), 'utf8').catch(
      () => '',
    );
    return new PackageSource(manifest.version, skills, roles, common);
  }

  private static async scan(
    root: string,
    dir: string,
    pattern: string,
  ): Promise<string[]> {
    const paths: string[] = [];
    const glob = new Bun.Glob(pattern);
    for await (const path of glob.scan({ cwd: join(root, dir), dot: true })) {
      paths.push(path);
    }
    return paths.sort();
  }
}
