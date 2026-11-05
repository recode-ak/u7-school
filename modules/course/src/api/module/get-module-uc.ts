import type { User } from '@u7-scl/app-legacy/domain';
import type {
  GetModuleCmd,
  GetModuleCmdMeta,
  Module,
} from '@u7-scl/domain/course';
import {
  GetModuleCmdSchema,
  LegacyModuleAr,
  ModuleSchema,
} from '@u7-scl/domain/course';
import { CourseUseCase } from '../course-uc';

/**
 * Use-case получения модуля по UUID.
 */
export class GetModuleUc extends CourseUseCase<GetModuleCmdMeta> {
  protected readonly ucName = 'get-module' as const;
  protected readonly ucLabel = 'Получить модуль по UUID' as const;
  protected readonly arMeta = {
    arName: LegacyModuleAr.arName as 'Module',
    arLabel: LegacyModuleAr.arLabel as 'Модуль',
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = false as const;
  protected readonly inputSchema = GetModuleCmdSchema;
  protected readonly outputSchema = ModuleSchema;

  async execute(command: GetModuleCmd, actor?: User): Promise<Module> {
    const module = await this.getModule(command.uuid);
    // Актор приходит параметром (объект или undefined для анонимных запросов)
    return this.getOutModule(module, actor);
  }
}
