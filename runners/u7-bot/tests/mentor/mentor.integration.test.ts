import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import {
  ListStreamsUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import type { Command } from 'dmg-core';
import { expectOk, testTrace } from 'dmg-core/testing';
import type { TestApp } from '../helpers/test-app';
import { createTestApp } from '../helpers/test-app';

/**
 * Интеграционный тест: ментор видит свои потоки (все четыре статуса).
 *
 * Фикстура: четыре потока ментора 4444... со статусами enrollment, active,
 * completed, archived; ментор — telegramId 1004.
 */
describe('MentorController (интеграционный)', () => {
  let app: TestApp;
  let mentor: U7BotActor;

  beforeAll(async () => {
    app = await createTestApp('mentor-int');
    mentor = await app.userByTelegramId(1004);
  });

  afterAll(async () => {
    await app.cleanup();
  });

  /** Запрос потоков от имени ментора (как stories бота) */
  const dispatchStream = <
    D extends (typeof StreamModuleDef)['useCases'][number],
  >(
    command: Command<D>,
  ) => app.apiApp.dispatch(StreamModuleDef, command, mentor, testTrace());

  // ── Мои потоки ──

  test('ментор видит свои потоки (включая все 4 статуса)', async () => {
    const myStreams = expectOk(
      await dispatchStream(
        ListStreamsUcDef.command({ mentorId: mentor.user.uuid }),
      ),
    );
    expect(myStreams.length).toBeGreaterThanOrEqual(4);
    const statuses = new Set(myStreams.map((s) => s.status));
    expect(statuses.has('enrollment')).toBe(true);
    expect(statuses.has('active')).toBe(true);
    expect(statuses.has('completed')).toBe(true);
    expect(statuses.has('archived')).toBe(true);
  });
});
