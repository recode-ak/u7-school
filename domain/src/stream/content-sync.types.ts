import { F } from 'dmg-core';
import * as v from 'valibot';
import { StudentState } from './student/student.state';

// Отчёт синхронизации контента идущего потока (F-80): различия снимков и
// план по студентам. Схемы — для выхода UC (Ф2); позиция шага — индекс в
// плоском обходе «проекты → уроки → шаги» с 1.

const list = <T extends v.GenericSchema>(item: T, description: string) =>
  v.pipe(v.array(item), v.description(description));

const TitledProject = v.object({
  projectId: F.uuid('проекта'),
  title: F.string('Заголовок проекта'),
});

const TitledLesson = v.object({
  lessonId: F.uuid('урока'),
  projectId: F.uuid('проекта урока'),
  title: F.string('Заголовок урока'),
});

const ProjectRename = v.object({
  projectId: F.uuid('переименованного проекта'),
  from: F.string('Прежний заголовок'),
  to: F.string('Новый заголовок'),
});

const LessonRename = v.object({
  lessonId: F.uuid('переименованного урока'),
  from: F.string('Прежний заголовок'),
  to: F.string('Новый заголовок'),
});

const StepAt = v.object({
  stepId: F.uuid('шага'),
  lessonId: F.uuid('урока шага'),
  projectId: F.uuid('проекта шага'),
  index: F.int('Позиция шага в снимке (с 1)'),
});

const Place = v.pipe(
  v.object({
    projectId: F.uuid('проекта шага'),
    lessonId: F.uuid('урока шага'),
    index: F.int('Позиция шага в снимке (с 1)'),
  }),
  v.description('Место шага в снимке'),
);

/** Различия двух снимков контента: проекты, уроки, шаги. */
export const SnapshotDiffVo = v.pipe(
  v.object({
    changed: F.boolean('снимки различаются хоть в чём-то'),
    projects: v.pipe(
      v.object({
        added: list(TitledProject, 'Добавленные проекты'),
        removed: list(TitledProject, 'Удалённые проекты'),
        renamed: list(ProjectRename, 'Переименованные проекты'),
      }),
      v.description('Различия проектов'),
    ),
    lessons: v.pipe(
      v.object({
        added: list(TitledLesson, 'Добавленные уроки'),
        removed: list(TitledLesson, 'Удалённые уроки'),
        renamed: list(LessonRename, 'Переименованные уроки'),
      }),
      v.description('Различия уроков'),
    ),
    steps: v.pipe(
      v.object({
        added: list(StepAt, 'Добавленные шаги; позиция — в новом снимке'),
        removed: list(StepAt, 'Удалённые шаги; позиция — в старом снимке'),
        moved: list(
          v.object({
            stepId: F.uuid('перенесённого шага'),
            from: Place,
            to: Place,
          }),
          'Перенесённые шаги: сменили урок или проект либо нарушили порядок среди общих',
        ),
      }),
      v.description('Различия шагов'),
    ),
  }),
  v.description('Различия снимка потока и нового снимка модуля'),
);

export type SnapshotDiff = v.InferOutput<typeof SnapshotDiffVo>;

/**
 * Шаги, сменившие сторону относительно опорного шага; порядок — новый
 * снимок. `null` — опорного шага нет в снимке.
 */
export type PivotShift = {
  readonly pivotInNew: number | null;
  readonly pivotInOld: number | null;
  readonly newlyBehind: string[];
  readonly newlyAhead: string[];
};

const StepIds = (description: string) => list(F.uuid('шага'), description);

/** Что обновление сделает со студентом потока. */
export const StudentImpactVo = v.pipe(
  v.object({
    studentId: F.uuid('студента'),
    userId: F.uuid('пользователя-студента'),
    status: StudentState.entries.status,
    kind: F.picklist(
      ['in_progress', 'not_started'],
      'Студент идёт по шагам или ещё не получил ни одного',
    ),
    behind: StepIds('Шаги, оказавшиеся позади студента: будут зачтены'),
    ahead: StepIds('Шаги, оказавшиеся впереди студента'),
    tail: v.optional(
      F.uuid('шага в хвосте: выдаст следующее действие студента'),
    ),
    completedAhead: StepIds(
      'Пройденные шаги, ушедшие вперёд от студента (предупреждение)',
    ),
    removedPassed: StepIds(
      'Удалённые шаги с записью у студента: запись остаётся',
    ),
    removesCurrent: F.boolean('текущий шаг студента удаляется'),
  }),
  v.description('Влияние обновления контента на студента'),
);

export type StudentImpact = v.InferOutput<typeof StudentImpactVo>;

/** Причина, по которой обновление применить нельзя. */
export const SyncBlockerVo = v.pipe(
  v.variant('code', [
    v.object({
      code: v.pipe(
        v.literal('CONTENT_NOT_SYNCABLE'),
        v.description('Поток не в статусе набора или идущего'),
      ),
    }),
    v.object({
      code: v.pipe(
        v.literal('SYNC_REMOVES_CURRENT_STEP'),
        v.description('Обновление удаляет текущий шаг студентов'),
      ),
      students: list(
        v.object({
          studentId: F.uuid('студента на удаляемом шаге'),
          userId: F.uuid('пользователя-студента на удаляемом шаге'),
        }),
        'Студенты, чей текущий шаг удаляется',
      ),
    }),
  ]),
  v.description('Причина отказа обновления контента'),
);

export type SyncBlocker = v.InferOutput<typeof SyncBlockerVo>;

/** План обновления контента потока: ничего не мутирует. */
export const ContentSyncPlanVo = v.pipe(
  v.object({
    mode: F.picklist(
      ['replace', 'sync', 'refused'],
      'Режим: замена в наборе, синхронизация идущего, отказ',
    ),
    diff: SnapshotDiffVo,
    students: list(StudentImpactVo, 'Идущие студенты (режим sync)'),
    affected: list(
      F.uuid('затронутого студента'),
      'Студенты, которым будут зачтены шаги: их подтверждает ментор',
    ),
    blockers: list(SyncBlockerVo, 'Причины отказа; пусто — применять можно'),
  }),
  v.description('Предпросмотр обновления контента потока'),
);

export type ContentSyncPlan = v.InferOutput<typeof ContentSyncPlanVo>;
