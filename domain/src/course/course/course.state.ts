import { BaseEntityFields, F } from 'dmg-core';
import * as v from 'valibot';

/**
 * Заголовок или описание: края обрезаются. Описание стоит до преобразования —
 * JSON Schema (`toJsonSchema`) обрывается на первом `transform`.
 */
const trimmed = (label: string) =>
  v.pipe(
    v.string(),
    v.description(label),
    v.transform((value) => value.trim()),
    v.nonEmpty(`${label} не может быть пустым`),
  );

/**
 * Метка этапа: заголовок, модуль начала и необязательный трек. Своей
 * идентичности и дат нет (DOM-13): этап курса опознаётся заголовком, а место
 * в программе — меткой `fromModuleId`.
 */
export const PhaseVo = v.object({
  title: trimmed('Заголовок этапа'),
  track: v.pipe(
    v.optional(v.string()),
    v.description('Трек этапа: tech, design'),
  ),
  fromModuleId: F.uuid('модуля, с которого начинается этап'),
});

export type PhaseVo = v.InferOutput<typeof PhaseVo>;

/**
 * Entity курса — единственное место структуры состояния. Legacy-записи
 * читаются: ISO-даты → число (UTC), нет `updatedAt` → `createdAt`, нет
 * `version` → 0 (D-36). `phases` здесь без проверок: инварианты программы
 * вынесены в `CourseProgramInvariant`, иначе `state` не переводится в JSON
 * Schema.
 */
export const CourseState = v.object({
  ...BaseEntityFields,
  title: trimmed('Заголовок курса'),
  description: trimmed('Описание курса'),
  authorId: F.uuid('автора'),
  moduleIds: v.pipe(
    v.array(F.uuid('модуля')),
    v.description('Программа: модули по порядку прохождения'),
  ),
  phases: v.pipe(
    v.array(PhaseVo),
    v.description('Этапы программы: метки, с которых начинается этап'),
  ),
  status: F.picklist(
    ['draft', 'published', 'archived'],
    'Статус курса: черновик, опубликован, в архиве',
  ),
});

export type CourseState = v.InferOutput<typeof CourseState>;

/** Программа и метки как данные инварианта — без остальных полей курса. */
const CourseProgram = v.object({
  moduleIds: v.array(v.string()),
  phases: v.array(
    v.object({
      title: v.string(),
      track: v.optional(v.string()),
      fromModuleId: v.string(),
    }),
  ),
});

/** Индекс модуля в программе; `-1` — метка указывает вне программы. */
const positionOf = (moduleIds: readonly string[], moduleId: string) =>
  moduleIds.indexOf(moduleId);

/**
 * Инварианты программы и меток: модуль в программе один раз; метка
 * указывает на модуль программы; метки идут в порядке программы (отсюда — не
 * больше одного этапа на модуль); первый этап начинается с первого модуля;
 * заголовки этапов уникальны. Висячие `moduleIds` (модуля нет в
 * `modules.json`) не проверяются — это межагрегатная связь (DOM-13).
 */
export const CourseProgramInvariant = v.pipe(
  CourseProgram,
  v.check(
    ({ moduleIds }) => new Set(moduleIds).size === moduleIds.length,
    'Курс: модуль встречается в программе больше одного раза',
  ),
  v.check(
    ({ moduleIds, phases }) =>
      phases.every((phase) => moduleIds.includes(phase.fromModuleId)),
    'Курс: этап начинается с модуля вне программы',
  ),
  v.check(
    ({ phases }) =>
      new Set(phases.map((phase) => phase.title)).size === phases.length,
    'Курс: заголовки этапов не уникальны',
  ),
  v.check(
    ({ moduleIds, phases }) =>
      phases.every((phase, index) => {
        const previous = phases[index - 1];
        if (previous === undefined) return true;
        return (
          positionOf(moduleIds, previous.fromModuleId) <
          positionOf(moduleIds, phase.fromModuleId)
        );
      }),
    'Курс: этапы идут не в порядке программы',
  ),
  v.check(({ moduleIds, phases }) => {
    const first = phases[0];
    return (
      first === undefined || positionOf(moduleIds, first.fromModuleId) === 0
    );
  }, 'Курс: первый этап начинается не с первого модуля программы'),
);
