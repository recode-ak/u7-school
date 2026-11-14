import type { StreamMembersView } from '@u7-scl/domain/stream/contract';
import type { StudentOutcome } from '../shared/campaign-fields';

/** Состав потока (ответ `GetStreamMembersUcDef`, поток найден). */
export type FateMembers = NonNullable<StreamMembersView>;

/** Проекция судьбы студента: исход субъекта и адресуемые соученики. */
export type StudentFate = {
  readonly outcome: StudentOutcome;
  readonly participantIds: string[];
};

/**
 * DQS: проекция события судьбы студента и состава потока в данные кампании
 * (ФР-1, ФР-2). Только читает.
 */
export class StudentFateDqs {
  constructor(private readonly members: FateMembers) {}

  /**
   * «Завершил»: исход — из события (`advanced` → прошёл); адресаты —
   * завершившиеся и ещё учащиеся соученики, без субъекта и без ушедших.
   */
  forCompleted(event: {
    readonly userId: string;
    readonly outcome: 'advanced' | 'not_advanced';
  }): StudentFate {
    return {
      outcome:
        event.outcome === 'advanced'
          ? 'completed_passed'
          : 'completed_not_passed',
      participantIds: this.members.students
        .filter((s) => s.userId !== event.userId && s.status !== 'abandoned')
        .map((s) => s.userId),
    };
  }

  /**
   * «Ушёл»: исход — «не начинал» (`neverStarted`), иначе «забросил»
   * (субъекта нет в составе — тоже «забросил»); адресат только ментор.
   */
  forAbandoned(event: { readonly userId: string }): StudentFate {
    const subject = this.members.students.find(
      (s) => s.userId === event.userId,
    );
    return {
      outcome: subject?.neverStarted ? 'never_started' : 'dropped',
      participantIds: [],
    };
  }
}
