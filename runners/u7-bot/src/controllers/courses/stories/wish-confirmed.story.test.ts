import { describe, expect, mock, test } from 'bun:test';
import { assertMarkdownV2Safe, type MdText } from '@u7-scl/core/shared';
import { CourseModuleDef } from '@u7-scl/domain/course/contract';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { UserModuleDef, type UserView } from '@u7-scl/domain/user/contract';
import { WishEvents } from '@u7-scl/domain/wish/contract';
import { envelopeOf } from '../../../../tests/helpers/envelope-of';
import { subscriptionOf } from '../../../core/story.test-kit';
import {
  courseNotFound,
  dmgDispatch,
  refuse,
} from '../../courses/stories/course-dmg.test-kit';
import { testCallers } from '../../peer-review/stories/peer-review-dmg.test-kit';
import { WishConfirmedStory } from './wish-confirmed.story';

/** Модули рассылки: потоки и курсы. */
const MODULES = [CourseModuleDef, StreamModuleDef, UserModuleDef];

// ══ Фикстуры ══

const COURSE_ID = '44444444-4444-8444-8444-444444444444';
const OTHER_COURSE_ID = '55555555-5555-8555-8555-555555555555';
const USER_ID = '11111111-1111-8111-8111-111111111111';
const MENTOR_1 = '66666666-6666-8666-8666-666666666661';
const MENTOR_2 = '66666666-6666-8666-8666-666666666662';

const profile = (overrides: Partial<UserView>): UserView => ({
  uuid: USER_ID,
  name: 'Иван',
  telegramId: 1001,
  roles: ['GUEST'],
  createdAt: 1,
  updatedAt: 1,
  version: 0,
  ...overrides,
});

const user = profile({});

const userNotFound = () => refuse('USER_NOT_FOUND', 'not_found');

const course = { uuid: COURSE_ID, title: 'Fullstack JS' };

const streams = [
  { mentorId: MENTOR_1, moduleId: 'module-a' },
  { mentorId: MENTOR_2, moduleId: 'module-b' },
  { mentorId: MENTOR_1, moduleId: 'module-c' }, // дубль ментора
  { mentorId: '77777777-7777-8777-8777-777777777777', moduleId: 'module-x' }, // чужой курс
];

function makeConfirmedEvent() {
  return envelopeOf(
    WishEvents.confirmed,
    { userId: USER_ID, courseId: COURSE_ID },
    { aggregateId: crypto.randomUUID() },
  );
}

// ══ Сборка стори с моками ══

function setupStory(
  opts: { user?: UserView; course?: { title: string } } = {},
): {
  story: WishConfirmedStory;
  notifies: Array<{ telegramId: number; payload: { text: MdText } }>;
} {
  const notifies: Array<{
    telegramId: number;
    payload: { text: MdText };
  }> = [];

  // Явно переданный undefined — «недоступен»; не передан — дефолт
  const localUser = 'user' in opts ? opts.user : user;
  const localCourse = 'course' in opts ? opts.course : course;

  /** Ответ `getUser`: профиль, или `USER_NOT_FOUND`, если профиля нет. */
  const getUser = (input: unknown) => {
    const uuid = (input as { uuid: string }).uuid;
    const found =
      uuid === USER_ID
        ? localUser
        : uuid === MENTOR_1
          ? profile({ uuid: MENTOR_1, name: 'Ментор 1', telegramId: 2001 })
          : undefined; // MENTOR_2 — профиль недоступен
    return found ?? userNotFound();
  };

  const story = new WishConfirmedStory();
  story.init(
    {
      appApi: {
        dispatch: dmgDispatch(
          {
            getUser,
            listStreams: () => streams,
            getCourse: () => localCourse ?? courseNotFound(),
            getCourseByModule: (input) => {
              const { moduleId } = input as { moduleId: string };
              if (['module-a', 'module-b', 'module-c'].includes(moduleId)) {
                return { uuid: COURSE_ID, title: 'Fullstack JS' };
              }
              return { uuid: OTHER_COURSE_ID, title: 'Другой курс' };
            },
          },
          MODULES,
        ),
      },
      callers: testCallers,
    } as never,
    {
      notify: mock(async (telegramId: number, payload: { text: MdText }) => {
        notifies.push({ telegramId, payload });
      }),
    } as never,
  );

  return { story, notifies };
}

describe('WishConfirmedStory', () => {
  test('подписана на wish.wish.confirmed (FQN Def)', () => {
    const { story } = setupStory();
    const names = story.getEventSubscriptions().map((s) => s.def.name);
    expect(names).toContain('wish.wish.confirmed');
  });

  test('рассылка всем менторам курса: имя, курс, дедупликация, фильтры', async () => {
    const { story, notifies } = setupStory();
    const handle = subscriptionOf(story, 'wish.wish.confirmed').handle;

    await handle(makeConfirmedEvent() as never);

    // Профиль ментора 2 недоступен, автор-ментор исключается, дубль MENTOR_1 — один
    expect(notifies).toHaveLength(1);
    expect(notifies[0]!.telegramId).toBe(2001);
    assertMarkdownV2Safe(notifies[0]!.payload.text);
    const text = String(notifies[0]!.payload.text);
    expect(text).toContain('Иван');
    expect(text).toContain('Fullstack JS');
  });

  test('курс недоступен → уведомление с uuid курса, рассылка продолжается', async () => {
    const { story, notifies } = setupStory({ course: undefined });
    const handle = subscriptionOf(story, 'wish.wish.confirmed').handle;

    await handle(makeConfirmedEvent() as never);

    expect(notifies).toHaveLength(1);
    assertMarkdownV2Safe(notifies[0]!.payload.text);
    // uuid экранируется MarkdownV2 (дефисы) — снимаем экранирование
    const text = String(notifies[0]!.payload.text).replaceAll('\\-', '-');
    expect(text).toContain(COURSE_ID);
  });

  test('пользователь недоступен → молчаливый пропуск', async () => {
    const { story, notifies } = setupStory({ user: undefined });
    const handle = subscriptionOf(story, 'wish.wish.confirmed').handle;

    await handle(makeConfirmedEvent() as never);

    expect(notifies).toHaveLength(0);
  });
});
