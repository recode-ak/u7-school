import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as contract from './contract';
import { StreamModuleDef } from './contract';

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
  'getStreamStep',
  'getStreamLessonSteps',
  'previewStreamContentSync',
  'syncStreamContent',
];

// Единственный тест состава модуля (TST-08): список UC и dependsOn ловят
// и новую операцию, и новую связь модулей.
describe('StreamModuleDef — состав', () => {
  it('21 UC, агрегаты, Job, реакции и зависимости', () => {
    const def = normalize(StreamModuleDef);
    expect([...def.useCases].sort()).toEqual(
      [...STREAM_UC, ...STUDENT_UC].sort(),
    );
    expect(def).toMatchObject({
      dependsOn: ['user', 'course'],
      aggregates: ['stream', 'student'],
      reactions: [],
      jobs: ['inactivitySweep'],
    });
  });

  it('контракт не экспортирует классы и DQS (D-45)', () => {
    for (const name of [
      'StudentAr',
      'StreamAr',
      'StudentProgressDqs',
      'StreamMembersDqs',
      'StreamLaunchDcs',
      'StepCompletionDcs',
      'StreamContentSyncDcs',
      'SnapshotDiffDqs',
    ]) {
      expect(name in contract).toBe(false);
    }
  });
});
