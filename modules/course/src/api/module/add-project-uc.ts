import type { User } from '@u7-scl/app-legacy/domain';
import type { Module } from '@u7-scl/domain/course';
import {
  type AddProjectCmd,
  type AddProjectCmdMeta,
  AddProjectCmdSchema,
  LegacyModuleAr,
  LegacyModulePolicy,
  ModuleSchema,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case добавления проекта в модуль.
 * Редактировать может автор или ADMIN.
 */
export class AddProjectUc extends CourseUseCase<AddProjectCmdMeta> {
  protected readonly ucName = 'add-project' as const;
  protected readonly ucLabel = 'Добавить проект в модуль' as const;
  protected readonly arMeta = {
    arName: LegacyModuleAr.arName as 'Module',
    arLabel: LegacyModuleAr.arLabel as 'Модуль',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = AddProjectCmdSchema;
  protected readonly outputSchema = ModuleSchema;

  async execute(command: AddProjectCmd, actor: User): Promise<Module> {
    const module = await this.getModule(command.moduleId);

    if (!LegacyModulePolicy.canEdit(actor, module)) {
      this.throwAccessDenied('Недостаточно прав для редактирования модуля');
    }

    const ar = new LegacyModuleAr(module);
    ar.addProject(command);
    await this.resolve.moduleRepo.save(ar.state);

    return ar.state;
  }
}
