import { describe, expect, it } from 'bun:test';
import { SweepAbandonedQuestionnairesJobDef } from './sweep-abandoned-questionnaires.job';

// Def Job (MAN-04/05/13): интервал 3 ч — та же ступень, что приглашение продолжить.

const HOUR = 60 * 60 * 1000;

describe('SweepAbandonedQuestionnairesJobDef', () => {
  it('имя и расписание — интервал раз в 3 часа', () => {
    expect(SweepAbandonedQuestionnairesJobDef.name).toBe(
      'sweepAbandonedQuestionnaires',
    );
    expect(SweepAbandonedQuestionnairesJobDef.schedule).toEqual({
      kind: 'interval',
      intervalMs: 3 * HOUR,
    });
  });
});
