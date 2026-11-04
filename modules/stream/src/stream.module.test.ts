import { describe, expect, it } from 'bun:test';
import { GetStreamPresenceUcDef } from '@u7-scl/domain/stream/contract';
import { SystemCaller } from 'dmg-core';
import { ModuleFacade, ModuleFacades, Trace } from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { StreamRepoFake } from './stream/stream.repo.fake';
import { SCHOOL, STREAM, state } from './stream/uc/stream-uc.fixture';
import { createStreamModule } from './stream.module';
import { StudentRepoFake } from './student/student.repo.fake';

// Вход через фасад модуля: поток из репозитория, ответ — по Def.

const REQ = Trace.fromRequest({ requestId: 'r-1' });
const asSystem = () =>
  new SystemCaller({ kind: 'useCase', module: 'probe', name: 'probe' });

function facade(streams: StreamRepoFake) {
  return new ModuleFacade(
    createStreamModule({
      app: testAppContext().app,
      facades: new ModuleFacades(),
      streams,
      students: new StudentRepoFake(),
      schoolId: SCHOOL,
    }),
  );
}

const ask = (f: ReturnType<typeof facade>) =>
  f.handle(GetStreamPresenceUcDef, { streamId: STREAM }, asSystem(), REQ);

describe('getStreamPresence через фасад модуля', () => {
  it('поток есть — exists: true', async () => {
    const streams = new StreamRepoFake().seed(state('active'));

    expect(expectOk(await ask(facade(streams)))).toEqual({ exists: true });
  });

  it('потока нет — exists: false, без ошибки', async () => {
    expect(expectOk(await ask(facade(new StreamRepoFake())))).toEqual({
      exists: false,
    });
  });
});
