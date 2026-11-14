import { afterAll, beforeAll, describe, expect, spyOn, test } from 'bun:test';
import type { U7BotActor } from '@u7-scl/bot/u7-bot-app-meta';
import * as Shared from '@u7-scl/core/shared';
import {
  GetMyCampaignsUcDef,
  PeerReviewModuleDef,
} from '@u7-scl/domain/peer-review/contract';
import { createTestApp, type TestApp } from '@u7-scl/test-helpers/test-app';
import { waitUntil } from '@u7-scl/test-helpers/wait-until';
import { testTrace } from 'dmg-core/testing';
import { completeStudent } from '../helpers/student-fate';

/**
 * Smoke сквозной склейки peer-review на тестовом стенде (Фаза 6, задача 1):
 * TestApp подключает Def-модуль peer-review на фикстурах peer-review/*,
 * ER создания кампании подписан на события судьбы студента общей шиной.
 *
 * Сценарий: student.completed → кампания в репозитории и видна субъекту
 * через UC get-my-campaigns.
 *
 * Субъект — «Марина» (uuid 777…): его исхода нет в фикстурах
 * кампаний (кампании фикстур — субъекты 333…/444…/888…), поэтому
 * событие судьбы создаёт НОВУЮ кампанию, а не упирается в идемпотентность ER.
 */

const STREAM_ID = 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'; // JS Core — Поток 2
const SUBJECT_TG = 1007; // «Марина»
const SUBJECT_USER_ID = '77777777-7777-4777-8777-777777777777';
const MENTOR_TG = 1004; // «Ментор» — ментор потока e1e1e1e1

/**
 * Замораживаем «сейчас» на дату фикстур: иначе кампании c1a11111/c2a22222
 * истекают по календарю (expiresAt 2026-09-28T10:00) и тест протухает.
 * Тот же приём, что в unit-тестах peer-review (spyOn(Shared, 'now')).
 */
const FROZEN_NOW = new Date('2026-09-22T12:00');

describe('E2E peer-review: инфраструктура стенда (smoke)', () => {
  let app: TestApp;
  let nowSpy: ReturnType<typeof spyOn>;

  /** UC DMG `getMyCampaigns` от имени пользователя (как стори бота). */
  const dispatchMyCampaigns = (user: U7BotActor) =>
    app.apiApp.dispatch(
      PeerReviewModuleDef,
      GetMyCampaignsUcDef.command({}),
      user,
      testTrace(),
    );

  beforeAll(async () => {
    nowSpy = spyOn(Shared, 'now').mockReturnValue(FROZEN_NOW);
    app = await createTestApp('pr-smoke');
  });

  afterAll(async () => {
    await app.cleanup();
    nowSpy.mockRestore();
  });

  test('student.completed → кампания в репозитории и видна субъекту', async () => {
    await completeStudent(app, {
      callerTelegramId: MENTOR_TG,
      streamId: STREAM_ID,
      studentId: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
      outcome: 'advanced',
    });

    // Кампания появилась в репозитории
    await waitUntil(async () => {
      const campaign = await app.reviewCampaignRepo.findBySubject(
        STREAM_ID,
        SUBJECT_USER_ID,
      );
      return campaign !== undefined;
    });
    const campaign = await app.reviewCampaignRepo.findBySubject(
      STREAM_ID,
      SUBJECT_USER_ID,
    );
    expect(campaign).toBeDefined();

    // UC видит кампанию у субъекта
    const subject = await app.userByTelegramId(SUBJECT_TG);
    const subjectRes = await dispatchMyCampaigns(subject);
    const subjectCards = subjectRes.ok ? subjectRes.value : [];
    expect(subjectCards.some((c) => c.campaignId === campaign?.uuid)).toBe(
      true,
    );
  });
});
