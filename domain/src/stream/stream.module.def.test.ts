import { describe, expect, it } from 'bun:test';
import { ArchChecker } from 'dmg-core/arch';
import { normalize } from 'dmg-core/graph';
import * as contract from './contract';
import { StreamModuleDef } from './contract';

// Модуль потоков содержит 9 UC; `external` остаётся до перевода студента.

describe('StreamModuleDef — 9 UC потока', () => {
  it('паспорт: внешний (Т4), зависит от user и course, агрегаты stream и student', () => {
    expect(StreamModuleDef.external).toBe(true);
    expect(normalize(StreamModuleDef)).toMatchObject({
      dependsOn: ['user', 'course'],
      aggregates: ['stream', 'student'],
      reactions: [],
      jobs: [],
    });
  });

  it('девять UC потока', () => {
    expect([...normalize(StreamModuleDef).useCases].sort()).toEqual(
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
  });

  it('ArchChecker по модулю и зависимостям — без нарушений', () => {
    expect(ArchChecker.defsOf([StreamModuleDef]).report()).toEqual([]);
  });

  it('контракт экспортирует Def всех 9 UC, ошибки и события потока', () => {
    for (const name of [
      'CreateStreamUcDef',
      'ActivateStreamUcDef',
      'CompleteStreamUcDef',
      'ArchiveStreamUcDef',
      'GetStreamUcDef',
      'ListStreamsUcDef',
      'GetStreamMembersUcDef',
      'GetStreamPresenceUcDef',
      'FindStreamByTelegramGroupUcDef',
      'StreamErrors',
      'StreamEvents',
    ]) {
      expect(name in contract).toBe(true);
    }
  });
});
