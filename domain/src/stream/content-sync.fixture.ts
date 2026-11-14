import type { ContentSnapshot } from '@u7-scl/domain/course/contract';

/**
 * Снимок из раскладки `{ проект: { урок: [шаги] } }`; id — сами ключи,
 * заголовки — `заголовок-<id>` (порядок ключей — порядок обхода).
 * `titles` переопределяет заголовок по id проекта или урока.
 */
export const tree = (
  layout: Record<string, Record<string, string[]>>,
  titles: Record<string, string> = {},
): ContentSnapshot =>
  Object.entries(layout).map(([projectId, lessons]) => ({
    projectId,
    projectTitle: titles[projectId] ?? `заголовок-${projectId}`,
    lessons: Object.entries(lessons).map(([lessonId, stepIds]) => ({
      lessonId,
      lessonTitle: titles[lessonId] ?? `заголовок-${lessonId}`,
      stepIds,
    })),
  }));

/** Снимок из одного проекта `P` и одного урока `L`. */
export const flat = (stepIds: string[]): ContentSnapshot =>
  tree({ P: { L: stepIds } });

/**
 * Детерминированный uuid из короткого имени (до 6 ASCII-символов) — для
 * тестов, где state агрегатов проходит схему (id шагов, уроков, проектов).
 */
export const sid = (name: string): string =>
  `5ec00000-0000-4000-8000-${[...name]
    .map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')
    .padStart(12, '0')}`;
