import { Aggregate, AggregateDef } from 'dmg-core';
import * as v from 'valibot';
import { CourseErrors } from './course.errors';
import {
  CourseProgramInvariant,
  CourseState,
  type PhaseVo,
} from './course.state';

/**
 * Def агрегата `course`: жизненный цикл объявлен статусами, но операций нет —
 * authoring удалён, поэтому `transitions` пуст.
 */
export const CourseArDef = AggregateDef.define({
  name: 'course',
  label: 'Курс',
  description:
    'Курс: программа из модулей, разбитая на этапы; публикуется для записи.',
  state: CourseState,
  statuses: {
    draft: { label: 'Черновик' },
    published: { label: 'Опубликован' },
    archived: { label: 'В архиве' },
  },
  transitions: {},
  events: {},
  errors: CourseErrors,
});

/**
 * Версия в представлении обязательна: клиент сверяет её при записи, а в state
 * поле необязательно — legacy-запись читается как версия 0 (D-36).
 * Своя схема, а не `BaseEntityFields.version`: `nonOptional` в JSON Schema
 * выхода не выражается (MAN-03).
 */
const versionOut = v.pipe(
  v.number(),
  v.integer(),
  v.minValue(0),
  v.description('Версия сущности (оптимистичная блокировка)'),
);

/** Этап курса: заголовок, необязательный трек и срез программы. */
export const CourseStage = v.object({
  title: v.pipe(v.string(), v.description('Заголовок этапа')),
  track: v.pipe(
    v.optional(v.string()),
    v.description('Трек этапа: tech, design'),
  ),
  moduleIds: v.pipe(
    v.array(v.string()),
    v.description('Модули этапа в порядке прохождения'),
  ),
});

export type CourseStage = v.InferOutput<typeof CourseStage>;

/**
 * Курс наружу: state-форма датами-числами, но метки этапов заменены срезами
 * программы `stages` — клиенты метки не разбирают (D-64).
 */
export const CourseView = v.object({
  uuid: CourseState.entries.uuid,
  title: CourseState.entries.title,
  description: CourseState.entries.description,
  authorId: CourseState.entries.authorId,
  status: CourseState.entries.status,
  moduleIds: CourseState.entries.moduleIds,
  stages: v.pipe(
    v.array(CourseStage),
    v.description('Этапы курса по порядку прохождения'),
  ),
  createdAt: CourseState.entries.createdAt,
  updatedAt: CourseState.entries.updatedAt,
  version: versionOut,
});

export type CourseView = v.InferOutput<typeof CourseView>;

/** Этап, в который входит модуль: позиция в курсе и заголовок. */
export type CourseStageRef = {
  readonly index: number;
  readonly title: string;
  readonly track?: string;
};

/** Место модуля в программе курса (линейный порядок этапов). */
export type ModulePlaceInCourse = {
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly prevModuleId?: string;
  readonly nextModuleId?: string;
  readonly stage?: CourseStageRef;
};

/**
 * Агрегат Course — программа курса и её этапы. Методы-вопросы отвечают на
 * «опубликован ли», «входит ли модуль», «с какого модуля начинается» и «где
 * место модуля»; вопросы одного агрегата живут здесь, а не в DQS (Т2).
 */
export class CourseAr extends Aggregate<typeof CourseArDef, CourseView> {
  private constructor(state: CourseState) {
    super(CourseArDef, state);
    // Нарушение инварианта программы в хранилище — не штатный отказ: parse бросает.
    v.parse(CourseProgramInvariant, {
      moduleIds: state.moduleIds,
      phases: state.phases,
    });
  }

  /** Восстановление из хранилища — запись разобрана `CourseArDef.state`. */
  static restore(state: CourseState): CourseAr {
    return new CourseAr(state);
  }

  // ── Вопросы ──

  isPublished(): boolean {
    return this.state.status === 'published';
  }

  includesModule(moduleId: string): boolean {
    return this.state.moduleIds.includes(moduleId);
  }

  /** Стартовый модуль программы — `undefined` у пустой программы. */
  startModuleId(): string | undefined {
    return this.state.moduleIds[0];
  }

  /** Этапы курса: срез программы от метки этапа до следующей метки. */
  stages(): CourseStage[] {
    const { moduleIds, phases } = this.state;
    return phases.map((phase, index) => {
      const from = moduleIds.indexOf(phase.fromModuleId);
      const next = phases[index + 1];
      const to =
        next === undefined
          ? moduleIds.length
          : moduleIds.indexOf(next.fromModuleId);
      return stageOf(phase, moduleIds.slice(from, to));
    });
  }

  /**
   * Место модуля в программе: соседи по линейному порядку и этап. Модуля нет
   * в программе — `undefined`; у курса без этапов этапа нет.
   */
  placeOf(moduleId: string): ModulePlaceInCourse | undefined {
    const { moduleIds } = this.state;
    const index = moduleIds.indexOf(moduleId);
    if (index === -1) return undefined;

    const prevModuleId = moduleIds[index - 1];
    const nextModuleId = moduleIds[index + 1];
    const place: ModulePlaceInCourse = {
      isFirst: index === 0,
      isLast: index === moduleIds.length - 1,
      ...(prevModuleId === undefined ? {} : { prevModuleId }),
      ...(nextModuleId === undefined ? {} : { nextModuleId }),
    };
    const stage = this.stageOfModule(moduleId);
    return stage === undefined ? place : { ...place, stage };
  }

  override view(): CourseView {
    const {
      uuid,
      title,
      description,
      authorId,
      status,
      moduleIds,
      createdAt,
      updatedAt,
      version,
    } = this.state;
    return {
      uuid,
      title,
      description,
      authorId,
      status,
      moduleIds: [...moduleIds],
      stages: this.stages(),
      createdAt,
      updatedAt,
      version,
    };
  }

  /** Этап, в который входит модуль; у курса без этапов — `undefined`. */
  private stageOfModule(moduleId: string): CourseStageRef | undefined {
    let index = 0;
    for (const stage of this.stages()) {
      if (stage.moduleIds.includes(moduleId)) {
        return stage.track === undefined
          ? { index, title: stage.title }
          : { index, title: stage.title, track: stage.track };
      }
      index += 1;
    }
    return undefined;
  }
}

/** Этап из метки и среза программы: трек в ответ не попадает пустым. */
const stageOf = (phase: PhaseVo, moduleIds: string[]): CourseStage =>
  phase.track === undefined
    ? { title: phase.title, moduleIds }
    : { title: phase.title, track: phase.track, moduleIds };
