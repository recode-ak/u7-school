import { beforeEach, describe, expect, it } from 'bun:test';
import {
  GetStreamMembersUcDef,
  type StreamModuleDef,
} from '@u7-scl/domain/stream/contract';
import { SystemCaller } from 'dmg-core';
import {
  type AppContext,
  ModuleFacade,
  ModuleFacades,
  Trace,
} from 'dmg-core/app';
import { expectOk, testAppContext } from 'dmg-core/testing';
import { createStreamModule, type StreamLegacy } from '../../stream.module';

// Адаптер TR-11: ответ legacy getMembers передаётся как есть; «нет потока» — ok(undefined).

const STREAM = '11111111-1111-4111-8111-111111111111';
const MENTOR = '66666666-6666-4666-8666-666666666666';
const USER = '22222222-2222-4222-8222-222222222222';
const REQ = Trace.fromRequest({ requestId: 'r-1' });
const asSystem = () =>
  new SystemCaller({ kind: 'useCase', module: 'probe', name: 'probe' });

let app: AppContext;
beforeEach(() => {
  app = testAppContext().app;
});

function stream(members: Awaited<ReturnType<StreamLegacy['getMembers']>>) {
  const asked: string[] = [];
  const legacy = {
    getStream: async () => undefined,
    getMembers: async (id: string) => {
      asked.push(id);
      return members;
    },
  } satisfies StreamLegacy;
  const facade = new ModuleFacade(
    createStreamModule({ app, facades: new ModuleFacades(), legacy }),
  );
  return { facade, asked };
}

const ask = (facade: ModuleFacade<typeof StreamModuleDef>) =>
  facade.handle(GetStreamMembersUcDef, { streamId: STREAM }, asSystem(), REQ);

describe('getStreamMembers: адаптер над getMembers (TR-11)', () => {
  it('поток есть — состав как есть', async () => {
    const members = {
      mentorId: MENTOR,
      students: [
        { userId: USER, status: 'abandoned' as const, neverStarted: true },
      ],
    };
    const { facade, asked } = stream(members);
    expect(expectOk(await ask(facade))).toEqual(members);
    expect(asked).toEqual([STREAM]);
  });

  it('потока нет — ok(undefined), без ошибки', async () => {
    expect(expectOk(await ask(stream(undefined).facade))).toBeUndefined();
  });

  it('модуль обслуживает свой UC', () => {
    expect(stream(undefined).facade.serves(GetStreamMembersUcDef)).toBe(true);
  });
});
