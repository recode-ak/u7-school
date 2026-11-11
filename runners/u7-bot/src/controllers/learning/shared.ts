import { type MdText, md, mdConcat, mdJoin, mdRaw } from '@u7-scl/core/shared';
import type { DialogResponse, NavNodeStatus } from '@u7-scl/core/ui';
import {
  formatBreadcrumbs,
  formatStepBody,
  STATUS_ICONS,
  screen,
} from '@u7-scl/core/ui';
import {
  type ContentSnapshot,
  type CourseModuleDef,
  GetStepsByLessonsUcDef,
  GetStepUcDef,
} from '@u7-scl/domain/course/contract';
import {
  GetStudentByUserUcDef,
  type Progress,
  type StreamModuleDef,
  type StudentProgress,
  type StudentView,
} from '@u7-scl/domain/stream/contract';
import type { Command, OutputOf, Result, UseCaseErrorOf } from 'dmg-core';
import type { U7BotActor } from '../../core/u7-bot-app-meta';

/** Студент в представлении контракта `stream`. */
export type Student = StudentView;

/**
 * Исполнитель команд модуля `stream` от имени актора: стори отдаёт замыкание
 * над `dispatchUc` (метод защищён, хелперы раздела learning его не видят).
 */
export type StreamDispatch = <
  D extends (typeof StreamModuleDef)['useCases'][number],
>(
  command: Command<D>,
) => Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;

/**
 * Исполнитель команд модуля `course` от имени актора: стори отдаёт замыкание
 * над `dispatchUc` (метод защищён, хелперы раздела learning его не видят).
 */
export type CourseDispatch = <
  D extends (typeof CourseModuleDef)['useCases'][number],
>(
  command: Command<D>,
) => Promise<Result<OutputOf<D>, UseCaseErrorOf<D>>>;

/** Расчёты прогресса из `getStudentProgress` (поток есть). */
export type ProgressView = NonNullable<StudentProgress['progress']>;

/**
 * Получает студента по userId через `getStudentByUser`.
 * Возвращает DialogResponse (экран) при ошибке.
 */
export async function getStudent(
  dispatch: StreamDispatch,
  actor: U7BotActor,
): Promise<
  { ok: true; value: Student } | { ok: false; value: DialogResponse }
> {
  try {
    const res = await dispatch(
      GetStudentByUserUcDef.command({ userId: actor.user.uuid }),
    );
    return res.ok
      ? { ok: true, value: res.value }
      : { ok: false, value: notEnrolled() };
  } catch {
    return { ok: false, value: notEnrolled() };
  }
}

/** Экран «студент не записан» (общий для стори learning). */
export function notEnrolled(): DialogResponse {
  return screen(md`📖 Вы не записаны ни на один поток`);
}

/** Поток в части, нужной студенческим экранам. */
export type StreamSnapshotView = {
  title: string;
  contentSnapshot: ContentSnapshot;
};

/**
 * Получает студента и поток. null — студент не записан или поток недоступен.
 */
export async function getStudentAndStream(
  dispatch: StreamDispatch,
  actor: U7BotActor,
  loadStream: (streamId: string) => Promise<StreamSnapshotView | undefined>,
): Promise<{
  student: Student | null;
  stream: { title: string; contentSnapshot: ContentSnapshot } | null;
}> {
  const studentResult = await getStudent(dispatch, actor);
  if (!studentResult.ok) return { student: null, stream: null };

  const student = studentResult.value;

  try {
    const stream = await loadStream(student.streamId);
    return stream ? { student, stream } : { student: null, stream: null };
  } catch {
    return { student: null, stream: null };
  }
}

/** Находит lessonId для шага в снапшоте. */
export function findLessonIdForStep(
  snapshot: ContentSnapshot,
  stepId: string,
): string | null {
  for (const project of snapshot) {
    for (const lesson of project.lessons) {
      if (lesson.stepIds.includes(stepId)) {
        return lesson.lessonId;
      }
    }
  }
  return null;
}

/** Список completed шагов в порядке прохождения. */
export function getCompletedStepsInOrder(student: Student): string[] {
  return student.steps
    .filter((s) => s.status === 'completed')
    .map((s) => s.stepId);
}

/** Строит список шагов урока с маркерами для отображения в просмотре шага. */
export async function buildStepList(
  dispatch: CourseDispatch,
  snapshot: ContentSnapshot,
  lessonId: string,
  student: Student,
): Promise<MdText> {
  const stepStatuses = new Map<string, 'completed' | 'issued'>();
  for (const sr of student.steps) {
    stepStatuses.set(sr.stepId, sr.status as 'completed' | 'issued');
  }

  // Найти stepIds урока
  let stepIds: string[] = [];
  for (const project of snapshot) {
    for (const lesson of project.lessons) {
      if (lesson.lessonId === lessonId) {
        stepIds = lesson.stepIds;
        break;
      }
    }
    if (stepIds.length > 0) break;
  }

  if (stepIds.length === 0) return md``;

  const lines: MdText[] = [md`_Шаги урока:_`];

  for (const sid of stepIds) {
    const status = stepStatuses.get(sid);
    let marker: string;
    if (status === 'completed') {
      marker = '✅';
    } else if (status === 'issued') {
      marker = '▶️';
    } else {
      marker = '🔒';
    }

    const loaded = await dispatch(GetStepUcDef.command({ stepId: sid }));
    const desc = loaded.ok ? loaded.value.description : sid;

    lines.push(md`${marker} _${desc}_`);
  }

  return mdJoin(lines);
}

/**
 * Загружает описания шагов через get-steps-by-lessons.
 */
export async function loadStepDescriptions(
  dispatch: CourseDispatch,
  lessonIds: string[],
): Promise<Record<string, Array<{ uuid: string; description: string }>>> {
  const res = await dispatch(GetStepsByLessonsUcDef.command({ lessonIds }));
  return res.ok ? res.value : {};
}

/**
 * Форматирует прогресс-бар: [██████░░░░] X/Y (10 блоков).
 * Возвращает уже размеченный MdText (mdRaw).
 */
export function formatProgressBar(current: number, total: number): MdText {
  const width = 10;
  const filled = total === 0 ? 0 : Math.round((current / total) * width);
  const empty = width - filled;
  const block = '█'.repeat(filled) + '░'.repeat(empty);
  return mdRaw(`\\[${block}\\] ${current}/${total}`);
}

export interface FormatStepMessageOpts {
  mode?: 'study' | 'student' | 'readOnly';
  breadcrumbs?: string[];
  status?: NavNodeStatus;
  statusLabel?: string;
}

/**
 * Форматирует сообщение шага: заголовок, разделитель, тело.
 * Поддерживает режимы:
 * - 'student' — карточка шага drill-down со статусом студента (S05b);
 * - 'readOnly' — карточка шага drill-down для ментора/зрителя (S03) без статуса;
 * - 'study' (дефолт) — режим прохождения с прогресс-баром (S05a).
 */
export function formatStepMessage(
  streamTitle: string,
  resolved: {
    projectIndex: number;
    lessonIndex: number;
    stepIndex: number;
    totalSteps: number;
    projectTitle: string;
    lessonTitle: string;
  } | null,
  step: {
    uuid: string;
    description: string;
    kind: string;
    code?: string;
    content?: string;
  },
  lessonProgress?: Progress,
  opts?: FormatStepMessageOpts,
): MdText {
  const mode = opts?.mode ?? 'study';

  if (mode === 'student' || mode === 'readOnly') {
    const sections: MdText[] = [];

    // Хлебные крошки
    const defaultBreadcrumbs = [
      '📖 Программа модуля',
      resolved?.projectTitle ?? 'Проект',
      resolved?.lessonTitle ?? 'Урок',
      `Шаг ${resolved?.stepIndex ?? 1}`,
    ];
    sections.push(formatBreadcrumbs(opts?.breadcrumbs ?? defaultBreadcrumbs));

    // Статус (только для режима студента)
    if (mode === 'student') {
      const status = opts?.status ?? 'in_progress';
      const icon = STATUS_ICONS[status] ?? '▶️';
      const label =
        opts?.statusLabel ??
        (status === 'completed' ? 'Пройден' : 'В процессе');
      sections.push(md`${icon} ${label}`);
    }

    // Тело шага
    const body = formatStepBody(step);
    if (body) {
      sections.push(body);
    }

    return mdJoin(sections, '\n\n');
  }

  // Режим 'study' (активное прохождение S05a):
  // Прогресс урока: только завершённые шаги.
  // completed и total берём из одного источника: иначе прогресс-бар
  // может получить completed > total и упасть в String.repeat.
  let completed = resolved?.stepIndex ?? 0;
  let totalSteps = resolved?.totalSteps ?? 1;
  if (lessonProgress) {
    completed = lessonProgress.completed;
    totalSteps = lessonProgress.total;
  }

  const lines: MdText[] = [
    md`📖 *Поток:* ${streamTitle}`,
    md`📁 *Проект:* ${resolved?.projectTitle ?? '(неизвестный проект)'}`,
    md`📚 *Урок:* «${resolved?.lessonTitle ?? '(неизвестный урок)'}»`,
    md`🔢 p${resolved?.projectIndex ?? 0}\\-l${resolved?.lessonIndex ?? 0}`,
    md``,
    mdRaw('――――――――――――――'),
    md``,
    mdConcat(md`📊 `, formatProgressBar(completed, totalSteps)),
    md`📝 *Шаг ${resolved?.stepIndex ?? 1} из ${totalSteps}:* ${step.description}`,
  ];

  const body = formatStepBody(step);
  if (body) {
    lines.push(md``, body);
  }

  return mdJoin(lines);
}

/**
 * Строит сообщение о переходе (завершение урока/проекта) по расчётам
 * `getStudentProgress` (с `lessonId` завершённого урока — заголовок урока).
 */
export function buildTransitionMessage(
  result: {
    level: 'lesson' | 'project';
    completedLessonId?: string;
    completedProjectId?: string;
    currentStepId?: string;
  },
  stream: { title: string; contentSnapshot: ContentSnapshot },
  progress: ProgressView,
): {
  messageText: MdText;
  buttonText: string;
} {
  if (result.level === 'lesson' && result.completedLessonId) {
    const lessonTitle = progress.lesson?.lessonTitle ?? '';

    // Найти проект, содержащий этот урок
    let projectIdx = 0;
    for (let pi = 0; pi < stream.contentSnapshot.length; pi++) {
      const p = stream.contentSnapshot[pi];
      if (p?.lessons.some((l) => l.lessonId === result.completedLessonId)) {
        projectIdx = pi;
        break;
      }
    }

    // Шаги проекта — сумма по урокам дерева навигации (проект с тем же индексом)
    const projectNode = progress.tree.projects[projectIdx];
    const projectProgress = projectNode
      ? {
          completed: projectNode.lessons.reduce(
            (sum, l) => sum + l.completedSteps,
            0,
          ),
          total: projectNode.lessons.reduce((sum, l) => sum + l.totalSteps, 0),
        }
      : { completed: 0, total: 0 };

    const messageText = mdJoin([
      md`🎉 Урок «${lessonTitle}» завершён\\!`,
      md``,
      mdConcat(
        md`📊 Прогресс по модулю: `,
        formatProgressBar(progress.module.completed, progress.module.total),
      ),
      mdConcat(
        md`📊 Прогресс по проекту: `,
        formatProgressBar(projectProgress.completed, projectProgress.total),
      ),
    ]);

    return { messageText, buttonText: '▶️ Начать следующий урок' };
  }

  if (result.level === 'project' && result.completedProjectId) {
    const title =
      stream.contentSnapshot.find(
        (p) => p.projectId === result.completedProjectId,
      )?.projectTitle ?? '';

    const messageText = mdJoin([
      md`🚀 Проект «${title}» завершён\\!`,
      md``,
      mdConcat(
        md`📊 Прогресс по модулю: `,
        formatProgressBar(progress.module.completed, progress.module.total),
      ),
    ]);

    return { messageText, buttonText: '▶️ Начать следующий проект' };
  }

  return { messageText: md`🎉 Отличная работа\\!`, buttonText: '▶️ Продолжить' };
}
