import type { Logger } from '@u7-scl/core/shared';
import type { AppMode, EventBus, ReplayStore } from 'dmg-core/app';
import type { School } from './school';

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
 * `ConsoleLogger`, история прогонов в `<dbDir>/jobs/last-runs.json`,
 * задержка первого прогона задания по умолчанию пакета (D-71).
 */
export type U7AppPorts = {
  readonly logger?: Logger;
  /** Задержка первого прогона задания после `start()`, мс (D-71). */
  readonly jobStartDelayMs?: number;
};

/**
 * Глобальные зависимости уровня приложения u7-school (D-50): логгер, режим,
 * шина DMG и школа. Содержит `School` — сущность, которой живут UI, бот и скрипты.
 */
export type U7AppResolver = {
  readonly logger: Logger;
  readonly mode: AppMode;
  /** Шина DMG — та же, на которой работает `apiApp`. */
  readonly eventBus: EventBus;
  readonly school: School;
};
