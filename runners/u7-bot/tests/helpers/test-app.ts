import { U7App, type U7CallerResolver } from '@u7-scl/app';
import { TEST_SCHOOL } from '@u7-scl/app-legacy/domain';
import type { U7BotApp } from '@u7-scl/bot/u7-bot-app-meta';
import type { EventBus } from '@u7-scl/core/domain';
import { ConsoleLogger } from '@u7-scl/core/shared';
import { ReviewCampaignJsonRepo, ReviewJsonRepo } from '@u7-scl/peer-review';
import type { UserInProcFacade } from '@u7-scl/user/infra';
import { WishJsonRepo } from '@u7-scl/wish';
import type { AnyModuleDef, DomainError, Result } from 'dmg-core';
import { type JobReport, Trace } from 'dmg-core/app';
import type { WorldDefinition } from '../worlds';
import type { FixturePaths } from './fixture-loader';
import { cleanupFixtures, loadFixtures } from './fixture-loader';

export interface TestApp {
  /** Полноценный ApiApp со всеми модулями */
  apiApp: U7BotApp;
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
  /** Фасад пользователей (для получения тестовых акторов) */
  userFacade: UserInProcFacade;
  /** Пути к временным фикстурам */
  fixtures: FixturePaths;
  /** Удаляет временную директорию с фикстурами */
  cleanup: () => Promise<void>;
}

/**
 * Боевая сборка приложения (`U7App`, D-50) над временной копией фикстур
 * мира: `dbDir` — каталог фикстур, раскладка `<dbDir>/…` та же, что у бота.
 * Репозитории желаний и peer-review и фасад курсов — второй экземпляр над
 * теми же файлами (без кеша): тесты проверяют ими сохранённое состояние.
 *
 * @param tag — метка для временной директории (обычно имя describe-блока)
 * @param world — имя или определение мира (по умолчанию `core-education`)
 */
export async function createTestApp(
  tag?: string,
  world?: string | WorldDefinition,
): Promise<TestApp> {
  const fixtures = await loadFixtures(tag, world);
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
    userFacade: app.userFacade,
    fixtures,
    cleanup: () => cleanupFixtures(fixtures),
  };
}
