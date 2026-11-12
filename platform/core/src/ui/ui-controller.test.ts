import { describe, expect, test } from 'bun:test';
import { TaskEvents } from 'dmg-core/testing/example/todo/contract';
import type { UiEventSubscription } from './event-subscription';
import { eventSubscription } from './event-subscription';
import { UiController } from './ui-controller';
import { UiStory } from './ui-story';

class TestStory extends UiStory {
  constructor(private readonly subs: UiEventSubscription[] = []) {
    super();
  }

  override getEventSubscriptions(): UiEventSubscription[] {
    return this.subs;
  }
}

class TestController extends UiController {
  readonly name: string;

  constructor(name: string, stories: UiStory[] = []) {
    super();
    this.name = name;
    for (const story of stories) this.stories.push(story);
  }
}

describe('UiController', () => {
  test('getEventSubscriptions агрегирует подписки всех стори', () => {
    const sub1 = eventSubscription(TaskEvents.created, async () => {});
    const sub2 = eventSubscription(TaskEvents.completed, async () => {});
    const sub3 = eventSubscription(TaskEvents.archived, async () => {});

    const storyA = new TestStory([sub1]);
    const storyB = new TestStory([sub2, sub3]);
    const ctrl = new TestController('ctrl', [storyA, storyB]);

    const subs = ctrl.getEventSubscriptions();

    expect(subs).toHaveLength(3);
    expect(subs.map((s) => s.def.name)).toEqual([
      TaskEvents.created.name,
      TaskEvents.completed.name,
      TaskEvents.archived.name,
    ]);
  });

  test('без стори — пустой список', () => {
    const ctrl = new TestController('ctrl');
    expect(ctrl.getEventSubscriptions()).toEqual([]);
  });
});

describe('UiStory', () => {
  test('getEventSubscriptions по умолчанию возвращает []', () => {
    expect(new UiStory().getEventSubscriptions()).toEqual([]);
  });
});
