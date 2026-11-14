import {
  QuestionnaireAr,
  QuestionnaireArDef,
  type QuestionnaireState,
} from '@u7-scl/domain/questionnaire';
import { MemoryRepo } from 'dmg-core/testing';
import type {
  QuestionnaireFilter,
  QuestionnaireIdle,
  QuestionnaireRepo,
} from './questionnaire.repo';

/**
 * Фейк порта `QuestionnaireRepo` для тестов UC и Job: запись — память базы,
 * `findById` — по uuid из памяти, выборки — ответ, который задаёт тест
 * присваиванием поля.
 */
export class QuestionnaireRepoFake
  extends MemoryRepo<QuestionnaireAr, QuestionnaireState>
  implements QuestionnaireRepo
{
  constructor() {
    super(QuestionnaireArDef, QuestionnaireAr.restore);
  }

  findById = async (uuid: string) => this.restored(uuid);
  findByRespondent = this.unanswered<
    [userId: string, filter?: QuestionnaireFilter],
    QuestionnaireAr[]
  >('findByRespondent');
  findIdle = this.unanswered<[params: QuestionnaireIdle], QuestionnaireAr[]>(
    'findIdle',
  );
}
