import { join } from 'node:path';
import { GenError } from '../../gen/cli';
import type { GenPlan } from '../../gen/plan';
import { AppSources } from './app-sources';
import { ProjectFiles } from './project-files';
import type { ScaffoldOptions } from './project-scaffold.types';
import { ScaffoldLayout } from './scaffold-layout';

/** Имя пакета npm: строчные, без пробелов, необязательный scope. */
const PACKAGE_NAME = /^(?:@[a-z0-9~-][a-z0-9._~-]*\/)?[a-z0-9~-][a-z0-9._~-]*$/;

/**
 * Каркас нового проекта (`dmg-core init --profile`) как план файлов:
 * конфиги проекта и исходники по раскладке профиля (`ScaffoldLayout`). План ничего не пишет — запись делает
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
    const { profile, name, pkg, root = '.' } = this.options;
    const layout = ScaffoldLayout.of(profile, name);
    const files = [
      ...new ProjectFiles(name, pkg, layout).files(),
      ...new AppSources(layout).files(),
    ];
    return {
      files: files.map((file) => ({
        path: join(root, file.path),
        content: file.content,
      })),
      edits: [],
    };
  }
}
