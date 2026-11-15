import { describe, expect, mock, test } from 'bun:test';
import { TEST_SCHOOL } from '@u7-scl/app';
import type { MdText } from '@u7-scl/core/shared';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import type { UserView } from '@u7-scl/domain/user/contract';
import { UserModuleDef } from '@u7-scl/domain/user/contract';
import { WishEvents } from '@u7-scl/domain/wish/contract';
import { envelopeOf } from '../../../../tests/helpers/envelope-of';
import { subscriptionOf } from '../../../core/story.test-kit';
import { dmgDispatch, refuse } from '../../courses/stories/course-dmg.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import {
  streamNotFound,
  streamView,
} from '../../streams/stories/stream-dmg.test-kit';
import { WishInviteStory } from './wish-invite.story';

/** Модули приглашения: потоки и курсы. */
const MODULES = [CourseModuleDef, StreamModuleDef, UserModuleDef];

// ══ Фикстуры ══

const STREAM_ID = '11111111-1111-4111-8111-111111111111';
const COURSE_ID = '44444444-4444-4444-8444-444444444444';
const MODULE_ID = '33333333-3333-4333-8333-333333333333';
const MENTOR_ID = '66666666-6666-4666-8666-666666666666';
const WISHER_TELEGRAM_ID = 1003;

const stream = streamView({
  uuid: STREAM_ID,
  title: 'JavaScript Основы — Поток 1',
  description: 'Первый поток',
  mentorId: MENTOR_ID,
  moduleId: MODULE_ID,
  startDate: Date.parse('2026-09-17T10:00:00.000Z'),
  status: 'enrollment',
});

const course = { uuid: COURSE_ID, title: 'JavaScript Основы' };
const module_ = { uuid: MODULE_ID, title: 'JavaScript Основы', projects: [] };

type TestMentor = Omit<UserView, 'telegramId'> & {
  telegramId?: number;
  nick?: string;
};

const mentor: TestMentor = {
  uuid: MENTOR_ID,
  name: 'Dev',
  nick: 'devnick',
  telegramId: 555,
  roles: ['GUEST'],
  createdAt: 0,
  updatedAt: 0,
  version: 0,
};

/** Цель приглашения: курс (по умолчанию) или модуль. */
type InvitedTarget =
  | { targetKind: 'course'; courseId: string }
  | { targetKind: 'module'; moduleId: string };

/** Приглашение — конверт DMG, как его доставляет шина. */
function makeInvitedEvent(
  target: InvitedTarget = { targetKind: 'course', courseId: COURSE_ID },
) {
  return envelopeOf(
    WishEvents.invited,
    {
      userId: crypto.randomUUID(),
      telegramId: WISHER_TELEGRAM_ID,
      streamId: STREAM_ID,
      ...target,
    },
    { aggregateId: crypto.randomUUID() },
  );
}

// ══ Сборка стори с моками ══

function setupStory(
  opts: {
    stream?: typeof stream | undefined;
    mentor?: TestMentor | undefined;
    course?: typeof course | undefined;
    module?: typeof module_ | undefined;
  } = {},
): {
  story: WishInviteStory;
  invites: Array<{
    telegramId: number;
    payload: {
      text: MdText;
      keyboard: { rows: Array<Array<{ text: string; code: string }>> };
    };
  }>;
} {
  // Явно переданный undefined — «недоступен»; не передан — дефолт
  const localStream = 'stream' in opts ? opts.stream : stream;
  const localMentor = 'mentor' in opts ? opts.mentor : mentor;

  const invites: Array<{
    telegramId: number;
    payload: {
      text: MdText;
      keyboard: { rows: Array<Array<{ text: string; code: string }>> };
    };
  }> = [];

  const story = new WishInviteStory();
  story.init(
    {
      appApi: {
        dispatch: dmgDispatch(
          {
            getStream: () => localStream ?? streamNotFound(),
            getCourse: () => opts.course ?? course,
            getModule: () => opts.module ?? module_,
            getUser: () => localMentor ?? refuse('USER_NOT_FOUND', 'not_found'),
          },
          MODULES,
        ),
      },
      callers: testCallers,
      school: TEST_SCHOOL,
    } as never,
    {
      invite: mock(
        async (
          telegramId: number,
          payload: {
            text: MdText;
            keyboard: { rows: Array<Array<{ text: string; code: string }>> };
          },
        ) => {
          invites.push({ telegramId, payload });
        },
      ),
    } as never,
  );

  return { story, invites };
}

describe('WishInviteStory', () => {
  test('подписана на wish.wish.invited (FQN Def)', () => {
    const { story } = setupStory();
    const names = story.getEventSubscriptions().map((s) => s.def.name);
    expect(names).toContain('wish.wish.invited');
  });

  test('course-приглашение: структурированная карточка с курсом, потоком, датой, ментором', async () => {
    const { story, invites } = setupStory();
    const handle = subscriptionOf(story, 'wish.wish.invited').handle;

    await handle(makeInvitedEvent() as never);

    expect(invites).toHaveLength(1);
    const { telegramId, payload } = invites[0]!;
    expect(telegramId).toBe(WISHER_TELEGRAM_ID);

    const text = String(payload.text);
    // Ассоциация с кнопкой отмены
    expect(text).toContain('У тебя было желание пройти курс');
    expect(text).toContain('JavaScript Основы');
    // Имя потока — и в данных, и в подсказке записи
    expect(text).toContain('JavaScript Основы — Поток 1');
    // Дата и время старта (точки экранируются MarkdownV2)
    expect(text).toContain('17\\.09\\.2026');
    expect(text).toContain('15:00 \\(UTC\\+5\\)');
    // Ментор с рабочей t.me-ссылкой на ник
    expect(text).toContain('[Dev](https://t.me/devnick)');
    // Подсказка записи с явным именем потока (поток без ключа — запись свободная)
    expect(text).toContain('Запись свободная');
    expect(text).toContain('🏫 Школа → 📚 Потоки');
    expect(text).not.toContain('📚 Потоки курсов');
    expect(text).not.toContain('нужен ключ');
    expect(text).toContain('📝 Записаться');

    // Кнопки: запись на поток + отмена желания
    const buttons = payload.keyboard.rows.flat();
    const enrollBtn = buttons.find((b) => b.text.includes('Записаться'));
    expect(enrollBtn).toBeDefined();
    expect(enrollBtn!.code).toBe(`stream:view-stream:enroll:${STREAM_ID}`);
    const cancelBtn = buttons.find((b) => b.text.includes('Отменить желание'));
    expect(cancelBtn).toBeDefined();
    expect(cancelBtn!.code).toBe(`course:course-catalog:cancel:${COURSE_ID}`);
  });

  test('поток с ключом набора → подсказка про кодовое слово', async () => {
    const { story, invites } = setupStory({
      stream: { ...stream, requiresEnrollmentKey: true },
    });
    const handle = subscriptionOf(story, 'wish.wish.invited').handle;

    await handle(makeInvitedEvent() as never);

    const text = String(invites[0]!.payload.text);
    expect(text).toContain('нужен ключ — его выдаёт ментор');
    expect(text).not.toContain('Запись свободная');
  });

  test('mentor без ника → экспериментальная ссылка tg://user?id', async () => {
    const { story, invites } = setupStory({
      mentor: { ...mentor, nick: undefined },
    });
    const handle = subscriptionOf(story, 'wish.wish.invited').handle;

    await handle(makeInvitedEvent() as never);

    const text = String(invites[0]!.payload.text);
    expect(text).toContain(`[Dev](tg://user?id=${mentor.telegramId})`);
  });

  test('mentor без ника и без telegramId → просто имя', async () => {
    const { story, invites } = setupStory({
      mentor: { ...mentor, nick: undefined, telegramId: undefined },
    });
    const handle = subscriptionOf(story, 'wish.wish.invited').handle;

    await handle(makeInvitedEvent() as never);

    const text = String(invites[0]!.payload.text);
    expect(text).toContain('Dev');
    expect(text).not.toContain('tg://');
  });

  test('профиль ментора недоступен → строка «Ментор» опускается', async () => {
    const { story, invites } = setupStory({ mentor: undefined });
    const handle = subscriptionOf(story, 'wish.wish.invited').handle;

    await handle(makeInvitedEvent() as never);

    const text = String(invites[0]!.payload.text);
    expect(text).not.toContain('Ментор');
    // Остальная карточка доставлена
    expect(text).toContain('У тебя было желание пройти курс');
  });

  test('module-приглашение: «пройти модуль», кнопка W05-M', async () => {
    const { story, invites } = setupStory();
    const handle = subscriptionOf(story, 'wish.wish.invited').handle;

    await handle(
      makeInvitedEvent({ targetKind: 'module', moduleId: MODULE_ID }) as never,
    );

    const text = String(invites[0]!.payload.text);
    expect(text).toContain('У тебя было желание пройти модуль');
    expect(text).not.toContain('пройти курс');

    const buttons = invites[0]!.payload.keyboard.rows.flat();
    const cancelBtn = buttons.find((b) => b.text.includes('Отменить желание'));
    expect(cancelBtn!.code).toBe(
      `course:course-catalog:cancel-mod:${MODULE_ID}`,
    );
  });

  test('поток не найден → приглашение не отправляется, ошибки нет', async () => {
    const { story, invites } = setupStory({ stream: undefined });
    const handle = subscriptionOf(story, 'wish.wish.invited').handle;

    await handle(makeInvitedEvent() as never);

    expect(invites).toHaveLength(0);
  });
});
