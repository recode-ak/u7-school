import { F } from 'dmg-core';
import * as v from 'valibot';

/** День без активности, с которого студенту уходит предупреждение. */
export const WARN_AFTER_DAYS = 5;
/** День без активности, с которого ментору уходит «кандидат на снятие». */
export const REMOVE_AFTER_DAYS = 7;
/** Период повтора уведомления после первого, в днях. */
export const NOTICE_EVERY_DAYS = 2;

const description = v.description;

/** Категория исхода студента: завершил / забросил / учится. */
export const OutcomeCategoryVo = F.picklist(
  ['completed', 'abandoned', 'in_progress'],
  'категории исхода студента',
);
export type OutcomeCategory = v.InferOutput<typeof OutcomeCategoryVo>;

/** Признак исхода: завершения (passed, not_passed) или ухода. */
export const OutcomeSignVo = F.picklist(
  [
    'passed',
    'not_passed',
    'never_started',
    'left_voluntarily',
    'removed_by_mentor',
  ],
  'признака исхода студента',
);
export type OutcomeSign = v.InferOutput<typeof OutcomeSignVo>;

/** Прогресс: завершено / всего / процент. */
export const ProgressVo = v.pipe(
  v.object({
    completed: F.int('завершённых'),
    total: F.int('всего'),
    percent: F.int('процент завершённых'),
  }),
  description('Прогресс студента'),
);
export type Progress = v.InferOutput<typeof ProgressVo>;

/** Статус узла дерева навигации: пройден / в процессе / закрыт. */
export const NodeStatusVo = F.picklist(
  ['completed', 'current', 'locked'],
  'статуса узла',
);
export type NodeStatus = v.InferOutput<typeof NodeStatusVo>;

/** Узел шага в дереве навигации. */
export const StepNodeVo = v.pipe(
  v.object({
    stepId: F.uuid('шага'),
    status: NodeStatusVo,
    index: F.int('шага в уроке (с 1)'),
  }),
  description('Шаг в дереве навигации'),
);
export type StepNode = v.InferOutput<typeof StepNodeVo>;

/** Узел урока в дереве навигации. */
export const LessonNodeVo = v.pipe(
  v.object({
    lessonId: F.uuid('урока'),
    title: F.string('Заголовок урока'),
    status: NodeStatusVo,
    completedSteps: F.int('завершённых шагов урока'),
    totalSteps: F.int('шагов в уроке'),
    steps: v.pipe(v.array(StepNodeVo), description('Шаги урока')),
  }),
  description('Урок в дереве навигации'),
);
export type LessonNode = v.InferOutput<typeof LessonNodeVo>;

/** Узел проекта в дереве навигации. */
export const ProjectNodeVo = v.pipe(
  v.object({
    title: F.string('Заголовок проекта'),
    status: NodeStatusVo,
    completedLessons: F.int('уроков с завершёнными шагами'),
    totalLessons: F.int('уроков в проекте'),
    lessons: v.pipe(v.array(LessonNodeVo), description('Уроки проекта')),
  }),
  description('Проект в дереве навигации'),
);
export type ProjectNode = v.InferOutput<typeof ProjectNodeVo>;

/** Дерево навигации: проекты → уроки → шаги с прогрессом. */
export const NavigationTreeVo = v.pipe(
  v.object({
    projects: v.pipe(v.array(ProjectNodeVo), description('Проекты модуля')),
  }),
  description('Дерево навигации студента по модулю'),
);
export type NavigationTree = v.InferOutput<typeof NavigationTreeVo>;

/** Шаги урока для показа: заголовки, индексы (с 1) и статусы. */
export const LessonStepsVo = v.pipe(
  v.object({
    lessonTitle: F.string('Заголовок урока'),
    lessonIndex: F.int('урока в проекте (с 1)'),
    projectTitle: F.string('Заголовок проекта'),
    projectIndex: F.int('проекта в модуле (с 1)'),
    steps: v.pipe(v.array(StepNodeVo), description('Шаги урока')),
  }),
  description('Шаги урока для показа студенту'),
);
export type LessonSteps = v.InferOutput<typeof LessonStepsVo>;

/** Позиция шага в снимке контента: индексы с 1. */
export const StepPositionVo = v.pipe(
  v.object({
    projectIndex: F.int('проекта (с 1)'),
    projectTitle: F.string('Заголовок проекта'),
    lessonIndex: F.int('урока (с 1)'),
    lessonTitle: F.string('Заголовок урока'),
    stepIndex: F.int('шага в уроке (с 1)'),
    totalSteps: F.int('шагов в уроке'),
  }),
  description('Позиция шага в программе модуля'),
);
export type StepPosition = v.InferOutput<typeof StepPositionVo>;

/** Уровень отставания студента. */
export const LagLevelVo = F.picklist(
  ['critical', 'lagging', 'on_track'],
  'уровня отставания',
);
export type LagLevel = v.InferOutput<typeof LagLevelVo>;

/** Отставание студента на момент расчёта. */
export const LagInfoVo = v.pipe(
  v.object({
    lagLevel: LagLevelVo,
    hoursSinceLastActivity: v.pipe(
      v.number(),
      description('Часов с последней активности'),
    ),
  }),
  description('Отставание студента'),
);
export type LagInfo = v.InferOutput<typeof LagInfoVo>;

/** Запись состава потока по отставанию: студент и его отставание. */
export const RosterEntryVo = v.pipe(
  v.object({ studentId: F.uuid('записи студента'), ...LagInfoVo.entries }),
  description('Отставание студента потока'),
);
export type RosterEntry = v.InferOutput<typeof RosterEntryVo>;

/** Статистика времени выполнения шагов по категориям. */
export type StepTimeStats = {
  readonly runner: number;
  readonly fast: number;
  readonly normal: number;
  readonly deep: number;
};

/** Категория времени с названием и числом шагов. */
export const TimeCategoryVo = v.pipe(
  v.object({
    emoji: F.string('Значок категории'),
    name: F.string('Название категории'),
    count: F.int('шагов в категории'),
  }),
  description('Категория времени выполнения шагов'),
);
export type TimeCategory = v.InferOutput<typeof TimeCategoryVo>;

/** Сводка студента для строки списка. */
export type StudentRowSummary = {
  readonly progress: Progress;
  readonly medianTimeMinutes: number | null;
  readonly dominantCategory: TimeCategory | null;
};

/** Данные карточки студента. */
export const StudentCardVo = v.pipe(
  v.object({
    moduleProgress: ProgressVo,
    currentProject: v.optional(
      v.pipe(
        v.object({
          title: F.string('Заголовок проекта'),
          progress: ProgressVo,
        }),
        description('Текущий проект студента'),
      ),
    ),
    currentLesson: v.optional(
      v.pipe(
        v.object({ title: F.string('Заголовок урока') }),
        description('Текущий урок студента'),
      ),
    ),
    medianTimeMinutes: v.pipe(
      v.nullable(v.number()),
      description('Медиана минут на шаг; null — завершённых шагов нет'),
    ),
    timeCategories: v.pipe(
      v.array(TimeCategoryVo),
      description('Шаги по категориям времени'),
    ),
    hoursSinceLastActivity: v.pipe(
      v.number(),
      description('Часов с последней активности'),
    ),
    lagLevel: LagLevelVo,
  }),
  description('Карточка студента'),
);
export type StudentCard = v.InferOutput<typeof StudentCardVo>;

/**
 * Результат завершения шага студентом: уровень перехода и следующий шаг.
 * `stream` — шаги потока закончились (исход указывает ментор).
 */
export const CompletionResultVo = v.pipe(
  v.variant('level', [
    v.object({
      level: F.picklist(['step'], 'уровня: шаг'),
      currentStepId: F.uuid('следующего шага'),
    }),
    v.object({
      level: F.picklist(['lesson'], 'уровня: урок'),
      currentStepId: F.uuid('следующего шага'),
      completedLessonId: F.uuid('завершённого урока'),
    }),
    v.object({
      level: F.picklist(['project'], 'уровня: проект'),
      currentStepId: F.uuid('следующего шага'),
      completedProjectId: F.uuid('завершённого проекта'),
    }),
    v.object({
      level: F.picklist(['stream'], 'уровня: поток'),
      completed: F.boolean('шаги потока закончились'),
    }),
    v.object({
      level: F.picklist(['already_completed'], 'уровня: шаг уже завершён'),
      currentStepId: F.uuid('текущего шага студента'),
    }),
  ]),
  description('Результат завершения шага'),
);
export type CompletionResult = v.InferOutput<typeof CompletionResultVo>;
