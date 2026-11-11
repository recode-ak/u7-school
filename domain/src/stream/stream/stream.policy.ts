import type { UserAr } from '@u7-scl/domain/user/contract';
import { PolicyDef, type ReadonlyAr, Rule } from 'dmg-core';
import type { StreamAr } from './stream.ar';

/** Субъект прав потока: вопросы ролей — у `UserAr` (D-69). */
type StreamSubject = Pick<ReadonlyAr<UserAr>, 'uuid' | 'isMentor' | 'isAdmin'>;

/** Контекст прав на поток: поток, над которым действие. */
export type StreamCtx = { readonly stream: ReadonlyAr<StreamAr> };

const canCreate = Rule.of({
  name: 'canCreate',
  label: 'Ментор',
  denyMessage: 'Недостаточно прав для создания потока',
  check: (subject: StreamSubject) => subject.isMentor(),
});

const isStreamMentor = Rule.of({
  name: 'isStreamMentor',
  label: 'Ментор потока',
  denyMessage: 'Недостаточно прав для управления потоком',
  check: (subject: StreamSubject, ctx: StreamCtx) =>
    ctx.stream.isMentoredBy(subject.uuid),
});

const isAdmin = Rule.of({
  name: 'isAdmin',
  label: 'Администратор',
  denyMessage: 'Недостаточно прав для управления потоком',
  check: (subject: StreamSubject) => subject.isAdmin(),
});

/**
 * Права на потоки. Создаёт поток роль `MENTOR` (администратор без неё —
 * нет, как в legacy); управляет ментор потока или администратор. Чтение
 * открыто всем — `allowAll` в Def UC.
 */
export const StreamPolicy = PolicyDef.define({
  name: 'stream',
  label: 'Права на потоки',
  description:
    'Кто создаёт поток — ментор; кто управляет потоком — его ментор или администратор.',
  rules: {
    canCreate,
    canManage: Rule.anyOf(
      {
        name: 'canManage',
        label: 'Ментор потока или администратор',
        denyMessage: 'Недостаточно прав для управления потоком',
      },
      isStreamMentor,
      isAdmin,
    ),
  },
});
