import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import { StudentEvents } from '../student.events';
import { InactivitySweepJobDef } from './inactivity-sweep.job';

// Def Job (MAN-04/05/13): ежедневно в 19:00 UTC, сканирует агрегат студента,
// публикует два события бездействия. Имя `inactivitySweep`.

describe('InactivitySweepJobDef', () => {
  it('имя и расписание: ежедневно 19:00 UTC', () => {
    expect(InactivitySweepJobDef.name).toBe('inactivitySweep');
    expect(InactivitySweepJobDef.schedule).toEqual({
      kind: 'dailyAt',
      hour: 19,
      minute: 0,
    });
  });

  it('сканирует агрегат student', () => {
    expect(InactivitySweepJobDef.scans.map((a) => a.name)).toEqual(['student']);
  });

  it('публикует только inactivityWarning и inactivityRemoveCandidate', () => {
    expect(InactivitySweepJobDef.emits.map((e) => e.name).sort()).toEqual(
      [
        StudentEvents.inactivityWarning.name,
        StudentEvents.inactivityRemoveCandidate.name,
      ].sort(),
    );
  });

  it('JobDef входит в паспорт модуля stream (проверяется в stream.module.student.test.ts)', async () => {
    const { StreamModuleDef } = await import('../../stream.module');
    expect(normalize(StreamModuleDef).jobs).toEqual(['inactivitySweep']);
  });
});
