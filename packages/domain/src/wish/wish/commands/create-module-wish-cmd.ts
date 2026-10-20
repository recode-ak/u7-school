import { ModuleSchema } from '@u7-scl/domain/course';
import * as v from 'valibot';
import type {
  ModuleNotFoundUcError,
  WishAlreadyExistsUcError,
} from '../errors';

/** Схема команды создания желания пройти модуль. */
export const CreateModuleWishCmdSchema = v.object({
  moduleId: ModuleSchema.entries.uuid,
});

/** Команда создания желания пройти модуль. */
export type CreateModuleWishCmd = v.InferOutput<
  typeof CreateModuleWishCmdSchema
>;

/** Мета команды создания желания пройти модуль. */
export interface CreateModuleWishCmdMeta {
  ucName: 'create-module-wish';
  arMeta: { name: 'Wish'; label: 'Желание' };
  input: CreateModuleWishCmd;
  output: undefined;
  errors: CreateModuleWishCmdError;
  requiresAuth: true;
  type: 'command';
}

/** Ошибки команды создания желания пройти модуль. */
export type CreateModuleWishCmdError =
  | ModuleNotFoundUcError
  | WishAlreadyExistsUcError;
