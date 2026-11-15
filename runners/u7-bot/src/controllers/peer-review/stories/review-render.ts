import type { LocalZone } from '@u7-scl/app';
import { type MdText, md } from '@u7-scl/core/shared';
import type {
  ReviewDirection,
  StudentOutcome,
} from '@u7-scl/domain/peer-review/contract';

/** Общий рендер отзыва для сторей чтения (S07 «Отзывы потока», S08 «Отзывы мне»). */

/** Роли «кто о ком» из направления отзыва. */
export function rolesOf(direction: ReviewDirection): {
  recipient: 'студент' | 'ментор';
  author: 'студент' | 'ментор';
} {
  switch (direction) {
    case 'student_mentor':
      return { recipient: 'ментор', author: 'студент' };
    case 'mentor_student':
      return { recipient: 'студент', author: 'ментор' };
    default:
      return { recipient: 'студент', author: 'студент' };
  }
}

/** Лейблы 4-значной проекции исходов (ui-spec S07). */
export const OUTCOME_LABELS: Record<StudentOutcome, string> = {
  completed_passed: 'завершил и прошел',
  completed_not_passed: 'завершил и не прошел',
  dropped: 'забросил',
  never_started: 'не начал',
};

/** Подпись автора: роль и (у автора-студента) лейбл исхода-снапшота. */
export function authorLabel(args: {
  direction: ReviewDirection;
  authorOutcome?: StudentOutcome;
}): string {
  const roles = rolesOf(args.direction);
  const outcome =
    roles.author === 'студент' && args.authorOutcome
      ? ` · ${OUTCOME_LABELS[args.authorOutcome]}`
      : '';
  return `${roles.author}${outcome}`;
}

/** Дата отзыва из метки времени (мс, UTC) в зоне школы — «21.09.2026». */
export function reviewDate(createdAt: number, zone: LocalZone): string {
  return zone.formatDate(createdAt);
}

/** Карточка одного отзыва для S08 «Отзывы мне». */
export function renderReviewCard(args: {
  authorName: string;
  direction: ReviewDirection;
  authorOutcome?: StudentOutcome;
  streamTitle: string;
  createdAt: number;
  text: string;
  zone: LocalZone;
}): MdText {
  return md`👤 От: ${args.authorName} \\(${authorLabel(args)}\\)
📚 Поток: ${args.streamTitle}
📅 Дата: ${reviewDate(args.createdAt, args.zone)}

💬 «${args.text}»`;
}

/** Карточка одного отзыва для SH03 «Отзывы по потокам школы». */
export function renderSchoolReviewCard(args: {
  mentorName: string;
  authorName: string;
  direction: ReviewDirection;
  authorOutcome?: StudentOutcome;
  streamTitle: string;
  createdAt: number;
  text: string;
  zone: LocalZone;
}): MdText {
  return md`👨‍🏫 Ментор: ${args.mentorName}
👤 От: ${args.authorName} \\(${authorLabel(args)}\\)
📚 Поток: ${args.streamTitle}
📅 Дата: ${reviewDate(args.createdAt, args.zone)}

💬 «${args.text}»`;
}
