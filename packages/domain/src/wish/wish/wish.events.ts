import { defineEvents } from 'dmg-core';

/**
 * События агрегата `wish` — пустая группа (TR-1): Ar в legacy событий не
 * порождает, `defineAggregate` требует группу. `wish.invited`/`wish.confirmed`
 * (сейчас — интерфейсы legacy `events.ts`) переходят сюда в Ф3.
 */
export const WishEvents = defineEvents('wish.wish', {});
