// dmg-core/arch — контрактные проверки архитектуры (`bun run arch:check`).

export { type ArchApp, archCheck } from './arch-check';
export { RULES_DOC, reportArchCheck } from './arch-report';
export { checkDefs } from './check-defs';
export { checkFiles, type ModuleLayout } from './check-files';
export { type ArchRule, Violation } from './violation';
