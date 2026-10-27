import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import type { ResolvedImport } from './source-scan.types';

const IMPORT =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\sfrom\s*)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

/**
 * Чтение исходников для проверок по файлам: `.ts`-файлы каталога, их
 * импорты с разрешёнными путями и принадлежность пути каталогу или его
 * входу. Общий для `FileChecker` (модули) и `AssemblyChecker` (корень
 * сборки и раннеры).
 */
export class SourceScan {
  /** `.ts`-файлы каталога, относительные пути через `/`, по алфавиту. */
  files(base: string): string[] {
    if (!existsSync(base)) return [];
    return [...new Bun.Glob('**/*.ts').scanSync({ cwd: base })]
      .map((f) => f.split(sep).join('/'))
      .sort();
  }

  /** Импорты файла с абсолютной целью; неразрешимые пакеты пропускаются. */
  imports(file: string): ResolvedImport[] {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(IMPORT)].flatMap((m) => {
      const spec = m[1] ?? m[2];
      if (spec === undefined) return [];
      const target = this.resolve(spec, dirname(file));
      return target === undefined ? [] : [{ spec, target }];
    });
  }

  inside(path: string, dir: string): boolean {
    return path === dir || path.startsWith(dir + sep);
  }

  /**
   * Цель импорта — вход каталога: `<dir>/<entry>.ts` или `<dir>/<entry>`;
   * для `index` — также сам `<dir>`.
   */
  isEntry(path: string, dir: string, entry: string): boolean {
    const bare = path.replace(/\.[jt]s$/, '');
    return bare === join(dir, entry) || (entry === 'index' && bare === dir);
  }

  private resolve(spec: string, from: string): string | undefined {
    if (spec.startsWith('.')) return resolve(from, spec);
    try {
      return Bun.resolveSync(spec, from);
    } catch {
      return undefined;
    }
  }
}
