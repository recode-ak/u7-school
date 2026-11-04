import { describe, expect, it } from 'bun:test';
import {
  ActivateStreamUcDef,
  ArchiveStreamUcDef,
  CompleteStepUcDef,
  CompleteStreamUcDef,
  CompleteStudentUcDef,
  CreateStreamUcDef,
  DropStudentUcDef,
  EnrollStudentUcDef,
  FindStreamByTelegramGroupUcDef,
  GetActiveStudentUcDef,
  GetStreamMembersUcDef,
  GetStreamPresenceUcDef,
  GetStreamUcDef,
  GetStudentByUserUcDef,
  GetStudentProgressUcDef,
  ListStreamsUcDef,
  MarkAbandonedUcDef,
} from '@u7-scl/domain/stream/contract';
import { ModuleFacade, ModuleFacades } from 'dmg-core/app';
import { testAppContext } from 'dmg-core/testing';
import { StreamRepoFake } from './stream/stream.repo.fake';
import { createStreamModule, streamMap } from './stream.module';
import { StudentRepoFake } from './student/student.repo.fake';

// Модуль потоков на DMG — `StreamDeps` вместо `StreamLegacy`, карта
// «Def → класс» из 17 UC (API-05); ArchChecker/checkDefs — в `bun run check`.

const defs = [
  CreateStreamUcDef,
  ActivateStreamUcDef,
  CompleteStreamUcDef,
  ArchiveStreamUcDef,
  GetStreamUcDef,
  ListStreamsUcDef,
  GetStreamMembersUcDef,
  GetStreamPresenceUcDef,
  FindStreamByTelegramGroupUcDef,
  EnrollStudentUcDef,
  CompleteStepUcDef,
  CompleteStudentUcDef,
  DropStudentUcDef,
  MarkAbandonedUcDef,
  GetStudentByUserUcDef,
  GetStudentProgressUcDef,
  GetActiveStudentUcDef,
];

describe('createStreamModule', () => {
  it('карта содержит 17 UC (поток и студент) и Job бездействия, ER нет', () => {
    expect(Object.keys(streamMap.useCases).sort()).toEqual(
      [
        'createStream',
        'activateStream',
        'completeStream',
        'archiveStream',
        'getStream',
        'listStreams',
        'getStreamMembers',
        'getStreamPresence',
        'findStreamByTelegramGroup',
        'enrollStudent',
        'completeStep',
        'completeStudent',
        'dropStudent',
        'markAbandoned',
        'getStudentByUser',
        'getStudentProgress',
        'getActiveStudent',
      ].sort(),
    );
    expect(streamMap.reactions).toEqual({});
    expect(Object.keys(streamMap.jobs)).toEqual(['inactivitySweep']);
  });

  it('фасад обслуживает все 17 UC', () => {
    const { app } = testAppContext();
    const facade = new ModuleFacade(
      createStreamModule({
        app,
        facades: new ModuleFacades(),
        streams: new StreamRepoFake(),
        students: new StudentRepoFake(),
        schoolId: 'a0000000-0000-4000-8000-000000000001',
      }),
    );

    for (const def of defs) expect(facade.serves(def)).toBe(true);
  });
});
