import type { User } from '@u7-scl/app-legacy/domain';
import type { Module } from '@u7-scl/domain/course';
import {
  LegacyModuleAr,
  LegacyModulePolicy,
  ModuleSchema,
  type PublishModuleCmd,
  type PublishModuleCmdMeta,
  PublishModuleCmdSchema,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case публикации модуля (этап 4).
 * Публиковать может автор или ADMIN.
 */
export class PublishModuleUc extends CourseUseCase<PublishModuleCmdMeta> {
  protected readonly ucName = 'publish-module' as const;
  protected readonly ucLabel = 'Опубликовать модуль (этап 4)' as const;
  protected readonly arMeta = {
    arName: LegacyModuleAr.arName as 'Module',
    arLabel: LegacyModuleAr.arLabel as 'Модуль',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = PublishModuleCmdSchema;
  protected readonly outputSchema = ModuleSchema;

  async execute(command: PublishModuleCmd, actor: User): Promise<Module> {
    const module = await this.getModule(command.moduleId);

    if (!LegacyModulePolicy.canEdit(actor, module)) {
      this.throwAccessDenied('Недостаточно прав для редактирования модуля');
    }

    const ar = new LegacyModuleAr(module);
    ar.publish();
    await this.resolve.moduleRepo.save(ar.state);

    return ar.state;
  }
}
