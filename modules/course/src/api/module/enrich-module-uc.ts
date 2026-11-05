import type { User } from '@u7-scl/app-legacy/domain';
import type { Module } from '@u7-scl/domain/course';
import {
  type EnrichModuleCmd,
  type EnrichModuleCmdMeta,
  EnrichModuleCmdSchema,
  LegacyModuleAr,
  LegacyModulePolicy,
  ModuleSchema,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case обогащения модуля (этап 2).
 * Устанавливает дополнительные поля: targetAudience, goal, result и т.д.
 * Редактировать может автор или ADMIN.
 */
export class EnrichModuleUc extends CourseUseCase<EnrichModuleCmdMeta> {
  protected readonly ucName = 'enrich-module' as const;
  protected readonly ucLabel = 'Обогатить модуль' as const;
  protected readonly arMeta = {
    arName: LegacyModuleAr.arName as 'Module',
    arLabel: LegacyModuleAr.arLabel as 'Модуль',
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = EnrichModuleCmdSchema;
  protected readonly outputSchema = ModuleSchema;

  async execute(command: EnrichModuleCmd, actor: User): Promise<Module> {
    const module = await this.getModule(command.moduleId);

    if (!LegacyModulePolicy.canEdit(actor, module)) {
      this.throwAccessDenied('Недостаточно прав для редактирования модуля');
    }

    const ar = new LegacyModuleAr(module);
    ar.enrich(command);
    await this.resolve.moduleRepo.save(ar.state);

    return ar.state;
  }
}
