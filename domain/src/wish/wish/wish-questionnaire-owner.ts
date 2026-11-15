import * as v from 'valibot';
import type { WishTargetVo } from './wish.state';

/**
 * Формат `ownerInfo` анкеты желания: события анкеты возвращают его как есть.
 * `courseId` — непустая строка.
 */
const OwnerInfo = v.object({
  courseId: v.pipe(v.string(), v.minLength(1)),
});

/**
 * Владелец анкеты желания (`ownerInfo`): оба направления в одном месте —
 * цель → owner при запуске анкеты и owner → цель в реакциях на её события.
 */
export class WishQuestionnaireOwner {
  private constructor(readonly courseId: string) {}

  /** Владелец анкеты желания на курс. */
  static forCourse(courseId: string): WishQuestionnaireOwner {
    return new WishQuestionnaireOwner(courseId);
  }

  /**
   * Владелец из `ownerInfo` события анкеты. Чужой или битый `ownerInfo`
   * (анкета не `wish`) — `undefined`, реакции такое событие игнорируют.
   */
  static parse(ownerInfo: unknown): WishQuestionnaireOwner | undefined {
    const parsed = v.safeParse(OwnerInfo, ownerInfo);
    return parsed.success
      ? new WishQuestionnaireOwner(parsed.output.courseId)
      : undefined;
  }

  /** `ownerInfo` для запуска анкеты — простой объект на проводе. */
  info(): { readonly courseId: string } {
    return { courseId: this.courseId };
  }

  /** Цель желания, к которому относится анкета. */
  target(): WishTargetVo {
    return { kind: 'course', courseId: this.courseId };
  }
}
