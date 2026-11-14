import {
  CompleteStudentUcDef,
  DropStudentUcDef,
  MarkAbandonedUcDef,
  StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { expectOk, testTrace } from 'dmg-core/testing';
import type { TestApp } from './test-app';

/**
 * Судьба студента потока через настоящие UC модуля `stream`: событие
 * `stream.student.*` публикует UoW модуля, а не публикация на legacy-шине
 * (legacy-шина отдаёт DMG-подписчикам только по карте `inbound`).
 * Вызывающий — ментор потока (или сам студент для `dropStudent`).
 */

export async function completeStudent(
  app: TestApp,
  args: {
    callerTelegramId: number;
    streamId: string;
    studentId: string;
    outcome: 'advanced' | 'not_advanced';
  },
): Promise<void> {
  const caller = await app.userByTelegramId(args.callerTelegramId);
  expectOk(
    await app.apiApp.dispatch(
      StreamModuleDef,
      CompleteStudentUcDef.command({
        streamId: args.streamId,
        studentId: args.studentId,
        outcome: args.outcome,
      }),
      caller,
      testTrace(),
    ),
  );
}

export async function dropStudent(
  app: TestApp,
  args: { studentTelegramId: number; streamId: string; studentId: string },
): Promise<void> {
  const caller = await app.userByTelegramId(args.studentTelegramId);
  expectOk(
    await app.apiApp.dispatch(
      StreamModuleDef,
      DropStudentUcDef.command({
        streamId: args.streamId,
        studentId: args.studentId,
      }),
      caller,
      testTrace(),
    ),
  );
}

export async function markAbandoned(
  app: TestApp,
  args: {
    callerTelegramId: number;
    streamId: string;
    studentId: string;
    cause: 'inactivity' | 'by_mentor';
  },
): Promise<void> {
  const caller = await app.userByTelegramId(args.callerTelegramId);
  expectOk(
    await app.apiApp.dispatch(
      StreamModuleDef,
      MarkAbandonedUcDef.command({
        streamId: args.streamId,
        studentId: args.studentId,
        cause: args.cause,
      }),
      caller,
      testTrace(),
    ),
  );
}

/**
 * Дополнение фикстуры стенда: студент потока «учится» и успел пройти шаг
 * (иначе уход классифицируется как `never_started`, а не «забросил»).
 * Правит временную копию `students.json` стенда, общий мир не меняется
 * (иначе Job бездействия подхватил бы студента во всех стендах).
 */
export async function makeStudentActive(
  app: TestApp,
  studentId: string,
): Promise<void> {
  const path = `${app.fixtures.dbDir}/streams/students.json`;
  const students = JSON.parse(await Bun.file(path).text()) as Array<
    Record<string, unknown>
  >;
  const student = students.find((s) => s.uuid === studentId);
  if (!student) throw new Error(`Нет студента фикстуры ${studentId}`);
  const stepId = 'd0d0d0d0-d0d0-d0d0-d0d0-d0d0d0d0d0d0';
  student.status = 'active';
  student.currentStepId = stepId;
  student.steps = [
    {
      stepId,
      status: 'completed',
      issuedAt: student.enrolledAt,
      completedAt: student.enrolledAt,
    },
  ];
  await Bun.write(path, JSON.stringify(students, null, 2));
}
