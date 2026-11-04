import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { QuestionnaireEvents } from '../questionnaire.events';
import {
  ABANDON_AFTER_HOURS,
  ABANDON_AFTER_IDLE_MS,
  INTERVAL_MS,
  INVITE_AFTER_HOURS,
  INVITE_AFTER_IDLE_MS,
  SweepAbandonedQuestionnairesJobDef,
  WARN_AFTER_HOURS,
  WARN_AFTER_IDLE_MS,
} from './sweep-abandoned-questionnaires.job';

// Def Job (MAN-04/05/13): интервал 3 ч, сканирует агрегат анкеты, три события.
// Перенос констант и расписания из `sweep-abandoned-job*.test.ts`.

const HOUR = 60 * 60 * 1000;

describe('SweepAbandonedQuestionnairesJobDef', () => {
  it('имя, метка, расписание — интервал раз в 3 часа', () => {
    expect(SweepAbandonedQuestionnairesJobDef.name).toBe(
      'sweepAbandonedQuestionnaires',
    );
    expect(SweepAbandonedQuestionnairesJobDef.label).toBe(
      'Продолжение, предупреждение и закрытие брошенных анкет',
    );
    expect(SweepAbandonedQuestionnairesJobDef.schedule).toEqual({
      kind: 'interval',
      intervalMs: 3 * HOUR,
    });
  });

  it('константы ступеней 3/6/9 ч и мс (API-06)', () => {
    expect([INVITE_AFTER_HOURS, WARN_AFTER_HOURS, ABANDON_AFTER_HOURS]).toEqual(
      [3, 6, 9],
    );
    expect(INVITE_AFTER_IDLE_MS).toBe(3 * HOUR);
    expect(WARN_AFTER_IDLE_MS).toBe(6 * HOUR);
    expect(ABANDON_AFTER_IDLE_MS).toBe(9 * HOUR);
    expect(INTERVAL_MS).toBe(3 * HOUR);
  });

  it('сканирует агрегат questionnaire и публикует continueInvite, abandonWarning, abandoned', () => {
    expect(SweepAbandonedQuestionnairesJobDef.scans.map((a) => a.name)).toEqual(
      ['questionnaire'],
    );
    expect(
      SweepAbandonedQuestionnairesJobDef.emits.map((e) => e.name).sort(),
    ).toEqual(
      [
        QuestionnaireEvents.continueInvite.name,
        QuestionnaireEvents.abandonWarning.name,
        QuestionnaireEvents.abandoned.name,
      ].sort(),
    );
  });

  it('входит в паспорт модуля', () => {
    // сверка в questionnaire.module.test.ts
    expect(normalize(SweepAbandonedQuestionnairesJobDef).name).toBe(
      'sweepAbandonedQuestionnaires',
    );
  });
});
