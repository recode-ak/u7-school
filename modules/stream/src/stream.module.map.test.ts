import { describe, expect, it } from 'bun:test';
import {
  ActivateStreamUcDef,
  ArchiveStreamUcDef,
  CompleteStreamUcDef,
  CreateStreamUcDef,
  FindStreamByTelegramGroupUcDef,
  GetStreamMembersUcDef,
  GetStreamPresenceUcDef,
  GetStreamUcDef,
  ListStreamsUcDef,
} from '@u7-scl/domain/stream/contract';
import { ModuleFacade, ModuleFacades } from 'dmg-core/app';
import { testAppContext } from 'dmg-core/testing';
import { StreamRepoFake } from './stream/stream.repo.fake';
import { StudentsFake } from './stream/uc/stream-uc.fixture';
import { createStreamModule, streamMap } from './stream.module';

// Модуль потоков на DMG — `StreamDeps` вместо `StreamLegacy`, карта
// «Def → класс» из 9 UC (API-05); ArchChecker/checkDefs — в `bun run check`.

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
];

describe('createStreamModule', () => {
  it('карта содержит девять UC потока, ER и Job нет', () => {
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
      ].sort(),
    );
    expect(streamMap.reactions).toEqual({});
    expect(streamMap.jobs).toEqual({});
  });

  it('фасад обслуживает все девять UC', () => {
    const { app } = testAppContext();
    const facade = new ModuleFacade(
      createStreamModule({
        app,
        facades: new ModuleFacades(),
        streams: new StreamRepoFake(),
        students: new StudentsFake(),
        schoolId: 'a0000000-0000-4000-8000-000000000001',
      }),
    );

    for (const def of defs) expect(facade.serves(def)).toBe(true);
  });
});
