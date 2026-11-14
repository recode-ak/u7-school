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

// Ф4а, сценарий 10 (каталог): ментор (роль) получает от `getStepsByLessons`
// неопубликованные шаги со `status`; уровень урока помечает их значком
// `🚧` (draft) / `🗄` (archived) префиксом строки шага; опубликованный —
// без значка. Значок зависит от `status` в ответе UC (DOM-18), а не от роли.

const session: BotSession = {
  dialog: { path: 'course/course-catalog', seq: 1 },
};
const mentorActor = userActor({
  uuid: '11111111-1111-4111-8111-aaaaaaaab0a2',
  name: 'Ментор',
  telegramId: 322,
  roles: ['MENTOR'],
});

const course = courseView({
  uuid: 'c-two',
  title: 'Курс',
  stages: [stage('Первый', ['m-1']), stage('Второй', [])],
});

function makeStory(
  items: Array<{ uuid: string; description: string; status: string }>,
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
    callers: { resolve: async () => new UserCaller(mentorActor.user) },
  } as never);
  return story;
}

const items = [
  { uuid: 's1', description: 'Опубликованный шаг', status: 'published' },
  { uuid: 's2', description: 'Рабочий шаг', status: 'draft' },
  { uuid: 's3', description: 'Старый шаг', status: 'archived' },
];

describe('CourseCatalogStory — отметка статуса шагов (Ф4а)', () => {
  test('уровень урока: draft — 🚧, archived — 🗄, published — без значка', async () => {
    const response = await makeStory(items).handleCallback(
      'lesson:c-two:0:m-1:pa:la',
      mentorActor,
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
    ).handleCallback('lesson:c-two:0:m-1:pa:la', mentorActor, session);

    const text = String(response.screen?.text);
    expect(text).toContain('Рабочий шаг');
    expect(text).not.toContain('🚧');
    expect(text).not.toContain('🗄');
  });
});
