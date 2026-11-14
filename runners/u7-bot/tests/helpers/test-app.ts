import { TEST_SCHOOL, U7App, type U7CallerResolver } from '@u7-scl/app';
import { ConsoleLogger } from '@u7-scl/core/shared';
import { ReviewCampaignJsonRepo, ReviewJsonRepo } from '@u7-scl/peer-review';
import { WishJsonRepo } from '@u7-scl/wish';
import {
  type AnyModuleDef,
  type DomainError,
  type Result,
  UserCaller,
} from 'dmg-core';
import { type EventBus, type JobReport, Trace } from 'dmg-core/app';
import { testTrace } from 'dmg-core/testing';
import type { U7BotActor } from '../../src/core/u7-bot-app-meta';
import { getWorld, type WorldDefinition } from '../worlds';
import type { FixturePaths } from './fixture-loader';
import { cleanupFixtures, loadFixtures } from './fixture-loader';
import { TestClock } from './test-clock';

export interface TestApp {
  /** Полноценный ApiApp со всеми модулями */
  apiApp: U7App['apiApp'];
  /** Общая шина событий (та же, что внутри apiApp) — для TestBotTransport */
  eventBus: EventBus;
  /** Резолвер `Caller` приложения — субъект команд DMG из stories */
  callers: U7CallerResolver;
  /** Репозиторий желаний — для проверки статусов в тестах */
  wishRepo: WishJsonRepo;
  /** Репозиторий кампаний peer-review — проверка создания кампаний ER */
  reviewCampaignRepo: ReviewCampaignJsonRepo;
  /** Репозиторий отзывов peer-review — проверка сохранённых отзывов UC */
  reviewRepo: ReviewJsonRepo;
  /** Разовый прогон Job модуля DMG вне расписания */
  runJob<M extends AnyModuleDef>(
    module: M,
    job: M['jobs'][number],
  ): Promise<Result<JobReport, DomainError>>;
  /**
   * Актор бота по telegramId фикстуры: `Caller` — боевым резолвером
   * приложения; не человек (`UserCaller`) — ошибка теста.
   */
  userByTelegramId(telegramId: number): Promise<U7BotActor>;
  /** Управляемые часы — только если заданы опцией `clock` */
  clock?: TestClock;
  /** Пути к временным фикстурам */
  fixtures: FixturePaths;
  /** Удаляет временную директорию с фикстурами */
  cleanup: () => Promise<void>;
}

/** Якорь мира: `anchorDate` определения (по имени — из реестра) или реальное «сейчас». */
function worldAnchor(world: string | WorldDefinition = 'core-education'): Date {
  const def = typeof world === 'string' ? getWorld(world) : world;
  return def?.anchorDate ?? new Date();
}

/**
 * Боевая сборка приложения (`U7App`, D-50) над временной копией фикстур
 * мира: `dbDir` — каталог фикстур, раскладка `<dbDir>/…` та же, что у бота.
 * Репозитории желаний и peer-review и фасад курсов — второй экземпляр над
 * теми же файлами (без кеша): тесты проверяют ими сохранённое состояние.
 *
 * @param tag — метка для временной директории (обычно имя describe-блока)
 * @param world — имя или определение мира (по умолчанию `core-education`)
 * @param opts.clock — управляемые часы; `startAt` (мс или Date) не задан —
 *   старт с якоря мира (`anchorDate`), на который опираются относительные
 *   даты фикстур (`T-2d`). Без опции — реальное время. Подмена глобальна:
 *   `cleanup` возвращает её.
 */
export function createTestApp(
  tag: string | undefined,
  world: string | WorldDefinition | undefined,
  opts: { clock: { startAt?: number | Date } },
): Promise<TestApp & { clock: TestClock }>;
export function createTestApp(
  tag?: string,
  world?: string | WorldDefinition,
): Promise<TestApp>;
export async function createTestApp(
  tag?: string,
  world?: string | WorldDefinition,
  opts: { clock?: { startAt?: number | Date } } = {},
): Promise<TestApp> {
  const fixtures = await loadFixtures(tag, world);
  // Часы — после загрузки фикстур: сбой загрузки не оставит подмену `now`
  const clock = opts.clock
    ? new TestClock(opts.clock.startAt ?? worldAnchor(world))
    : undefined;
  const app = new U7App(
    {
      mode: 'test',
      dbDir: fixtures.dbDir,
      communityGroup: TEST_SCHOOL.communityGroup,
      studentGroup: TEST_SCHOOL.studentGroup,
      mentors: [...TEST_SCHOOL.mentors],
    },
    { logger: new ConsoleLogger() },
  );

  return {
    apiApp: app.apiApp,
    eventBus: app.eventBus,
    callers: app.callers,
    runJob: (module, job) => app.apiApp.runJob(module, job, Trace.forJob(job)),
    wishRepo: new WishJsonRepo(`${fixtures.dbDir}/wish/wishes.json`),
    reviewCampaignRepo: new ReviewCampaignJsonRepo(
      fixtures.peerReview.campaigns,
    ),
    reviewRepo: new ReviewJsonRepo(fixtures.peerReview.reviews),
    userByTelegramId: async (telegramId) => {
      const trace = testTrace();
      const caller = await app.callers.resolveByTelegramId(telegramId, trace);
      if (!(caller instanceof UserCaller)) {
        throw new Error(`Нет пользователя фикстуры tg=${telegramId}`);
      }
      return caller;
    },
    ...(clock ? { clock } : {}),
    fixtures,
    cleanup: async () => {
      clock?.restore();
      await cleanupFixtures(fixtures);
    },
  };
}
