import { join } from 'node:path';
import type { ArchApp } from '#core/arch/arch-check';
import { TodoModuleDef } from './todo';

/**
 * Учебное приложение для `arch:check`: домен — `example/<m>`, прикладной
 * слой — `example/app/<m>` (в школе — `domain/src/<m>` и `<m>/src`); вход
 * модуля для других — `contract.ts` (D-45).
 */
export const ExampleArch: ArchApp = {
  name: 'example',
  entry: 'contract',
  modules: [TodoModuleDef],
  layout: (m) => ({
    domain: join(import.meta.dir, m),
    app: join(import.meta.dir, 'app', m),
  }),
};
