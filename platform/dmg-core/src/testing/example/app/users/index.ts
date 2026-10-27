// Вход прикладного пакета users для корня сборки (ARC-07, D-52): фабрика
// модуля и репозитории. UC снаружи не видны.
export { UserMemoryRepo } from './infra/user.memory-repo';
export type { UserRepo } from './user/user.repo';
export { createUsersModule, type UsersDeps } from './users.module';
