import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { AppController } from '@u7-scl/bot/app/app-controller';
import { CoursesController } from '@u7-scl/bot/courses/controller';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import { U7BotController } from '@u7-scl/bot/u7-bot-controller';
import { U7BotUiStory } from '@u7-scl/bot/u7-bot-ui-story';
import { md } from '@u7-scl/core/shared';
import type { BotSession, DialogResponse } from '@u7-scl/core/ui';
import {
  ListUserWishesUcDef,
  WishModuleDef,
} from '@u7-scl/domain/wish/contract';
import type { TestApp } from '@u7-scl/test-helpers/test-app';
import { createTestApp } from '@u7-scl/test-helpers/test-app';
import {
  createTestBotTransport,
  stampedCode,
  type TestBotTransport,
} from '@u7-scl/test-helpers/test-bot-transport';
import type { OperationRecord } from 'dmg-core/app';

/**
 * E2E: `requestId` вызова UC из `update_id` Telegram (D-56 пакета).
 *
 * - Повторная доставка апдейта (тот же `update_id`) — команда не исполняется
 *   второй раз: отсев повторов отдаёт сохранённый ответ, экран тот же.
 * - Вызовы UC одного апдейта связаны общим `correlationId = tg:<update_id>`.
 *
 * Полный контур: настоящий транспорт, uiApp, приложение и лог операций
 * (`<dbDir>/oplog`) — по нему видно, что исполнялось.
 */

const INSTANT_COURSE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SCHOOL_GROUP_URL = 'https://t.me/u7_school_group';

/** Story-зонд: один апдейт — два вызова UC модуля wish. */
class TwoCallsStory extends U7BotUiStory {
  readonly name = 'two-calls';

  override async handleCallback(
    _action: string,
    actor: U7BotActor,
    _session: BotSession,
  ): Promise<DialogResponse> {
    await this.dispatchUc(
      WishModuleDef,
      ListUserWishesUcDef.command({}),
      actor,
    );
    await this.dispatchUc(
      WishModuleDef,
      ListUserWishesUcDef.command({}),
      actor,
    );
    return this.screen(md`Готово`);
  }
}

class ProbeController extends U7BotController {
  readonly name = 'probe';
  protected override readonly stories = [new TwoCallsStory()];
}

describe('Бот: requestId из update_id (e2e)', () => {
  let app: TestApp;
  let transport: TestBotTransport;
  let guest: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('update-replay-e2e');
    transport = createTestBotTransport(app, [
      new AppController(SCHOOL_GROUP_URL),
      new CoursesController(),
      new ProbeController(),
    ]);
    guest = await app.userByTelegramId(1001);
  });

  beforeEach(async () => {
    transport.reset();
    await transport.handleStart(
      transport.makeBotContext(guest.user.view().telegramId),
    );
  });

  afterAll(async () => {
    await app.cleanup();
  });

  /** Записи лога операций приложения. */
  async function oplog(): Promise<OperationRecord[]> {
    const dir = join(app.fixtures.dbDir, 'oplog');
    const files = await readdir(dir).catch(() => [] as string[]);
    const lines = await Promise.all(
      files.map(async (f) =>
        (await readFile(join(dir, f), 'utf8')).split('\n'),
      ),
    );
    return lines
      .flat()
      .filter((l) => l !== '')
      .map((l) => JSON.parse(l) as OperationRecord);
  }

  /** Записи UC модуля wish с именем `op`. */
  async function wishOps(op: string): Promise<OperationRecord[]> {
    return (await oplog()).filter((r) => r.module === 'wish' && r.op === op);
  }

  /** Нажатие кнопки с сырым кодом и актуальным штампом. */
  function press(code: string): Promise<DialogResponse> {
    return transport.handleCallback(
      transport.makeBotContext(guest.user.view().telegramId, {
        callbackData: stampedCode(
          transport,
          guest.user.view().telegramId,
          code,
        ),
      }),
    );
  }

  test('повтор апдейта после падения до сохранения сессии — UC не исполнен повторно, экран тот же', async () => {
    const first = await press(
      `course:course-catalog:apply:${INSTANT_COURSE_ID}`,
    );
    expect(String(first.screen?.text)).toContain('зафиксировано');

    const repeated = await transport.redeliver({ sessionLost: true });

    expect(String(repeated.screen?.text)).toContain('зафиксировано');
    const runs = await wishOps('createCourseWish');
    expect(runs).toHaveLength(1);
    expect(runs[0]?.trace.cause).toMatchObject({
      kind: 'request',
      requestId: `tg:${transport.lastUpdateId}#1`,
    });
  });

  test('повтор апдейта со сменившимся экраном отклоняет транспорт — до UC не доходит', async () => {
    await press(`course:course-catalog:apply:${INSTANT_COURSE_ID}`);
    const before = (await oplog()).length;

    const repeated = await transport.redeliver();

    expect(repeated).toEqual({});
    expect(await oplog()).toHaveLength(before);
  });

  test('два UC одного апдейта — общий correlationId tg:<update_id>, свои requestId', async () => {
    await press('probe:two-calls:go');
    const updateId = transport.lastUpdateId;

    const runs = (await wishOps('listUserWishes')).filter(
      (r) => r.trace.correlationId === `tg:${updateId}`,
    );

    expect(runs.map((r) => r.trace.cause)).toEqual([
      { kind: 'request', requestId: `tg:${updateId}#1` },
      { kind: 'request', requestId: `tg:${updateId}#2` },
    ]);
  });
});
