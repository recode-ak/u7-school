import { join } from 'node:path';
import { GenError } from '../../gen/cli';
import type { GenPlan } from '../../gen/plan';
import { LintMap } from './lint-map';
import { ProjectFiles } from './project-files';
import type { ScaffoldFile, ScaffoldOptions } from './project-scaffold.types';
import { SingleSources } from './single-sources';

/** Имя пакета npm: строчные, без пробелов, необязательный scope. */
const PACKAGE_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;

/**
 * Каркас нового проекта (`dmg-core init --profile`) как план файлов:
 * конфиги корня и исходники профиля. План ничего не пишет — запись делает
 * `applyPlan` (без перезаписи: коллизия — ошибка, ничего не записано).
 * Неверное имя проекта — `GenError` (ошибка ввода CLI, как у `gen`).
 */
export class ProjectScaffold {
  constructor(private readonly options: ScaffoldOptions) {
    if (!PACKAGE_NAME.test(options.name)) {
      throw new GenError(`Имя проекта «${options.name}» — не имя пакета npm`);
    }
  }

  plan(): GenPlan {
    const { name, pkg, root = '.' } = this.options;
    const files = [
      ...new ProjectFiles(name, pkg, this.lintMap()).files(),
      ...this.sources(),
    ];
    return {
      files: files.map((file) => ({
        path: join(root, file.path),
        content: file.content,
      })),
      edits: [],
    };
  }

  private lintMap(): LintMap {
    switch (this.options.profile) {
      case 'single':
        return LintMap.single;
    }
  }

  private sources(): ScaffoldFile[] {
    switch (this.options.profile) {
      case 'single':
        return new SingleSources().files();
    }
  }
}
