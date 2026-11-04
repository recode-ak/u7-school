import { describe, expect, it } from 'bun:test';
import { ArchChecker } from 'dmg-core/arch';
import { normalize } from 'dmg-core/graph';
import * as contract from './contract';
import { StreamModuleDef } from './contract';

// Паспорт модуля после среза `student`: внешний статус снят
// (иначе нельзя объявить Job, MAN-06), 17 UC, 1 Job. Заменяет
// ожидания `stream.module.def.test.ts` (external, 9 UC, jobs: []).

const STUDENT_UC = [
  'enrollStudent',
  'completeStep',
  'completeStudent',
  'dropStudent',
  'markAbandoned',
  'getStudentByUser',
  'getStudentProgress',
  'getActiveStudent',
];
const STREAM_UC = [
  'createStream',
  'activateStream',
  'completeStream',
  'archiveStream',
  'getStream',
  'listStreams',
  'getStreamMembers',
  'getStreamPresence',
  'findStreamByTelegramGroup',
];

describe('StreamModuleDef — после среза student', () => {
  it('модуль не внешний', () => {
    expect(StreamModuleDef.external).toBeFalsy();
  });

  it('паспорт: dependsOn user и course, агрегаты stream и student, один Job', () => {
    expect(normalize(StreamModuleDef)).toMatchObject({
      dependsOn: ['user', 'course'],
      aggregates: ['stream', 'student'],
      reactions: [],
      jobs: ['inactivitySweep'],
    });
  });

  it('17 UC: девять потока и восемь студента', () => {
    expect([...normalize(StreamModuleDef).useCases].sort()).toEqual(
      [...STREAM_UC, ...STUDENT_UC].sort(),
    );
  });

  it('ArchChecker по модулю и зависимостям — без нарушений', () => {
    expect(ArchChecker.defsOf([StreamModuleDef]).report()).toEqual([]);
  });

  it('контракт экспортирует Def восьми UC студента, ошибки, события и вид', () => {
    for (const name of [
      'EnrollStudentUcDef',
      'CompleteStepUcDef',
      'CompleteStudentUcDef',
      'DropStudentUcDef',
      'MarkAbandonedUcDef',
      'GetStudentByUserUcDef',
      'GetStudentProgressUcDef',
      'GetActiveStudentUcDef',
      'StudentErrors',
      'StudentEvents',
    ]) {
      expect(name in contract).toBe(true);
    }
  });

  it('контракт не экспортирует классы и DQS (D-45)', () => {
    for (const name of [
      'StudentAr',
      'StreamAr',
      'StudentProgressDqs',
      'StreamMembersDqs',
      'StreamLaunchDcs',
      'StepCompletionDcs',
    ]) {
      expect(name in contract).toBe(false);
    }
  });
});
