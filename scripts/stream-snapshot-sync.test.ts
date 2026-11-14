import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import type { ContentSnapshot } from '@u7-scl/domain/course/contract';
import type { StudentState } from '@u7-scl/domain/stream';
import { StudentJsonRepo } from '@u7-scl/stream';
import { TempDir, testUuid } from 'dmg-core/testing';
import * as v from 'valibot';
import {
  analyzeSnapshotDelta,
  extractStepIds,
  parseStudentRows,
  readStudentRows,
  syncAheadStudents,
  writeStudentRows,
} from './stream-snapshot-sync';

// Вспомогательная функция для генерации тестового снапшота
function makeSnapshot(
  structure: Array<{
    projectId: string;
    lessons: Array<{ lessonId: string; stepIds: string[] }>;
  }>,
): ContentSnapshot {
  return structure.map((p) => ({
    projectId: p.projectId,
    projectTitle: `Проект ${p.projectId}`,
    lessons: p.lessons.map((l) => ({
      lessonId: l.lessonId,
      lessonTitle: `Урок ${l.lessonId}`,
      stepIds: l.stepIds,
    })),
  }));
}

type Student = StudentState;

/** Момент как число миллисекунд (UTC): так хранит дату Def. */
const T = (iso: string): number =>
  Date.parse(iso.endsWith('Z') ? iso : `${iso}Z`);
const AT = T('2026-10-09T12:00:00.000Z');

function makeStudent(override: Partial<Student>): Student {
  return {
    uuid: 'student-1',
    streamId: 'stream-1',
    userId: 'user-1',
    status: 'active',
    enrolledAt: T('2026-09-01T10:00:00.000Z'),
    currentStepId: 'step-1',
    steps: [],
    createdAt: T('2026-09-01T10:00:00.000Z'),
    updatedAt: T('2026-09-01T10:00:00.000Z'),
    version: 0,
    ...override,
  };
}

describe('stream-snapshot-sync', () => {
  test('extractStepIds извлекает упорядоченный список шагов', () => {
    const snap = makeSnapshot([
      {
        projectId: 'p1',
        lessons: [
          { lessonId: 'l1', stepIds: ['s1', 's2'] },
          { lessonId: 'l2', stepIds: ['s3'] },
        ],
      },
    ]);
    expect(extractStepIds(snap)).toEqual(['s1', 's2', 's3']);
  });

  describe('analyzeSnapshotDelta', () => {
    test('без изменений — конфликтов нет', () => {
      const snap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's2'] }],
        },
      ]);
      const student = makeStudent({ currentStepId: 's2' });

      const res = analyzeSnapshotDelta(snap, snap, [student]);
      expect(res.addedStepIds).toEqual([]);
      expect(res.hasConflict).toBe(false);
      expect(res.aheadStudents).toEqual([]);
    });

    test('добавлен шаг в конец (хвост) после текущего студента — конфликта нет', () => {
      const oldSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's2'] }],
        },
      ]);
      const newSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's2', 's3-new'] }],
        },
      ]);
      const student = makeStudent({ currentStepId: 's2' });

      const res = analyzeSnapshotDelta(oldSnap, newSnap, [student]);
      expect(res.addedStepIds).toEqual(['s3-new']);
      expect(res.hasConflict).toBe(false);
      expect(res.aheadStudents).toEqual([]);
    });

    test('добавлен шаг позади текущего шага студента — фиксируется конфликт', () => {
      const oldSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's2'] }],
        },
        {
          projectId: 'p2',
          lessons: [{ lessonId: 'l2', stepIds: ['s3', 's4'] }],
        },
      ]);
      // Добавляем шаг s1_5 между s1 и s2
      const newSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's1_5-new', 's2'] }],
        },
        {
          projectId: 'p2',
          lessons: [{ lessonId: 'l2', stepIds: ['s3', 's4'] }],
        },
      ]);

      const studentBefore = makeStudent({
        uuid: 'stud-before',
        currentStepId: 's1',
      });
      const studentAhead = makeStudent({
        uuid: 'stud-ahead',
        currentStepId: 's3',
      });

      const res = analyzeSnapshotDelta(oldSnap, newSnap, [
        studentBefore,
        studentAhead,
      ]);
      expect(res.addedStepIds).toEqual(['s1_5-new']);
      expect(res.hasConflict).toBe(true);
      expect(res.aheadStudents.length).toBe(1);
      expect(res.aheadStudents[0]?.studentUuid).toBe('stud-ahead');
      expect(res.aheadStudents[0]?.newStepId).toBe('s1_5-new');
    });

    test('студент со статусом abandoned игнорируется при проверке конфликтов', () => {
      const oldSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's2'] }],
        },
      ]);
      const newSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s0-new', 's1', 's2'] }],
        },
      ]);
      const abandonedStudent = makeStudent({
        uuid: 'stud-dropped',
        status: 'abandoned',
        currentStepId: 's2',
      });

      const res = analyzeSnapshotDelta(oldSnap, newSnap, [abandonedStudent]);
      expect(res.hasConflict).toBe(false);
      expect(res.aheadStudents).toEqual([]);
    });

    test('студент со статусом advanced (завершил поток) считается опережающим', () => {
      const oldSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's2'] }],
        },
      ]);
      const newSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's1_5-new', 's2'] }],
        },
      ]);
      const graduatedStudent = makeStudent({
        uuid: 'stud-graduated',
        status: 'advanced',
        currentStepId: 's2',
      });

      const res = analyzeSnapshotDelta(oldSnap, newSnap, [graduatedStudent]);
      expect(res.hasConflict).toBe(true);
      expect(res.aheadStudents.length).toBe(1);
      expect(res.aheadStudents[0]?.studentUuid).toBe('stud-graduated');
    });
  });

  describe('syncAheadStudents', () => {
    test('добавляет новые шаги в steps только опережающим студентам', () => {
      const newSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's2-new', 's3'] }],
        },
      ]);

      const studBehind = makeStudent({
        uuid: 'stud-behind',
        currentStepId: 's1',
        steps: [
          { stepId: 's1', status: 'issued', issuedAt: T('2026-09-01T10:00') },
        ],
      });

      const studAhead = makeStudent({
        uuid: 'stud-ahead',
        currentStepId: 's3',
        steps: [
          {
            stepId: 's1',
            status: 'completed',
            issuedAt: T('2026-09-01T10:00'),
            completedAt: T('2026-09-01T11:00'),
          },
          { stepId: 's3', status: 'issued', issuedAt: T('2026-09-01T11:00') },
        ],
      });

      const students = [studBehind, studAhead];
      const result = syncAheadStudents(newSnap, students, ['s2-new'], AT);

      expect(result.updatedCount).toBe(1);
      expect(result.updatedStudentUuids).toEqual(['stud-ahead']);

      // studBehind не изменился
      expect(studBehind.steps.some((s) => s.stepId === 's2-new')).toBe(false);

      // studAhead получил step s2-new как completed
      const addedRecord = studAhead.steps.find((s) => s.stepId === 's2-new');
      expect(addedRecord).toBeDefined();
      expect(addedRecord?.status).toBe('completed');
      expect(addedRecord?.issuedAt).toBe(AT);
      expect(addedRecord?.completedAt).toBe(AT);
    });

    test('повторный вызов идемпотентен (не дублирует шаги)', () => {
      const newSnap = makeSnapshot([
        {
          projectId: 'p1',
          lessons: [{ lessonId: 'l1', stepIds: ['s1', 's2-new', 's3'] }],
        },
      ]);

      const studAhead = makeStudent({
        uuid: 'stud-ahead',
        currentStepId: 's3',
        steps: [
          {
            stepId: 's1',
            status: 'completed',
            issuedAt: T('2026-09-01T10:00'),
            completedAt: T('2026-09-01T11:00'),
          },
          { stepId: 's3', status: 'issued', issuedAt: T('2026-09-01T11:00') },
        ],
      });

      const students = [studAhead];
      syncAheadStudents(newSnap, students, ['s2-new']);
      expect(studAhead.steps.length).toBe(3);

      // Второй вызов
      const secondRun = syncAheadStudents(newSnap, students, ['s2-new']);
      expect(secondRun.updatedCount).toBe(0);
      expect(studAhead.steps.length).toBe(3);
    });
  });
});

describe('запись студентов после синхронизации (формат Def)', () => {
  const STEP_1 = testUuid(1, 'a0000000');
  const STEP_2 = testUuid(2, 'a0000000');
  const NEW_STEP = testUuid(3, 'a0000000');
  const STREAM = testUuid(4, 'a0000000');
  let tmp: TempDir;
  let dir: string;

  beforeAll(async () => {
    tmp = TempDir.create('u7-snapshot-sync-');
    dir = tmp.path;
  });

  afterAll(async () => {
    tmp.dispose();
  });

  const snapshot = makeSnapshot([
    {
      projectId: 'p1',
      lessons: [{ lessonId: 'l1', stepIds: [STEP_1, NEW_STEP, STEP_2] }],
    },
  ]);

  test('legacy-запись (ISO-даты, без version) и запись нового формата: после записи version и числовые даты сохранены, репозиторий читает файл', async () => {
    const file = join(dir, 'students.json');
    const legacy = {
      uuid: testUuid(5, 'a0000000'),
      streamId: STREAM,
      userId: testUuid(6, 'a0000000'),
      status: 'active',
      enrolledAt: '2026-09-01T10:00',
      currentStepId: STEP_2,
      steps: [
        {
          stepId: STEP_1,
          status: 'completed',
          issuedAt: '2026-09-01T10:00',
          completedAt: '2026-09-01T11:00',
        },
        { stepId: STEP_2, status: 'issued', issuedAt: '2026-09-01T11:00' },
      ],
      createdAt: '2026-09-01T10:00',
    };
    const modern = {
      ...legacy,
      uuid: testUuid(7, 'a0000000'),
      userId: testUuid(8, 'a0000000'),
      enrolledAt: T('2026-09-01T10:00'),
      createdAt: T('2026-09-01T10:00'),
      updatedAt: T('2026-09-02T10:00'),
      version: 3,
      steps: [
        {
          stepId: STEP_1,
          status: 'completed',
          issuedAt: T('2026-09-01T10:00'),
          completedAt: T('2026-09-01T11:00'),
        },
        { stepId: STEP_2, status: 'issued', issuedAt: T('2026-09-01T11:00') },
      ],
    };

    const rows = parseStudentRows([legacy, modern]);
    const res = syncAheadStudents(snapshot, rows, [NEW_STEP], AT);
    expect(res.updatedCount).toBe(2);
    await writeStudentRows(file, rows);

    const written = (await Bun.file(file).json()) as StudentState[];
    const [legacyOut, modernOut] = written;
    expect(legacyOut?.version).toBe(0);
    expect(modernOut?.version).toBe(3);
    for (const row of written) {
      for (const key of ['enrolledAt', 'createdAt', 'updatedAt'] as const) {
        expect(typeof row[key]).toBe('number');
      }
      for (const step of row.steps) {
        expect(typeof step.issuedAt).toBe('number');
      }
    }
    expect(legacyOut?.createdAt).toBe(T('2026-09-01T10:00'));
    expect(modernOut?.updatedAt).toBe(T('2026-09-02T10:00'));
    const added = modernOut?.steps.find((st) => st.stepId === NEW_STEP);
    expect(added).toEqual({
      stepId: NEW_STEP,
      status: 'completed',
      issuedAt: AT,
      completedAt: AT,
    });

    const repo = new StudentJsonRepo(file);
    const restored = await repo.findById(testUuid(7, 'a0000000'));
    expect(restored?.snapshot().version).toBe(3);
    expect(restored?.snapshot().steps.length).toBe(3);
    expect(await repo.findByStream(STREAM)).toHaveLength(2);
  });

  test('битая запись — ошибка разбора до записи', () => {
    expect(() => parseStudentRows([{ uuid: 'x' }])).toThrow(v.ValiError);
  });

  test('битый students.json — отказ чтения, streams.json не изменён; нет файла — пустой список', async () => {
    const streamsFile = join(dir, 'streams.json');
    const studentsFile = join(dir, 'broken-students.json');
    await Bun.write(streamsFile, '[{"uuid":"s"}]');
    await Bun.write(studentsFile, JSON.stringify([{ uuid: 'x' }]));

    await expect(readStudentRows(studentsFile)).rejects.toBeInstanceOf(
      v.ValiError,
    );
    expect(await Bun.file(streamsFile).text()).toBe('[{"uuid":"s"}]');
    expect(await readStudentRows(join(dir, 'absent.json'))).toEqual([]);
  });
});
