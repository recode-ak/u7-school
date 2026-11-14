import { describe, expect, test } from 'bun:test';
import type { BotSession } from '@u7-scl/core/ui';
import { assertDialogResponseMarkdownSafe } from '@u7-scl/core/ui';
import {
  GetCourseByModuleUcDef,
  GetCourseUcDef,
  GetModuleSnapshotUcDef,
  GetModuleUcDef,
  GetStepsByLessonsUcDef,
  ListCoursesUcDef,
} from '@u7-scl/domain/course/contract';
import { ListUserWishesUcDef } from '@u7-scl/domain/wish/contract';
import { UserCaller } from 'dmg-core';
import { userActor } from '../../../core/user-actor.test-kit';
import { CourseCatalogStory } from './course-catalog.story';
import {
  courseView,
  dmgDispatch,
  moduleView,
  stage,
} from './course-dmg.test-kit';

// Ф4а, сценарий 10 + пересмотр (каталог): API курса отдаёт неопубликованные
// шаги только админу и автору модуля, поэтому метка (`🚧` draft / `🗄`
// archived, префикс строки шага) видна только им — ментор, GUEST, SUBSCRIBER
// получают от `getStepsByLessons` лишь опубликованное, и метки у них нет.
// Значок зависит от `status` в ответе UC (DOM-18), а не от роли. Каталог шаг
// не открывает (нет кнопок шага, `getStep` не вызывается): тело шага
// запрашивает только `learning/*` и `view-stream` через правила потока.

const session: BotSession = {
  dialog: { path: 'course/course-catalog', seq: 1 },
};
const actorOf = (role: 'ADMIN' | 'MENTOR' | 'GUEST' | 'SUBSCRIBER') =>
  userActor({
    uuid: '11111111-1111-4111-8111-aaaaaaaab0a2',
    name: role,
    telegramId: 322,
    roles: [role],
  });
const adminActor = actorOf('ADMIN');

const course = courseView({
  uuid: 'c-two',
  title: 'Курс',
  stages: [stage('Первый', ['m-1']), stage('Второй', [])],
});

function makeStory(
  items: Array<{ uuid: string; description: string; status: string }>,
  actor = adminActor,
) {
  const dispatch = dmgDispatch({
    [ListCoursesUcDef.name]: () => [course],
    [GetCourseUcDef.name]: () => course,
    [GetCourseByModuleUcDef.name]: () => course,
    [GetModuleUcDef.name]: () => moduleView({ uuid: 'm-1', title: 'Модуль' }),
    [GetModuleSnapshotUcDef.name]: () => [
      {
        projectId: 'pa',
        projectTitle: 'Проект',
        lessons: [
          {
            lessonId: 'la',
            lessonTitle: 'Урок',
            stepIds: items.map((i) => i.uuid),
          },
        ],
      },
    ],
    [GetStepsByLessonsUcDef.name]: () => ({ la: items }),
    [ListUserWishesUcDef.name]: () => [],
  });
  const story = new CourseCatalogStory();
  story.init({
    appApi: { dispatch },
    callers: { resolve: async () => new UserCaller(actor.user) },
  } as never);
  return { story, dispatch };
}

const items = [
  { uuid: 's1', description: 'Опубликованный шаг', status: 'published' },
  { uuid: 's2', description: 'Рабочий шаг', status: 'draft' },
  { uuid: 's3', description: 'Старый шаг', status: 'archived' },
];

describe('CourseCatalogStory — отметка статуса шагов (Ф4а)', () => {
  test('уровень урока: draft — 🚧, archived — 🗄, published — без значка', async () => {
    const response = await makeStory(items).story.handleCallback(
      'lesson:c-two:0:m-1:pa:la',
      adminActor,
      session,
    );
    assertDialogResponseMarkdownSafe(response);

    const lines = String(response.screen?.text).split('\n');
    const line = (needle: string) => lines.find((l) => l.includes(needle));
    expect(line('Рабочий шаг')).toContain('🚧');
    expect(line('Старый шаг')).toContain('🗄');
    expect(line('Опубликованный шаг')).toBeDefined();
    expect(line('Опубликованный шаг')).not.toContain('🚧');
    expect(line('Опубликованный шаг')).not.toContain('🗄');
  });

  test('все шаги опубликованы — значков нет нигде', async () => {
    const response = await makeStory(
      items.map((i) => ({ ...i, status: 'published' })),
    ).story.handleCallback('lesson:c-two:0:m-1:pa:la', adminActor, session);

    const text = String(response.screen?.text);
    expect(text).toContain('Рабочий шаг');
    expect(text).not.toContain('🚧');
    expect(text).not.toContain('🗄');
  });
});

describe('CourseCatalogStory — шаги для не-администраторов (пересмотр Ф4а)', () => {
  const published = items.filter((i) => i.status === 'published');

  test.each(['MENTOR', 'GUEST', 'SUBSCRIBER'] as const)(
    '%s: в уроке только заголовки опубликованных шагов, без меток',
    async (role) => {
      const actor = actorOf(role);
      const { story } = makeStory(published, actor);

      const response = await story.handleCallback(
        'lesson:c-two:0:m-1:pa:la',
        actor,
        session,
      );
      assertDialogResponseMarkdownSafe(response);

      const text = String(response.screen?.text);
      expect(text).toContain('Опубликованный шаг');
      expect(text).not.toContain('Рабочий шаг');
      expect(text).not.toContain('🚧');
      expect(text).not.toContain('🗄');
    },
  );

  test('открыть шаг из каталога нельзя — нет кнопок шага, getStep не вызывается', async () => {
    const { story, dispatch } = makeStory(items);

    const response = await story.handleCallback(
      'lesson:c-two:0:m-1:pa:la',
      adminActor,
      session,
    );

    const codes = response.screen?.keyboard?.rows.flat().map((b) => b.code);
    expect(codes?.some((c) => /step/i.test(String(c)))).toBe(false);
    const names = dispatch.mock.calls.map(
      ([, command]: [unknown, { uc: string }, unknown]) => command.uc,
    );
    expect(names).not.toContain('getStep');
  });
});
