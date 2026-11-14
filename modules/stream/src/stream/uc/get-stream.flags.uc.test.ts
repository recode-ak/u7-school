import { beforeEach, describe, expect, it } from 'bun:test';
import { StreamAr } from '@u7-scl/domain/stream';
import { StreamModuleDef } from '@u7-scl/domain/stream/contract';
import { expectOk } from 'dmg-core/testing';
import { GetStreamUc } from './get-stream.uc';
import {
  makeEnv,
  mentor,
  otherMentor,
  REQ,
  STREAM,
  state,
  student,
} from './stream-uc.fixture';

// F-43 (D-72): UI решает по признакам готового ответа, не по `status` из view.
// canActivate/canComplete/canArchive = право управления И переход допустим по
// Def; isEnrolling — «поток в наборе» (не зависит от права управления).

let env: ReturnType<typeof makeEnv>;
const uc = () => new GetStreamUc(env.deps, StreamModuleDef);
beforeEach(() => {
  env = makeEnv();
});

describe('GetStreamUc — признаки для UI', () => {
  it('управляющий: признаки совпадают с вопросами Ar', async () => {
    env.streams.seed(state('enrollment'));

    const view = expectOk(await uc().handle({ streamId: STREAM }, mentor, REQ));

    const ar = StreamAr.restore(state('enrollment'));
    expect(view).toMatchObject({
      canManage: true,
      canActivate: ar.canActivate(),
      canComplete: ar.canComplete(),
      canArchive: ar.canArchive(),
      isEnrolling: ar.isEnrolling(),
    });
  });

  it('неуправляющий (чужой ментор): canActivate/canComplete/canArchive false', async () => {
    env.streams.seed(state('active'));

    const view = expectOk(
      await uc().handle({ streamId: STREAM }, otherMentor, REQ),
    );

    expect(view).toMatchObject({
      canManage: false,
      canActivate: false,
      canComplete: false,
      canArchive: false,
    });
  });

  it('студент, поток в наборе: isEnrolling true без права управления', async () => {
    env.streams.seed(state('enrollment'));

    const view = expectOk(
      await uc().handle({ streamId: STREAM }, student, REQ),
    );

    expect(view).toMatchObject({
      canManage: false,
      canActivate: false,
      isEnrolling: true,
    });
  });
});
