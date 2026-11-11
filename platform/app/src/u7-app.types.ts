import type { Logger } from '@u7-scl/core/shared';
import type { AppMode, ReplayStore } from 'dmg-core/app';

/**
 * Окружение приложения u7-school (D-50) — простые данные: раннер собирает
 * их из своего конфига, приложение само `process.env` не читает (ARC-09).
 */
export type U7AppEnv = {
  readonly mode: AppMode;
  /** Каталог данных: репозитории — `<dbDir>/…`, лог операций — `<dbDir>/oplog`. */
  readonly dbDir: string;
  /** Группа сообщества школы. */
  readonly communityGroup: { readonly id: number; readonly url: string };
  /** Группа студентов школы. */
  readonly studentGroup: { readonly id: number; readonly inviteUrl: string };
  /** Наставники школы; не заданы — тестовые вне production, статичные в production. */
  readonly mentors?: string[];
  /** Отсев повторов команд DMG (D-56); не задан — в памяти процесса. Бот — файловый `<dbDir>/replay`. */
  readonly replay?: ReplayStore;
};

/**
 * Подмена портов — для тестов и встраивания. Не задан — боевой:
 * `ConsoleLogger`.
 */
export type U7AppPorts = {
  readonly logger?: Logger;
};
