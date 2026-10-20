import type { User } from '@u7-scl/app/domain';
import { ModuleAr } from '#domain-legacy/module/a-root';
import {
  type AddProjectCmd,
  type AddProjectCmdMeta,
  AddProjectCmdSchema,
} from '#domain-legacy/module/commands/add-project-cmd';
import type { Module } from '#domain-legacy/module/entity';
import { ModuleSchema } from '#domain-legacy/module/entity';
import { ModulePolicy } from '#domain-legacy/module/policy';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case добавления проекта в модуль.
 * Редактировать может автор или ADMIN.
 */
export class AddProjectUc extends CourseUseCase<AddProjectCmdMeta> {
  protected readonly ucName = 'add-project' as const;
  protected readonly ucLabel = 'Добавить проект в модуль' as const;
  protected readonly arMeta = {
    arName: ModuleAr.arName as 'Module',
    arLabel: ModuleAr.arLabel as 'Модуль',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = AddProjectCmdSchema;
  protected readonly outputSchema = ModuleSchema;

  async execute(command: AddProjectCmd, actor: User): Promise<Module> {
    const module = await this.getModule(command.moduleId);

    if (!ModulePolicy.canEdit(actor, module)) {
      this.throwAccessDenied('Недостаточно прав для редактирования модуля');
    }

    const ar = new ModuleAr(module);
    ar.addProject(command);
    await this.resolve.moduleRepo.save(ar.state);

    return ar.state;
  }
}
