import { describe, expect, test } from 'bun:test';
import { type EnvelopeOf, type EventBus, InProcEventBus } from 'dmg-core/app';
import { MemoryLogger } from 'dmg-core/testing';
import { TaskEvents } from 'dmg-core/testing/example/todo/contract';
import type { UiEventSubscription } from './event-subscription';
import { eventSubscription } from './event-subscription';
import { UiApp } from './ui-app';
import { UiController } from './ui-controller';
import { UiStory } from './ui-story';

// ── Тестовое событие: Def учебного модуля dmg-core ──

const testDef = TaskEvents.created;
type TestEnvelope = EnvelopeOf<typeof testDef>;

/** Шина DMG; подписки и публикации считает обёртка поверх `InProcEventBus`. */
class CountingEventBus implements EventBus {
  readonly inner = new InProcEventBus(new MemoryLogger());
  readonly subscribed: string[] = [];

  publish(envelope: Parameters<EventBus['publish']>[0]): void {
    this.inner.publish(envelope);
  }

  subscribe: EventBus['subscribe'] = (def, handler) => {
    this.subscribed.push(def.name);
    return this.inner.subscribe(def, handler);
  };
}

// ── Тестовые стори/контроллер ──

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

function makeEvent(): TestEnvelope {
  return {
    name: testDef.name,
    payload: { taskId: 't1', ownerId: 'o1', title: 'hello' },
    eventId: 'e1',
    occurredAt: Date.parse('2026-01-01T00:00:00.000Z'),
    aggregateId: 'a1',
    cause: { kind: 'request', requestId: 'r1' },
    correlationId: 'c1',
  };
}

function makeResolve(bus: EventBus) {
  return {
    eventBus: bus,
    actorResolver: async () => ({ id: 'a1' }),
  };
}

describe('UiApp (общий слой)', () => {
  test('subscribeEvents регистрирует подписку по имени Def события', () => {
    const bus = new CountingEventBus();
    const story = new TestStory([eventSubscription(testDef, async () => {})]);
    const app = new UiApp([new TestController('ctrl', [story])]);

    app.init(makeResolve(bus));
    app.subscribeEvents();

    expect(bus.subscribed).toEqual([testDef.name]);
  });

  test('подписка хранит Def события, а не имя', () => {
    const story = new TestStory([eventSubscription(testDef, async () => {})]);
    const app = new UiApp([new TestController('ctrl', [story])]);

    const [subscription] = app.getEventSubscriptions();

    expect(subscription?.def).toBe(testDef);
  });

  test('publish события вызывает handle', () => {
    const bus = new CountingEventBus();
    const received: TestEnvelope[] = [];
    const story = new TestStory([
      eventSubscription(testDef, async (event) => {
        received.push(event);
      }),
    ]);
    const app = new UiApp([new TestController('ctrl', [story])]);
    app.init(makeResolve(bus));
    app.subscribeEvents();

    const event = makeEvent();
    bus.publish(event);

    expect(received).toHaveLength(1);
    expect(received[0]!.name).toBe(testDef.name);
    expect(received[0]!.payload.title).toBe('hello');
  });

  test('unsubscribeAll отписывает: повторный publish не вызывает handle', () => {
    const bus = new CountingEventBus();
    const received: TestEnvelope[] = [];
    const story = new TestStory([
      eventSubscription(testDef, async (event) => {
        received.push(event);
      }),
    ]);
    const app = new UiApp([new TestController('ctrl', [story])]);
    app.init(makeResolve(bus));
    app.subscribeEvents();

    app.unsubscribeAll();
    bus.publish(makeEvent());

    expect(received).toHaveLength(0);
  });

  test('повторный subscribeEvents не дублирует обработчики', () => {
    const bus = new CountingEventBus();
    const received: TestEnvelope[] = [];
    const story = new TestStory([
      eventSubscription(testDef, async (event) => {
        received.push(event);
      }),
    ]);
    const app = new UiApp([new TestController('ctrl', [story])]);
    app.init(makeResolve(bus));

    app.subscribeEvents();
    app.subscribeEvents();
    bus.publish(makeEvent());

    expect(received).toHaveLength(1);
  });

  test('две стори на один Def — обе подписки вызываются', () => {
    const bus = new CountingEventBus();
    const received: string[] = [];
    const storyA = new TestStory([
      eventSubscription(testDef, async () => {
        received.push('story-a');
      }),
    ]);
    const storyB = new TestStory([
      eventSubscription(testDef, async () => {
        received.push('story-b');
      }),
    ]);
    const app = new UiApp([
      new TestController('ctrl-a', [storyA]),
      new TestController('ctrl-b', [storyB]),
    ]);
    app.init(makeResolve(bus));
    app.subscribeEvents();

    bus.publish(makeEvent());

    expect(received).toContain('story-a');
    expect(received).toContain('story-b');
    expect(received).toHaveLength(2);
  });

  test('subscribeEvents до init — ошибка', () => {
    const app = new UiApp([]);
    expect(() => app.subscribeEvents()).toThrow('UiApp не инициализирован');
  });

  test('start() подписывает сторин на события, stop() отписывает', () => {
    const bus = new CountingEventBus();
    const received: string[] = [];
    const story = new TestStory([
      eventSubscription(testDef, async (event) => {
        received.push(event.payload.title);
      }),
    ]);
    const app = new UiApp([new TestController('ctrl', [story])]);
    app.init(makeResolve(bus));

    app.start();
    bus.publish(makeEvent());
    expect(received).toEqual(['hello']);

    app.stop();
    bus.publish(makeEvent());
    expect(received).toEqual(['hello']);
  });

  test('start() до init — ошибка (как и подписки напрямую)', () => {
    const app = new UiApp([]);
    expect(() => app.start()).toThrow('UiApp не инициализирован');
  });

  test('stop() до start() — безопасен', () => {
    const bus = new CountingEventBus();
    const app = new UiApp([]);
    app.init(makeResolve(bus));
    expect(() => app.stop()).not.toThrow();
  });
});
