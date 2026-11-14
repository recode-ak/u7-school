import { describe, expect, mock, test } from 'bun:test';
import { md } from '@u7-scl/core/shared';
import {
  assertDialogResponseMarkdownSafe,
  type BotSession,
  type DialogResponse,
} from '@u7-scl/core/ui';
import {
  CreateReviewUcDef,
  ReviewCampaignErrors,
  ReviewErrors,
} from '@u7-scl/domain/peer-review/contract';
import { err } from 'dmg-core';
import { userActor } from '../../../core/user-actor.test-kit';
import { streamView } from '../../streams/stories/stream-dmg.test-kit';
import { CampaignStory } from './campaign.story';
import { MyReviewsStory } from './my-reviews.story';
import {
  peerReviewDispatch,
  refuse,
  testCallers,
} from './peer-review-dmg.test-kit';

describe('CampaignStory (S03 — список адресатов)', () => {
  const CAMPAIGN_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
  const STREAM_ID = 'bbbbbbbb-0000-0000-0000-000000000001';
  const MENTOR_ID = 'cccccccc-0000-0000-0000-000000000001';
  const PEER_ID = 'dddddddd-0000-0000-0000-000000000001';
  const PEER2_ID = 'dddddddd-0000-0000-0000-000000000002';

  const session: BotSession = {
    dialog: { path: 'peer-review/campaign', seq: 1 },
  };
  const ACTOR_UUID = '11111111-1111-4111-8111-aaaaaaaab008';
  const actor = userActor({
    uuid: ACTOR_UUID,
    name: 'Аня',
    telegramId: 123,
    roles: ['GUEST'],
  });

  const NAMES: Record<string, string> = {
    [ACTOR_UUID]: 'Аня',
    [MENTOR_ID]: 'Пётр Петров',
    [PEER_ID]: 'Борис',
    [PEER2_ID]: 'Вера',
  };

  interface RecipientView {
    userId: string;
    hasMyReview: boolean;
  }

  function makeAppApi(
    recipients: RecipientView[],
    myRole: 'subject' | 'mentor' = 'subject',
    failUc?: string,
    myReviewText?: string,
    failWindow?: boolean,
    myOutcome?:
      | 'completed_passed'
      | 'completed_not_passed'
      | 'dropped'
      | 'never_started',
  ) {
    return {
      // UC DMG модуля peer-review — через `dispatch`
      dispatch: peerReviewDispatch({
        getCampaignRecipients: () => ({
          campaignId: CAMPAIGN_ID,
          context: 'stream_fate',
          myRole,
          mentorId: MENTOR_ID,
          // исход субъекта — тексты S03/S05 по парам «роль-судьба»
          subjectOutcome: myOutcome ?? 'completed_passed',
          daysLeft: 5,
          recipients,
        }),
        getMyCampaigns: () => [
          {
            campaignId: CAMPAIGN_ID,
            context: 'stream_fate',
            scopeId: STREAM_ID,
            subjectId: actor.user.uuid,
            myRole,
            expiresAt: Date.parse('2026-09-26T00:00'),
            subjectOutcome: myOutcome ?? 'completed_passed',
            daysLeft: 5,
            progress: { done: 1, total: recipients.length },
          },
        ],
        getMyReview: () =>
          myReviewText === undefined
            ? { found: false }
            : { found: true, text: myReviewText },
        createReview: (input) => {
          if (failWindow) {
            return refuse(ReviewErrors.WINDOW_CLOSED.code, 'conflict', {
              campaignId: CAMPAIGN_ID,
              expiresAt: Date.parse('2026-09-19T00:00'),
            });
          }
          // имитация отказа домена (прочие отказы — реплика поверх)
          if (failUc === 'create-review') {
            return refuse(ReviewErrors.RECIPIENT_NOT_ALLOWED.code);
          }
          const { campaignId, recipientId } = input as {
            campaignId: string;
            recipientId: string;
          };
          return {
            reviewId: '10000000-0000-0000-0000-000000000001',
            campaignId,
            recipientId,
          };
        },
        listMyReviews: () => ({ reviews: [] }),
        getStream: () => streamView({ uuid: STREAM_ID, title: 'Поток S' }),
        getUser: (input) => {
          if (failUc === 'getUser') {
            throw new Error('имитация ошибки UC');
          }
          const { uuid } = input as { uuid: string };
          const name = NAMES[uuid];
          return name === undefined
            ? refuse('USER_NOT_FOUND', 'not_found')
            : { uuid, name };
        },
      }),
    };
  }

  // Хаб связан со стори кампании (возврат при единственном адресате) —
  // обе стори на одном моке appApi
  function makeStories(api: ReturnType<typeof makeAppApi>) {
    return makeBoth(api).story;
  }

  function makeBoth(api: ReturnType<typeof makeAppApi>) {
    const hub = new MyReviewsStory();
    hub.init({ appApi: api, callers: testCallers } as never);
    const story = new CampaignStory(hub);
    story.init({ appApi: api, callers: testCallers } as never);
    return { story, hub };
  }

  function findBtn(response: DialogResponse, needle: string) {
    return (
      response.screen?.keyboard?.rows
        .flat()
        .find((b) => b.text.includes(needle)) ?? null
    );
  }

  test('list: заголовок — поток, вопрос, остаток дней; «Мои отзывы» последним рядом', async () => {
    const appApi = makeAppApi([
      { userId: MENTOR_ID, hasMyReview: false },
      { userId: PEER_ID, hasMyReview: true },
    ]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `list:${CAMPAIGN_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('Отзывы — поток «Поток S»');
    // вводный абзац по паре «роль-судьба» (субъект, завершил)
    expect(text).toContain('Ты завершил обучение в этом потоке');
    expect(text).toContain('Отзыв одногруппникам поможет увидеть');
    expect(text).toContain('Отзыв ментору поможет понять');
    // развёрнутые метрики
    expect(text).toContain('Написано отзывов: 1 из 2');
    expect(text).toContain('Осталось времени: 5 дн');
    expect(text).toContain('О ком расскажешь');

    const rows = response.screen?.keyboard?.rows ?? [];
    const last = rows.at(-1)?.[0];
    // ступенчатая навигация: родитель списка — хаб «Мои отзывы»
    expect(last?.text).toBe('↩️ Мои отзывы');
    expect(last?.code).toBe('my-reviews:hub');
    // рядов ровно сколько адресатов + хаб (отдельной «Закончить» нет)
    expect(rows.length).toBe(3);
  });

  test('list: роли в кнопках — «Ментор:»/«Студент:», ✅ только у отозванных', async () => {
    const appApi = makeAppApi([
      { userId: MENTOR_ID, hasMyReview: false },
      { userId: PEER_ID, hasMyReview: true },
    ]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `list:${CAMPAIGN_ID}`,
      actor,
      session,
    );

    const mentorBtn = findBtn(response, 'Пётр Петров');
    expect(mentorBtn?.text).toBe('Ментор — Пётр Петров');
    const peerBtn = findBtn(response, 'Борис');
    expect(peerBtn?.text).toBe('✅Одногруппник — Борис');
    expect(findBtn(response, '✅Ментор')).toBeNull();
  });

  test('list: код кнопки адресата — open с campaignId и userId адресата', async () => {
    const appApi = makeAppApi([
      { userId: MENTOR_ID, hasMyReview: false },
      { userId: PEER_ID, hasMyReview: false },
    ]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `list:${CAMPAIGN_ID}`,
      actor,
      session,
    );

    const btn = findBtn(response, 'Борис');
    expect(btn?.code).toBe(`campaign:open:${CAMPAIGN_ID}:${PEER_ID}`);
  });

  test('list: кампании нет (NOT_FOUND) → «Кампания не найдена» и возврат в хаб', async () => {
    const appApi = makeAppApi([{ userId: PEER_ID, hasMyReview: false }]);
    appApi.dispatch.mockImplementation((async () =>
      err(
        ReviewCampaignErrors.NOT_FOUND.make({ campaignId: CAMPAIGN_ID }),
      )) as never);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `list:${CAMPAIGN_ID}`,
      actor,
      session,
    );

    expect(String(response.screen?.text ?? '')).toContain(
      'Кампания не найдена',
    );
    expect(findBtn(response, '↩️ Мои отзывы')).not.toBeNull();
  });

  test('list: автор-ментор — адресаты-студенты, менторских кнопок нет', async () => {
    const appApi = makeAppApi(
      [
        { userId: PEER_ID, hasMyReview: false },
        { userId: PEER2_ID, hasMyReview: false },
      ],
      'mentor',
    );
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `list:${CAMPAIGN_ID}`,
      actor,
      session,
    );

    expect(findBtn(response, 'Студент — Борис')).not.toBeNull();
    expect(findBtn(response, 'Студент — Вера')).not.toBeNull();
    expect(findBtn(response, 'Ментор —')).toBeNull();
  });

  // ── автопровал «выбор без выбора»: единственный адресат ──

  test('list: единственный адресат → сразу ввод, список не показывается', async () => {
    const appApi = makeAppApi([{ userId: PEER_ID, hasMyReview: false }]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `list:${CAMPAIGN_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    // шапка-ориентир + подсказка ввода, без списка «О ком расскажешь?»
    expect(text).toContain('✍️ *Отзыв — поток «Поток S»*');
    expect(text).toContain('Предлагаем разделить отзыв на две части');
    expect(text).not.toContain('О ком расскажешь');
    expect(response.awaitInput?.context).toEqual({
      campaignId: CAMPAIGN_ID,
      recipientId: PEER_ID,
    });
    // при единственном адресате «Назад» — сразу в хаб (списка нет)
    const back = findBtn(response, 'Мои отзывы');
    expect(back?.code).toBe('my-reviews:hub');
  });

  test('list: единственный ✅-адресат → сразу экран перезаписи', async () => {
    const appApi = makeAppApi(
      [{ userId: PEER_ID, hasMyReview: true }],
      'subject',
      undefined,
      'старый отзыв',
    );
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `list:${CAMPAIGN_ID}`,
      actor,
      session,
    );
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('✏️ Ты уже писал');
    expect(text).toContain('старый отзыв');
    expect(text).not.toContain('О ком расскажешь');
  });

  // ── S05: ввод отзыва ──

  const message = (text: string) =>
    ({
      type: 'text',
      text,
      telegramId: actor.user.view().telegramId,
    }) as const;

  test('open: студент → о студенте — рекомендация двух частей, awaitInput, Назад', async () => {
    const appApi = makeAppApi([{ userId: PEER_ID, hasMyReview: false }]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${PEER_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    // шапка-ориентир: поток, о котором отзыв
    expect(text).toContain('✍️ *Отзыв — поток «Поток S»*');
    expect(text).toContain('Предлагаем разделить отзыв на две части');
    expect(text).toContain('`Отзыв для {Имя}:`');
    expect(text).toContain('\\(вместо \\{Имя\\} — Борис\\)');
    expect(text).toContain('профессиональные');
    expect(text).toContain('`Как с ним работать:`');
    // принципы — общий блок экранов ввода
    expect(text).toContain('Характеризуй навыки, а не людей');
    // кнопки: Назад и справка (Пропустить больше нет)
    expect(findBtn(response, 'Как писать отзыв')).not.toBeNull();
    expect(findBtn(response, 'Пропустить')).toBeNull();
    expect(response.awaitInput?.context).toEqual({
      campaignId: CAMPAIGN_ID,
      recipientId: PEER_ID,
    });
    // единственный адресат в моке → «Назад» ведёт в хаб
    const back = findBtn(response, 'Мои отзывы');
    expect(back?.code).toBe('my-reviews:hub');
  });

  test('open: несколько адресатов → «Назад» ведёт в список кампании', async () => {
    const appApi = makeAppApi([
      { userId: MENTOR_ID, hasMyReview: false },
      { userId: PEER_ID, hasMyReview: false },
    ]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${PEER_ID}`,
      actor,
      session,
    );

    const back = findBtn(response, 'Назад');
    expect(back?.code).toBe(`campaign:list:${CAMPAIGN_ID}`);
  });

  test('open: ментор → о студенте — своя подсказка', async () => {
    const appApi = makeAppApi(
      [{ userId: PEER_ID, hasMyReview: false }],
      'mentor',
    );
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${PEER_ID}`,
      actor,
      session,
    );

    expect(String(response.screen?.text ?? '')).toContain('`Отзыв для {Имя}:`');
    expect(String(response.screen?.text ?? '')).toContain(
      '`Рекомендация по развитию:`',
    );
  });

  test('open: адресат-ментор → о менторе — своя подсказка', async () => {
    const appApi = makeAppApi([{ userId: MENTOR_ID, hasMyReview: false }]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${MENTOR_ID}`,
      actor,
      session,
    );

    const text = String(response.screen?.text ?? '');
    expect(text).toContain('`Отзыв для ментора:`');
  });

  test('how: справка «Как писать отзыв» — инфо-сообщение без кнопок, экран не трогается', async () => {
    const appApi = makeAppApi([{ userId: MENTOR_ID, hasMyReview: false }]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `how:${CAMPAIGN_ID}:${MENTOR_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.notify?.text ?? '');

    expect(text).toContain('Как писать отзыв');
    // инфо-сообщение: экрана и клавиатуры нет, ввод не сбрасывается
    expect(response.screen).toBeUndefined();
    expect(response.awaitInput).toBeUndefined();
  });

  // ── S05: подсказки «о менторе» — варианты по исходу автора (subjectOutcome) ──

  test('open: «завершил и прошел» → о менторе — текст про «помогало учиться»', async () => {
    const appApi = makeAppApi(
      [{ userId: MENTOR_ID, hasMyReview: false }],
      'subject',
      undefined,
      undefined,
      undefined,
      'completed_passed',
    );
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${MENTOR_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text ?? '');
    expect(text).toContain('что помогало учиться, что мешало');
    expect(text).toContain('`Моя рекомендация студентам:`');
    expect(text).not.toContain('Даже если итог');
  });

  test('open: «завершил и не прошел» → тот же текст, что и «прошел» (passed/not_passed — один)', async () => {
    const appApi = makeAppApi(
      [{ userId: MENTOR_ID, hasMyReview: false }],
      'subject',
      undefined,
      undefined,
      undefined,
      'completed_not_passed',
    );
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${MENTOR_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text ?? '');
    expect(text).toContain('что помогало учиться, что мешало');
    expect(text).toContain('`Моя рекомендация студентам:`');
  });

  test('open: «не начал» → о менторе — текст «почему так и не начали»', async () => {
    const appApi = makeAppApi(
      [{ userId: MENTOR_ID, hasMyReview: false }],
      'subject',
      undefined,
      undefined,
      undefined,
      'never_started',
    );
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${MENTOR_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text ?? '');
    expect(text).toContain('`Что остановило:`');
    expect(text).toContain('что не совпало с ожиданиями');
    expect(text).toContain('`Моя рекомендация:`');
    expect(text).toContain('тем, кто выбирает обучение');
  });

  test('open: «забросил» → о менторе — текст «почему забросили»', async () => {
    const appApi = makeAppApi(
      [{ userId: MENTOR_ID, hasMyReview: false }],
      'subject',
      undefined,
      undefined,
      undefined,
      'dropped',
    );
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${MENTOR_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const text = String(response.screen?.text ?? '');
    expect(text).toContain('почему забросил');
    expect(text).toContain('какие пожелания школе и ментору');
    expect(text).toContain('`Следует ожидать от курса:`');
  });

  test('ввод: короткий текст — переспрос-предупреждение без потери ввода', async () => {
    const appApi = makeAppApi([{ userId: PEER_ID, hasMyReview: false }]);
    const story = makeStories(appApi);
    await story.handleCallback(
      `open:${CAMPAIGN_ID}:${PEER_ID}`,
      actor,
      session,
    );

    const dialog: BotSession = {
      dialog: {
        path: 'peer-review/campaign',
        seq: 2,
        input: { context: { campaignId: CAMPAIGN_ID, recipientId: PEER_ID } },
      },
    };
    const response = await story.handleMessage(
      message('коротко'),
      actor,
      dialog,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(response.notify).not.toBeNull();
    expect(String(response.notify?.text ?? '')).toContain('10');
    // переспрос не трогает экран и ожидание ввода
    expect(response.screen).toBeUndefined();
    expect(response.awaitInput).toBeUndefined();
  });

  test('ввод: длинный текст (>3500) — просьба сократить', async () => {
    const appApi = makeAppApi([{ userId: PEER_ID, hasMyReview: false }]);
    const story = makeStories(appApi);
    await story.handleCallback(
      `open:${CAMPAIGN_ID}:${PEER_ID}`,
      actor,
      session,
    );

    const dialog: BotSession = {
      dialog: {
        path: 'peer-review/campaign',
        seq: 2,
        input: { context: { campaignId: CAMPAIGN_ID, recipientId: PEER_ID } },
      },
    };
    const response = await story.handleMessage(
      message('х'.repeat(3501)),
      actor,
      dialog,
    );

    expect(String(response.notify?.text ?? '')).toContain('3500');
  });

  // ── S06: сохранение отзыва ──

  const reviewText = 'Отличный напарник, всё успел и помогал другим!';

  test('ввод: валидный текст — инфо «сохранён» + список кампании с ✅', async () => {
    const recipients: RecipientView[] = [
      { userId: MENTOR_ID, hasMyReview: false },
      { userId: PEER_ID, hasMyReview: false },
    ];
    const appApi = makeAppApi(recipients);
    const story = makeStories(appApi);
    await story.handleCallback(
      `open:${CAMPAIGN_ID}:${PEER_ID}`,
      actor,
      session,
    );

    // после сохранения повторный список адресатов увидит ✅ у Бориса
    const peer = recipients.find((r) => r.userId === PEER_ID);
    if (peer) {
      peer.hasMyReview = true;
    }

    const dialog: BotSession = {
      dialog: {
        path: 'peer-review/campaign',
        seq: 2,
        input: { context: { campaignId: CAMPAIGN_ID, recipientId: PEER_ID } },
      },
    };
    const response = await story.handleMessage(
      message(reviewText),
      actor,
      dialog,
    );
    assertDialogResponseMarkdownSafe(response);

    // инфо-сообщение о результате — поверх нового экрана-родителя
    expect(String(response.notify?.text ?? '')).toContain(
      '✅ Отзыв о Борис сохранён',
    );
    // финализация закрывает экран ввода (новый экран — новым сообщением)
    expect(String(response.finalize?.text ?? '')).toContain(
      'отзыв о Борис отправлен',
    );
    // экран-родитель: список кампании (несколько адресатов), без строки «сохранён»
    const screenText = String(response.screen?.text ?? '');
    expect(screenText).toContain('О ком расскажешь');
    expect(screenText).not.toContain('сохранён');
    const btn = findBtn(response, 'Одногруппник — Борис');
    expect(btn?.text.startsWith('✅')).toBe(true);

    expect(
      appApi.dispatch.mock.calls.map(([, command]) => command),
    ).toContainEqual(
      CreateReviewUcDef.command({
        campaignId: CAMPAIGN_ID,
        recipientId: PEER_ID,
        text: reviewText,
      }),
    );
  });

  test('ввод: единственный адресат — инфо «сохранён» + хаб «Мои отзывы»', async () => {
    const appApi = makeAppApi([{ userId: PEER_ID, hasMyReview: false }]);
    const story = makeStories(appApi);

    const dialog: BotSession = {
      dialog: {
        path: 'peer-review/campaign',
        seq: 2,
        input: { context: { campaignId: CAMPAIGN_ID, recipientId: PEER_ID } },
      },
    };
    const response = await story.handleMessage(
      message(reviewText),
      actor,
      dialog,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.notify?.text ?? '')).toContain('сохранён');
    // финализация закрывает экран ввода (новый экран — новым сообщением)
    expect(String(response.finalize?.text ?? '')).toContain(
      'отзыв о Борис отправлен',
    );
    // родитель при единственном адресате — хаб, а не список (его нет)
    const screenText = String(response.screen?.text ?? '');
    expect(screenText).toContain('Мои отзывы');
    expect(screenText).not.toContain('О ком расскажешь');
  });

  test('ввод: ошибка сохранения — реплика об ошибке, экран «сохранён» не показан', async () => {
    const appApi = makeAppApi(
      [{ userId: PEER_ID, hasMyReview: false }],
      'subject',
      'create-review',
    );
    const story = makeStories(appApi);

    const dialog: BotSession = {
      dialog: {
        path: 'peer-review/campaign',
        seq: 2,
        input: { context: { campaignId: CAMPAIGN_ID, recipientId: PEER_ID } },
      },
    };
    const response = await story.handleMessage(
      message(reviewText),
      actor,
      dialog,
    );

    expect(response.screen).toBeUndefined();
    expect(response.notify).not.toBeNull();
    expect(String(response.notify?.text ?? '')).not.toContain('сохранён');
  });

  test('ввод: окно истекло — экран-заглушка, не реплика', async () => {
    const appApi = makeAppApi(
      [{ userId: PEER_ID, hasMyReview: false }],
      'subject',
      undefined,
      undefined,
      true,
    );
    const story = makeStories(appApi);

    const dialog: BotSession = {
      dialog: {
        path: 'peer-review/campaign',
        seq: 2,
        input: { context: { campaignId: CAMPAIGN_ID, recipientId: PEER_ID } },
      },
    };
    const response = await story.handleMessage(
      message(reviewText),
      actor,
      dialog,
    );
    assertDialogResponseMarkdownSafe(response);

    expect(String(response.screen?.text ?? '')).toContain('уже закрыта');
    expect(findBtn(response, 'Мои отзывы')).not.toBeNull();
  });

  // ── S04: перезапись отзыва ──

  test('open: ✅-адресат — экран перезаписи с текущим текстом, кнопка Назад', async () => {
    const appApi = makeAppApi(
      [{ userId: PEER_ID, hasMyReview: true }],
      'subject',
      undefined,
      'старый отзыв',
    );
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${PEER_ID}`,
      actor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);
    const text = String(response.screen?.text ?? '');

    expect(text).toContain('✏️ Ты уже писал');
    expect(text).toContain('о Борис');
    expect(text).toContain('старый отзыв');
    expect(text).toContain('Отправь новый текст');
    // принципы — и на экране перезаписи
    expect(text).toContain('Характеризуй навыки, а не людей');
    expect(text).toContain('✍️ *Отзыв — поток «Поток S»*');
    expect(findBtn(response, 'Как писать отзыв')).not.toBeNull();
    expect(response.awaitInput?.context).toEqual({
      campaignId: CAMPAIGN_ID,
      recipientId: PEER_ID,
    });
    const back = findBtn(response, 'Мои отзывы');
    expect(back?.code).toBe('my-reviews:hub');
  });

  test('open: ✅-адресат — ввод заменяет текст (create-review перезапись)', async () => {
    const appApi = makeAppApi(
      [
        { userId: MENTOR_ID, hasMyReview: false },
        { userId: PEER_ID, hasMyReview: true },
      ],
      'subject',
      undefined,
      'старый отзыв',
    );
    const story = makeStories(appApi);
    await story.handleCallback(
      `open:${CAMPAIGN_ID}:${PEER_ID}`,
      actor,
      session,
    );

    const dialog: BotSession = {
      dialog: {
        path: 'peer-review/campaign',
        seq: 2,
        input: { context: { campaignId: CAMPAIGN_ID, recipientId: PEER_ID } },
      },
    };
    const response = await story.handleMessage(
      message('Обновлённый отзыв, всё было отлично'),
      actor,
      dialog,
    );

    // перезапись — своё инфо-сообщение
    expect(String(response.notify?.text ?? '')).toContain('обновлён');
    expect(String(response.notify?.text ?? '')).not.toContain('сохранён');
    expect(String(response.screen?.text ?? '')).toContain('О ком расскажешь');
    expect(
      appApi.dispatch.mock.calls.map(([, command]) => command),
    ).toContainEqual(
      CreateReviewUcDef.command({
        campaignId: CAMPAIGN_ID,
        recipientId: PEER_ID,
        text: 'Обновлённый отзыв, всё было отлично',
      }),
    );
  });

  test('open: ✅-адресат, отзыв уже не найден — обычный ввод S05', async () => {
    const appApi = makeAppApi([{ userId: PEER_ID, hasMyReview: true }]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `open:${CAMPAIGN_ID}:${PEER_ID}`,
      actor,
      session,
    );

    expect(String(response.screen?.text ?? '')).toContain(
      'Предлагаем разделить отзыв на две части',
    );
  });

  // ── страница хаба-родителя: возвраты ведут на неё ──

  test('list:p2 — «Мои отзывы» и коды адресатов несут страницу возврата', async () => {
    const appApi = makeAppApi([
      { userId: MENTOR_ID, hasMyReview: false },
      { userId: PEER_ID, hasMyReview: false },
    ]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `list:${CAMPAIGN_ID}:p2`,
      actor,
      session,
    );

    const last = (response.screen?.keyboard?.rows ?? []).at(-1)?.[0];
    expect(last?.code).toBe('my-reviews:hub-page:2');
    const peerBtn = findBtn(response, 'Борис');
    expect(peerBtn?.code).toBe(`campaign:open:${CAMPAIGN_ID}:${PEER_ID}:p2`);
  });

  test('list:p2 с единственным адресатом — «Назад» в хаб на стр. 2, страница в контексте ввода', async () => {
    const appApi = makeAppApi([{ userId: PEER_ID, hasMyReview: false }]);
    const story = makeStories(appApi);

    const response = await story.handleCallback(
      `list:${CAMPAIGN_ID}:p2`,
      actor,
      session,
    );

    const back = findBtn(response, 'Мои отзывы');
    expect(back?.code).toBe('my-reviews:hub-page:2');
    expect(response.awaitInput?.context).toEqual({
      campaignId: CAMPAIGN_ID,
      recipientId: PEER_ID,
      pageNumber: 2,
    });
  });

  test('ввод: pageNumber=2 в контексте — после сохранения «Мои отзывы» вернёт на стр. 2', async () => {
    const recipients: RecipientView[] = [
      { userId: MENTOR_ID, hasMyReview: false },
      { userId: PEER_ID, hasMyReview: false },
    ];
    const appApi = makeAppApi(recipients);
    const story = makeStories(appApi);

    const dialog: BotSession = {
      dialog: {
        path: 'peer-review/campaign',
        seq: 2,
        input: {
          context: {
            campaignId: CAMPAIGN_ID,
            recipientId: PEER_ID,
            pageNumber: 2,
          },
        },
      },
    };
    const response = await story.handleMessage(
      message(reviewText),
      actor,
      dialog,
    );

    const last = (response.screen?.keyboard?.rows ?? []).at(-1)?.[0];
    expect(last?.code).toBe('my-reviews:hub-page:2');
  });

  test('ввод: единственный адресат с pageNumber=2 — хаб открывается на стр. 2', async () => {
    const appApi = makeAppApi([{ userId: PEER_ID, hasMyReview: false }]);
    const { story, hub } = makeBoth(appApi);
    const showHub = mock(() =>
      Promise.resolve<DialogResponse>({ screen: { text: md`хаб-заглушка` } }),
    );
    (hub as unknown as { showHub: unknown }).showHub = showHub;

    const dialog: BotSession = {
      dialog: {
        path: 'peer-review/campaign',
        seq: 2,
        input: {
          context: {
            campaignId: CAMPAIGN_ID,
            recipientId: PEER_ID,
            pageNumber: 2,
          },
        },
      },
    };
    await story.handleMessage(message(reviewText), actor, dialog);

    expect(showHub).toHaveBeenCalledTimes(1);
    const args = (
      showHub.mock.calls as unknown as Array<[unknown, unknown, number]>
    )[0];
    expect(args).toBeDefined();
    expect(args?.[2]).toBe(2);
  });
});
