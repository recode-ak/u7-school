import { describe, expect, test } from 'bun:test';
import type { U7BotUiStory } from '../../core/u7-bot-ui-story';
import { CoursesController } from './controller';

describe('CoursesController (реестр)', () => {
  test('реестр стори: каталог + приглашение + уведомление менторам', () => {
    const controller = new CoursesController();
    // Имена диалогов узнаются стори при init — контроллер-владелец передаётся ядром.
    controller.init({ appApi: {} } as never);

    const dialogPaths = controller
      .getStories()
      .map((story) => (story as U7BotUiStory).dialogPath);

    expect(dialogPaths).toEqual([
      'course/course-catalog',
      'course/wish-invite',
      'course/wish-confirmed',
    ]);
  });
});
