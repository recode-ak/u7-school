import { U7ApiModule } from '@u7-scl/app-legacy/domain';
import type {
  StreamApiModuleMeta,
  StreamApiModuleResolver,
} from '@u7-scl/domain/stream';

/**
 * Пустая оболочка legacy-модуля: все UC и Job stream — в Def-модуле
 * `stream.module.ts`. Удаляется в Ф3 вместе с `U7ApiModule`.
 */
export class StreamApiModule extends U7ApiModule<
  StreamApiModuleMeta,
  StreamApiModuleResolver
> {
  readonly name = 'stream' as const;
  readonly useCases = [];
  readonly reactions = [];
  readonly jobs = [];
}
