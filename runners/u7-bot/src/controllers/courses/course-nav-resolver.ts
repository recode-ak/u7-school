import type { KbButton, NavChild, NavLevel } from '@u7-scl/core/ui';
import type {
  ContentSnapshot,
  CourseView,
} from '@u7-scl/domain/course/contract';
import { Routes } from '../shared/routes';

export interface ModuleNavInfo {
  title: string;
  projectTitles?: string[];
}

export type CourseNavLevelKind =
  | 'course'
  | 'phase'
  | 'module'
  | 'project'
  | 'lesson';

export interface ResolveCourseNavLevelParams {
  level: CourseNavLevelKind;
  courses: CourseView[];
  currentCourseId: string;
  phaseIdx?: number;
  moduleId?: string;
  projectId?: string;
  lessonId?: string;
  modulesInfo?: Record<string, ModuleNavInfo>;
  moduleSnapshot?: ContentSnapshot;
  stepTitles?: Record<string, string>;
  wishStatus?: string;
  storyPrefix?: string;
}

/**
 * Склонение существительных после числительных в русском языке.
 */
function plural(n: number, one: string, two: string, five: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return five;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return two;
  return five;
}

/**
 * Формирует ряд wish-кнопок для карточки курса.
 */
function buildCourseWishRows(
  courseId: string,
  wishStatus: string | undefined,
  storyPrefix: string,
): KbButton[][] {
  if (wishStatus === 'pending') {
    return [
      [
        {
          text: '📝 Продолжить анкету',
          code: Routes.questionnaire.resume(courseId),
        },
      ],
    ];
  }
  if (wishStatus === 'expressed' || wishStatus === 'confirmed') {
    return [
      [
        {
          text: '🗑️ Отменить желание',
          code: `${storyPrefix}:cancel:${courseId}`,
        },
      ],
    ];
  }
  return [
    [
      {
        text: '🎓 Хочу пройти курс',
        code: `${storyPrefix}:apply:${courseId}`,
      },
    ],
  ];
}

/** Область навигации: этап курса или, если этапов нет, вся программа. */
interface Scope {
  /** Заголовок этапа; у курса без этапов — `undefined`, уровня этапа нет. */
  stageTitle?: string;
  moduleIds: string[];
}

/** Область по индексу этапа; `null` — этапа с таким индексом нет. */
function scopeOf(course: CourseView, stageIdx: number): Scope | null {
  if (course.stages.length === 0) return { moduleIds: course.moduleIds };
  const stage = course.stages[stageIdx];
  if (!stage) return null;
  return { stageTitle: stage.title, moduleIds: stage.moduleIds };
}

/** Крошка этапа; у курса без этапов её нет. */
function stageCrumb(scope: Scope, stageIdx: number, total: number): string[] {
  return scope.stageTitle === undefined
    ? []
    : [`Этап ${stageIdx + 1}/${total}: ${scope.stageTitle}`];
}

/** Строки модулей области: нумерация, число проектов, переход в модуль. */
function buildModuleChildren(
  course: CourseView,
  stageIdx: number,
  moduleIds: string[],
  modulesInfo: Record<string, ModuleNavInfo>,
  storyPrefix: string,
): NavChild[] {
  return moduleIds.map((modId, mIdx) => {
    const modInfo = modulesInfo[modId];
    const title = modInfo?.title ?? `Модуль ${modId.slice(0, 8)}...`;
    const prjCount = modInfo?.projectTitles?.length ?? 0;
    const meta = `(${prjCount} ${plural(prjCount, 'проект', 'проекта', 'проектов')})`;

    return {
      id: modId,
      index: mIdx + 1,
      title,
      meta,
      enterable: true,
      address: `${storyPrefix}:module:${course.uuid}:${stageIdx}:${modId}`,
    };
  });
}

/**
 * Резолвит карточку NavLevel для каталога курсов.
 * Чистая функция без побочных эффектов.
 */
export function resolveCourseNavLevel(
  params: ResolveCourseNavLevelParams,
): NavLevel | null {
  const {
    level,
    courses,
    currentCourseId,
    phaseIdx,
    modulesInfo = {},
    wishStatus,
    storyPrefix = 'course-catalog',
  } = params;

  const courseIndex = courses.findIndex((c) => c.uuid === currentCourseId);
  const course = courses[courseIndex];
  if (!course) return null;

  // ── Уровень 0: Курс (уровень корня каталога) ──
  if (level === 'course') {
    const stages = course.stages;
    let subtitle: string;
    let children: NavChild[];
    const breadcrumbs = [
      '📖 Курсы',
      `Курс ${courseIndex + 1}/${courses.length}: ${course.title}`,
    ];

    if (stages.length === 0) {
      subtitle = 'Модули курса:';
      children = buildModuleChildren(
        course,
        0,
        course.moduleIds,
        modulesInfo,
        storyPrefix,
      );
    } else if (stages.length === 1) {
      // Один этап не показываем отдельным шагом: сразу его модули.
      const only = stages[0];
      if (!only) return null;
      breadcrumbs.push(`Этап 1/1: ${only.title}`);
      subtitle = 'Модули этапа:';
      children = buildModuleChildren(
        course,
        0,
        only.moduleIds,
        modulesInfo,
        storyPrefix,
      );
    } else {
      subtitle = 'Этапы курса:';
      children = stages.map((stage, pIdx) => {
        const modCount = stage.moduleIds.length;
        const meta = `(${modCount} ${plural(modCount, 'модуль', 'модуля', 'модулей')})`;

        return {
          id: `phase-${pIdx}`,
          index: pIdx + 1,
          title: stage.title,
          meta,
          enterable: true,
          address: `${storyPrefix}:phase:${course.uuid}:${pIdx}`,
        };
      });
    }

    const prevCourse = courses[courseIndex - 1];
    const nextCourse = courses[courseIndex + 1];

    return {
      multilineBreadcrumbs: true,
      breadcrumbs,
      subtitle,
      children,
      extraRows: buildCourseWishRows(course.uuid, wishStatus, storyPrefix),
      prev: prevCourse
        ? {
            label: '◀️ Пред. курс',
            address: `${storyPrefix}:course:${prevCourse.uuid}`,
          }
        : undefined,
      next: nextCourse
        ? {
            label: 'След. курс ▶️',
            address: `${storyPrefix}:course:${nextCourse.uuid}`,
          }
        : undefined,
      back: {
        label: '↩️ Главное меню',
        address: Routes.app.mainMenu,
      },
    };
  }

  // ── Уровень 1: Этап ──
  if (level === 'phase') {
    const currentStageIdx = phaseIdx ?? 0;
    const stage = course.stages[currentStageIdx];
    if (!stage) return null;

    const subtitle = 'Модули этапа:';

    const children = buildModuleChildren(
      course,
      currentStageIdx,
      stage.moduleIds,
      modulesInfo,
      storyPrefix,
    );

    const prevStage = course.stages[currentStageIdx - 1];
    const nextStage = course.stages[currentStageIdx + 1];

    const totalCourses = courses.length;
    const totalStages = course.stages.length;
    return {
      multilineBreadcrumbs: true,
      breadcrumbs: [
        '📖 Курсы',
        `Курс ${courseIndex + 1}/${totalCourses}: ${course.title}`,
        `Этап ${currentStageIdx + 1}/${totalStages}: ${stage.title}`,
      ],
      subtitle,
      children,
      prev: prevStage
        ? {
            label: '◀️ Пред. этап',
            address: `${storyPrefix}:phase:${course.uuid}:${currentStageIdx - 1}`,
          }
        : undefined,
      next: nextStage
        ? {
            label: 'След. этап ▶️',
            address: `${storyPrefix}:phase:${course.uuid}:${currentStageIdx + 1}`,
          }
        : undefined,
      back: {
        label: '⬅️ Назад к курсу',
        address: `${storyPrefix}:course:${course.uuid}`,
      },
    };
  }

  // ── Уровень 2: Модуль ──
  if (level === 'module') {
    const currentStageIdx = course.stages.length === 0 ? 0 : (phaseIdx ?? 0);
    const scope = scopeOf(course, currentStageIdx);
    if (!scope) return null;

    if (!params.moduleId || !params.moduleSnapshot) return null;
    const modId = params.moduleId;
    const modIndex = scope.moduleIds.indexOf(modId);
    if (modIndex === -1) return null;

    const modInfo = modulesInfo[modId];
    const moduleTitle = modInfo?.title ?? `Модуль ${modId.slice(0, 8)}...`;
    const snapshot = params.moduleSnapshot;

    const subtitle = 'Проекты модуля:';

    const children: NavChild[] = snapshot.map((p, pIdx) => {
      const lessonCount = p.lessons.length;
      const meta = `(${lessonCount} ${plural(lessonCount, 'урок', 'урока', 'уроков')})`;

      return {
        id: p.projectId,
        index: pIdx + 1,
        title: p.projectTitle,
        meta,
        enterable: true,
        address: `${storyPrefix}:prj:${course.uuid}:${modId}:${p.projectId}`,
      };
    });

    const prevModId = scope.moduleIds[modIndex - 1];
    const nextModId = scope.moduleIds[modIndex + 1];
    const totalCourses = courses.length;
    const totalStages = course.stages.length;
    const totalMods = scope.moduleIds.length;

    return {
      multilineBreadcrumbs: true,
      breadcrumbs: [
        '📖 Курсы',
        `Курс ${courseIndex + 1}/${totalCourses}: ${course.title}`,
        ...stageCrumb(scope, currentStageIdx, totalStages),
        `Модуль ${modIndex + 1}/${totalMods}: ${moduleTitle}`,
      ],
      subtitle,
      children,
      prev: prevModId
        ? {
            label: '◀️ Пред. модуль',
            address: `${storyPrefix}:module:${course.uuid}:${currentStageIdx}:${prevModId}`,
          }
        : undefined,
      next: nextModId
        ? {
            label: 'След. модуль ▶️',
            address: `${storyPrefix}:module:${course.uuid}:${currentStageIdx}:${nextModId}`,
          }
        : undefined,
      back:
        course.stages.length >= 2
          ? {
              label: '⬅️ Назад к этапу',
              address: `${storyPrefix}:phase:${course.uuid}:${currentStageIdx}`,
            }
          : {
              label: '⬅️ Назад к курсу',
              address: `${storyPrefix}:course:${course.uuid}`,
            },
    };
  }

  // ── Уровень 3: Проект ──
  if (level === 'project') {
    const currentStageIdx = course.stages.length === 0 ? 0 : (phaseIdx ?? 0);
    const scope = scopeOf(course, currentStageIdx);
    if (!scope) return null;

    if (!params.moduleId || !params.projectId || !params.moduleSnapshot) {
      return null;
    }
    const modId = params.moduleId;
    const modIndex = scope.moduleIds.indexOf(modId);
    const modInfo = modulesInfo[modId];
    const moduleTitle = modInfo?.title ?? `Модуль ${modId.slice(0, 8)}...`;
    const snapshot = params.moduleSnapshot;

    const projectIndex = snapshot.findIndex(
      (p) => p.projectId === params.projectId,
    );
    if (projectIndex === -1) return null;
    const project = snapshot[projectIndex];
    if (!project) return null;

    const subtitle = 'Уроки проекта:';

    const children: NavChild[] = project.lessons.map((l, lIdx) => {
      const stepCount = l.stepIds.length;
      const meta = `(${stepCount} ${plural(stepCount, 'шаг', 'шага', 'шагов')})`;

      return {
        id: l.lessonId,
        index: lIdx + 1,
        title: l.lessonTitle,
        meta,
        enterable: true,
        address: `${storyPrefix}:les:${course.uuid}:${project.projectId}:${l.lessonId}`,
      };
    });

    const prevProject = snapshot[projectIndex - 1];
    const nextProject = snapshot[projectIndex + 1];
    const totalCourses = courses.length;
    const totalStages = course.stages.length;
    const totalMods = scope.moduleIds.length;
    const totalProjects = snapshot.length;

    return {
      multilineBreadcrumbs: true,
      breadcrumbs: [
        '📖 Курсы',
        `Курс ${courseIndex + 1}/${totalCourses}: ${course.title}`,
        ...stageCrumb(scope, currentStageIdx, totalStages),
        `Модуль ${modIndex >= 0 ? `${modIndex + 1}/${totalMods}: ` : ''}${moduleTitle}`,
        `Проект ${projectIndex + 1}/${totalProjects}: ${project.projectTitle}`,
      ],
      subtitle,
      children,
      prev: prevProject
        ? {
            label: '◀️ Пред. проект',
            address: `${storyPrefix}:prj:${course.uuid}:${modId}:${prevProject.projectId}`,
          }
        : undefined,
      next: nextProject
        ? {
            label: 'След. проект ▶️',
            address: `${storyPrefix}:prj:${course.uuid}:${modId}:${nextProject.projectId}`,
          }
        : undefined,
      back: {
        label: '⬅️ Назад к модулю',
        address: `${storyPrefix}:module:${course.uuid}:${currentStageIdx}:${modId}`,
      },
    };
  }

  // ── Уровень 4: Урок (шаги только заголовками, закрытый уровень) ──
  if (level === 'lesson') {
    const currentStageIdx = course.stages.length === 0 ? 0 : (phaseIdx ?? 0);
    const scope = scopeOf(course, currentStageIdx);
    if (!scope) return null;

    if (
      !params.moduleId ||
      !params.projectId ||
      !params.lessonId ||
      !params.moduleSnapshot
    ) {
      return null;
    }
    const modId = params.moduleId;
    const modIndex = scope.moduleIds.indexOf(modId);
    const modInfo = modulesInfo[modId];
    const moduleTitle = modInfo?.title ?? `Модуль ${modId.slice(0, 8)}...`;
    const snapshot = params.moduleSnapshot;

    const project = snapshot.find((p) => p.projectId === params.projectId);
    if (!project) return null;
    const projectIndex = snapshot.findIndex(
      (p) => p.projectId === params.projectId,
    );

    const lessonIndex = project.lessons.findIndex(
      (l) => l.lessonId === params.lessonId,
    );
    if (lessonIndex === -1) return null;
    const lesson = project.lessons[lessonIndex];
    if (!lesson) return null;

    const subtitle = 'Шаги урока:';

    const children: NavChild[] = lesson.stepIds.map((sId, sIdx) => {
      const title = params.stepTitles?.[sId] ?? `Шаг ${sIdx + 1}`;
      return {
        id: sId,
        index: sIdx + 1,
        title,
        enterable: false,
      };
    });

    const prevLesson = project.lessons[lessonIndex - 1];
    const nextLesson = project.lessons[lessonIndex + 1];
    const totalCourses = courses.length;
    const totalStages = course.stages.length;
    const totalMods = scope.moduleIds.length;
    const totalProjects = snapshot.length;
    const totalLessons = project.lessons.length;

    return {
      multilineBreadcrumbs: true,
      breadcrumbs: [
        '📖 Курсы',
        `Курс ${courseIndex + 1}/${totalCourses}: ${course.title}`,
        ...stageCrumb(scope, currentStageIdx, totalStages),
        `Модуль ${modIndex >= 0 ? `${modIndex + 1}/${totalMods}: ` : ''}${moduleTitle}`,
        `Проект ${projectIndex >= 0 ? `${projectIndex + 1}/${totalProjects}: ` : ''}${project.projectTitle}`,
        `Урок ${lessonIndex + 1}/${totalLessons}: ${lesson.lessonTitle}`,
      ],
      subtitle,
      children,
      prev: prevLesson
        ? {
            label: '◀️ Пред. урок',
            address: `${storyPrefix}:les:${course.uuid}:${project.projectId}:${prevLesson.lessonId}`,
          }
        : undefined,
      next: nextLesson
        ? {
            label: 'След. урок ▶️',
            address: `${storyPrefix}:les:${course.uuid}:${project.projectId}:${nextLesson.lessonId}`,
          }
        : undefined,
      back: {
        label: '⬅️ Назад к проекту',
        address: `${storyPrefix}:prj:${course.uuid}:${modId}:${project.projectId}`,
      },
    };
  }

  return null;
}
