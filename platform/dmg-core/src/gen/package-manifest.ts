import { GenError } from './cli';

/** Разобранный `package.json`: только то, что правит генератор. */
type Manifest = { dependencies?: Record<string, string> };

/**
 * `package.json`, который правит генератор: разбор (битый JSON — `GenError`
 * с путём, без стека) и добавление зависимости. Текст пишется в форме
 * каркаса: `JSON.stringify` с отступом 2 и переводом строки в конце.
 */
export class PackageManifest {
  private constructor(private readonly data: Manifest) {}

  static parse(path: string, text: string): PackageManifest {
    try {
      return new PackageManifest(JSON.parse(text) as Manifest);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GenError(`${path}: не разобран JSON (${message})`);
    }
  }

  /** Текст с добавленной зависимостью; undefined — она уже объявлена. */
  withDependency(name: string, version: string): string | undefined {
    if (this.data.dependencies?.[name] !== undefined) return undefined;
    const data = {
      ...this.data,
      dependencies: { ...this.data.dependencies, [name]: version },
    };
    return `${JSON.stringify(data, null, 2)}\n`;
  }
}
