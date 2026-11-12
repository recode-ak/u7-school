import { describe, expect, mock, test } from 'bun:test';
import { assertMarkdownV2Safe, type MdText } from '@u7-scl/core/shared';
import { ReviewCampaignEvents } from '@u7-scl/domain/peer-review/contract';
import {
  GetUsersByIdsUcDef,
  UserModuleDef,
  type UserView,
} from '@u7-scl/domain/user/contract';
import { envelopeOf } from '../../../../tests/helpers/envelope-of';
import {
  dmgDispatch,
  streamNotFound,
  streamView,
} from '../../streams/stories/stream-dmg.test-kit';
import { InviteStory, type ReviewCampaignCreatedEvent } from './invite.story';
import { testCallers } from './peer-review-dmg.test-kit';

// ══ Фикстуры ══

const CAMPAIGN_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const STREAM_ID = 'bbbbbbbb-0000-4000-8000-000000000002';
const SUBJECT_ID = 'dddddddd-0000-4000-8000-000000000003';
const MENTOR_ID = 'eeeeeeee-0000-4000-8000-000000000004';

const SUBJECT_TG = 1001;
const MENTOR_TG = 2002;

const stream = streamView({
  uuid: STREAM_ID,
  title: 'JavaScript Основы — Поток 1',
});

type Profile = UserView;

const subject: Profile = {
  uuid: SUBJECT_ID,
  name: 'Борис',
  telegramId: SUBJECT_TG,
  roles: ['GUEST'],
  createdAt: 0,
  updatedAt: 0,
  version: 0,
};

const mentor: Profile = {
  uuid: MENTOR_ID,
  name: 'Марина',
  telegramId: MENTOR_TG,
  roles: ['GUEST'],
  createdAt: 0,
  updatedAt: 0,
  version: 0,
};

function makeCreatedEvent(
  overrides: Partial<ReviewCampaignCreatedEvent['payload']> = {},
): ReviewCampaignCreatedEvent {
  return envelopeOf(
    ReviewCampaignEvents.created,
    {
      campaignId: CAMPAIGN_ID,
      context: 'stream_fate',
      scopeId: STREAM_ID,
      subjectId: SUBJECT_ID,
      mentorId: MENTOR_ID,
      subjectOutcome: 'completed_passed',
      ...overrides,
    },
    { aggregateId: CAMPAIGN_ID },
  );
}

// ══ Сборка стори с моками ══

interface InviteCall {
  telegramId: number;
  payload: {
    text: MdText;
    keyboard: { rows: Array<Array<{ text: string; code: string }>> };
  };
}

function setupStory(
  opts: {
    stream?: typeof stream | undefined;
    subject?: Profile | undefined;
    mentor?: Profile | undefined;
  } = {},
): {
  story: InviteStory;
  invites: InviteCall[];
  dispatch: ReturnType<typeof dmgDispatch>;
} {
  // Явно переданный undefined — «недоступен»; не передан — дефолт
  const localStream = 'stream' in opts ? opts.stream : stream;
  const localSubject = 'subject' in opts ? opts.subject : subject;
  const localMentor = 'mentor' in opts ? opts.mentor : mentor;

  const invites: InviteCall[] = [];

  const dispatch = dmgDispatch({
    getStream: () => localStream ?? streamNotFound(),
    getUsersByIds: (input) => {
      const { userIds } = input as { userIds: string[] };
      return [localSubject, localMentor].filter(
        (u): u is Profile => u !== undefined && userIds.includes(u.uuid),
      );
    },
  });

  const story = new InviteStory();
  story.init(
    {
      appApi: { dispatch },
      callers: testCallers,
    } as never,
    {
      invite: mock(
        async (telegramId: number, payload: InviteCall['payload']) => {
          invites.push({ telegramId, payload });
        },
      ),
    } as never,
  );

  return { story, invites, dispatch };
}

/** Обработчик подписки peer-review.review-campaign.created. */
function campaignCreatedHandler(
  story: InviteStory,
): (event: ReviewCampaignCreatedEvent) => Promise<void> {
  const sub = story
    .getEventSubscriptions()
    .find((s) => s.def.name === 'peer-review.review-campaign.created');
  if (!sub)
    throw new Error('Подписка peer-review.review-campaign.created не найдена');
  return sub.handle as (event: ReviewCampaignCreatedEvent) => Promise<void>;
}

describe('InviteStory — приглашения по созданию кампании (S01)', () => {
  test('два приглашения: субъекту и ментору — по одному каждому', async () => {
    const { story, invites } = setupStory();

    await campaignCreatedHandler(story)(makeCreatedEvent());

    expect(invites).toHaveLength(2);
    expect(invites.map((i) => i.telegramId).sort()).toEqual([
      SUBJECT_TG,
      MENTOR_TG,
    ]);
    // Одно приглашение каждому получателю
    expect(new Set(invites.map((i) => i.telegramId)).size).toBe(2);
  });

  test('субъект «completed_passed»: судьба первой строкой, «об одногруппниках и менторе»', async () => {
    const { story, invites } = setupStory();

    await campaignCreatedHandler(story)(
      makeCreatedEvent({ subjectOutcome: 'completed_passed' }),
    );

    const toSubject = invites.find((i) => i.telegramId === SUBJECT_TG)!;
    assertMarkdownV2Safe(toSubject.payload.text);
    const text = String(toSubject.payload.text);
    expect(text).toContain('Отзывы по потоку «JavaScript Основы — Поток 1»');
    expect(text).toContain(
      'Ты завершил обучение — поделись впечатлениями об одногруппниках и менторе: это часть цифрового профиля каждого\\. Пиши только правду\\.',
    );
  });

  test('субъект «completed_not_passed»: тот же текст (один на оба исхода «завершил»)', async () => {
    const { story, invites } = setupStory();

    await campaignCreatedHandler(story)(
      makeCreatedEvent({ subjectOutcome: 'completed_not_passed' }),
    );

    const text = String(
      invites.find((i) => i.telegramId === SUBJECT_TG)!.payload.text,
    );
    expect(text).toContain('Ты завершил обучение');
    expect(text).toContain('об одногруппниках и менторе');
    expect(text).not.toContain('Ты покинул обучение');
  });

  test('субъект «dropped»: «покинул обучение», отзыв ментору и школе', async () => {
    const { story, invites } = setupStory();

    await campaignCreatedHandler(story)(
      makeCreatedEvent({ subjectOutcome: 'dropped' }),
    );

    const text = String(
      invites.find((i) => i.telegramId === SUBJECT_TG)!.payload.text,
    );
    expect(text).toContain(
      'Ты покинул обучение — поделись впечатлениями о менторе и учёбе: это поможет школе и тем, кто только выбирает, учиться ли\\. Пиши только правду\\.',
    );
    expect(text).not.toContain('об одногруппниках');
  });

  test('субъект «never_started»: «что остановило» — свой текст', async () => {
    const { story, invites } = setupStory();

    await campaignCreatedHandler(story)(
      makeCreatedEvent({ subjectOutcome: 'never_started' }),
    );

    const text = String(
      invites.find((i) => i.telegramId === SUBJECT_TG)!.payload.text,
    );
    expect(text).toContain('Ты записался, но так и не начал обучение');
    expect(text).toContain('что остановило');
    expect(text).not.toContain('об одногруппниках');
  });

  test('ментор: «подопечный завершил — выдай отзыв» — с именем субъекта', async () => {
    const { story, invites } = setupStory();

    await campaignCreatedHandler(story)(makeCreatedEvent());

    const toMentor = invites.find((i) => i.telegramId === MENTOR_TG)!;
    assertMarkdownV2Safe(toMentor.payload.text);
    const text = String(toMentor.payload.text);
    expect(text).toContain('Отзывы по потоку «JavaScript Основы — Поток 1»');
    expect(text).toContain(
      'Твой подопечный Борис завершил обучение — выдай ему отзыв: как он проявлялся в учёбе, что удалось, что стоит подтянуть\\. Пиши только правду\\.',
    );
  });

  test('ментор (подопечный выбыл): «покинул обучение — поделись наблюдениями»', async () => {
    const { story, invites } = setupStory();

    await campaignCreatedHandler(story)(
      makeCreatedEvent({ subjectOutcome: 'dropped' }),
    );

    const text = String(
      invites.find((i) => i.telegramId === MENTOR_TG)!.payload.text,
    );
    expect(text).toContain('Твой подопечный Борис покинул обучение');
    expect(text).toContain('что можно было сделать иначе');
  });

  test('кнопка «💬 Отзывы» у обоих — полный код в S03 кампании', async () => {
    const { story, invites } = setupStory();

    await campaignCreatedHandler(story)(makeCreatedEvent());

    for (const invite of invites) {
      const buttons = invite.payload.keyboard.rows.flat();
      expect(buttons).toHaveLength(1);
      expect(buttons[0]!.text).toBe('💬 Отзывы');
      expect(buttons[0]!.code).toBe(`peer-review:campaign:list:${CAMPAIGN_ID}`);
    }
  });

  test('профили обоих получателей — один batch-UC getUsersByIds', async () => {
    const { story, dispatch } = setupStory();

    await campaignCreatedHandler(story)(makeCreatedEvent());

    const batchCalls = dispatch.mock.calls.filter(
      ([module, command]) =>
        module === UserModuleDef && command.uc === GetUsersByIdsUcDef.name,
    );
    expect(batchCalls).toHaveLength(1);
    expect(batchCalls[0]![1].input).toEqual({
      userIds: [SUBJECT_ID, MENTOR_ID],
    });
  });

  test('ментор недоступен → приглашение только субъекту', async () => {
    const { story, invites } = setupStory({ mentor: undefined });

    await campaignCreatedHandler(story)(makeCreatedEvent());

    expect(invites).toHaveLength(1);
    expect(invites[0]!.telegramId).toBe(SUBJECT_TG);
  });

  test('имя субъекта не найдено (batch пуст) — запасной лейбл «для студента»', async () => {
    const { story, invites } = setupStory({
      subject: { ...subject, name: 'Борис' },
    });
    // batch не находит субъекта: перекроем мок — вернёт только ментора
    story.init({
      appApi: {
        dispatch: dmgDispatch({
          getStream: () => stream,
          getUsersByIds: () => [mentor],
        }),
      },
      callers: testCallers,
    } as never);

    await campaignCreatedHandler(story)(makeCreatedEvent());

    const text = String(
      invites.find((i) => i.telegramId === MENTOR_TG)!.payload.text,
    );
    expect(text).toContain('Твой подопечный студент завершил обучение');
  });

  test('поток недоступен → приглашения не отправляются, ошибки нет', async () => {
    const { story, invites } = setupStory({ stream: undefined });

    await campaignCreatedHandler(story)(makeCreatedEvent());

    expect(invites).toHaveLength(0);
  });

  test('название потока с точками — экранирование MarkdownV2', async () => {
    const { story, invites } = setupStory({
      stream: { ...stream, title: 'Поток v1.2' },
    });

    await campaignCreatedHandler(story)(makeCreatedEvent());

    const text = String(invites[0]!.payload.text);
    expect(text).toContain('Поток v1\\.2');
    assertMarkdownV2Safe(invites[0]!.payload.text);
  });
});
