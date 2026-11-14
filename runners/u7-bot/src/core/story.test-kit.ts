import type { UiEventSubscription } from '@u7-scl/core/ui';

/** Обработчик подписки стори на событие по имени Def (бросает, если подписки нет). */
export function subscriptionOf(
  story: { getEventSubscriptions(): UiEventSubscription[] },
  eventName: string,
): (event: never) => Promise<void> {
  const sub = story
    .getEventSubscriptions()
    .find((s) => s.def.name === eventName);
  if (!sub) throw new Error(`Подписка ${eventName} не найдена`);
  return sub.handle as (event: never) => Promise<void>;
}
