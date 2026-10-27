// Вход прикладного пакета todo для корня сборки (ARC-07, D-52): фабрика
// модуля и репозитории. UC, ER и Job снаружи не видны.
export { TaskJsonRepo } from './infra/task.json-repo';
export type { TaskRepo } from './task/task.repo';
export { createTodoModule, type TodoDeps } from './todo.module';
