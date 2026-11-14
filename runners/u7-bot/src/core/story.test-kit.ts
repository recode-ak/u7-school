import type { UiEventSubscription } from '@u7-scl/core/ui';

/** Подписка story на событие по FQN Def; нет подписки — ошибка теста. */
export function subscriptionOf(
  story: { getEventSubscriptions(): UiEventSubscription[] },
  eventName: string,
): UiEventSubscription {
  const sub = story
    .getEventSubscriptions()
    .find((s) => s.def.name === eventName);
  if (!sub) throw new Error(`Нет подписки на ${eventName}`);
  return sub;
}
