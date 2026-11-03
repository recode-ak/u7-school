import { beforeEach, describe, expect, it } from 'bun:test';
import {
  GetStreamPresenceUcDef,
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
import { createStreamModule, type StreamLegacy } from './stream.module';

// Адаптер над legacy-фасадом: ответ legacy-фасада потоков передаётся как есть.

const STREAM = '11111111-1111-4111-8111-111111111111';
const REQ = Trace.fromRequest({ requestId: 'r-1' });
const asSystem = () =>
  new SystemCaller({ kind: 'useCase', module: 'probe', name: 'probe' });

let app: AppContext;
beforeEach(() => {
  app = testAppContext().app;
});

/** Модуль потоков над legacy; запоминает спрошенные потоки. */
function stream(found: boolean) {
  const asked: string[] = [];
  const legacy = {
    getStream: async (id: string) => {
      asked.push(id);
      return found ? ({ uuid: id } as never) : undefined;
    },
    getMembers: async () => undefined,
  } satisfies StreamLegacy;
  const facade = new ModuleFacade(
    createStreamModule({ app, facades: new ModuleFacades(), legacy }),
  );
  return { facade, asked };
}

const ask = (facade: ModuleFacade<typeof StreamModuleDef>) =>
  facade.handle(GetStreamPresenceUcDef, { streamId: STREAM }, asSystem(), REQ);

describe('getStreamPresence: адаптер над getStream', () => {
  it('поток есть — exists: true', async () => {
    const { facade, asked } = stream(true);
    expect(expectOk(await ask(facade))).toEqual({ exists: true });
    expect(asked).toEqual([STREAM]);
  });

  it('потока нет — exists: false, без ошибки', async () => {
    const { facade } = stream(false);
    expect(expectOk(await ask(facade))).toEqual({ exists: false });
  });

  it('модуль обслуживает свой UC', () => {
    expect(stream(true).facade.serves(GetStreamPresenceUcDef)).toBe(true);
  });
});
