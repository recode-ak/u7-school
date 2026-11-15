import { JobDef } from 'dmg-core';
import { StudentArDef } from '../student.ar';
import { StudentEvents } from '../student.events';

/**
 * Ежедневный обход бездействующих студентов, 19:00 UTC (00:00 Казахстана;
 * расписание Job — в UTC, D-90).
 * Кому и когда уведомлять, решает `StudentAr.noticeInactivity` (пороги 5/7
 * дней, повтор каждые 2 дня); Job отбирает учащихся и публикует события.
 */
export const InactivitySweepJobDef = JobDef.define({
  name: 'inactivitySweep',
  label: 'Мониторинг бездействующих студентов',
  description:
    'Раз в сутки находит студентов без активности и публикует уведомления: студенту с 5-го дня, ментору с 7-го.',
  schedule: { kind: 'dailyAt', hour: 19, minute: 0 },
  scans: [StudentArDef],
  emits: [
    StudentEvents.inactivityWarning,
    StudentEvents.inactivityRemoveCandidate,
  ],
});
