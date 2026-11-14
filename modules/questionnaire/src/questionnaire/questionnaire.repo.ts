import type {
  QuestionnaireAr,
  QuestionnaireState,
} from '@u7-scl/domain/questionnaire';
import type { Timestamp } from 'dmg-core';
import type { Repository } from 'dmg-core/app';

/** Вид анкеты, который отбирает обход. */
export type QuestionnaireKind = QuestionnaireState['kind'];

/** Условия отбора брошенных анкет: порог простоя на момент `at`. */
export type QuestionnaireIdle = {
  readonly idleMs: number;
  readonly at: Timestamp;
  readonly kinds?: readonly QuestionnaireKind[];
};

/** Необязательные условия выборки анкет респондента; заданные объединяются по «и». */
export type QuestionnaireFilter = {
  readonly status?: QuestionnaireState['status'];
  readonly kind?: QuestionnaireKind;
  /** `ownerInfo.courseId` — известный ключ владельца; прочее модуль не толкует. */
  readonly courseId?: string;
};

/** Порт репозитория анкет: принимает и возвращает Ar (API-03). */
export type QuestionnaireRepo = Repository<QuestionnaireAr> & {
  /** Анкета по UUID. */
  findById(uuid: string): Promise<QuestionnaireAr | undefined>;

  /** Анкеты респондента по фильтру в порядке файла. */
  findByRespondent(
    userId: string,
    filter?: QuestionnaireFilter,
  ): Promise<QuestionnaireAr[]>;

  /** Незавершённые анкеты (приглашённые и заполняемые) с простоем не меньше порога. */
  findIdle(params: QuestionnaireIdle): Promise<QuestionnaireAr[]>;
};
