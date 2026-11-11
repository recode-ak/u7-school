import { describe, expect, it } from 'bun:test';
import { CourseAr } from './course/course.ar';
import {
  M1,
  M2,
  M3,
  M4,
  OUTSIDE,
  phase,
  stored,
} from './course/course.fixture';
import type { CourseState } from './course/course.state';
import { ModuleAr } from './module/module.ar';
import { stored as storedModule } from './module/module.fixture';
import { ModulePrerequisiteDqs } from './module-prerequisite.dqs';

// Вердикт допуска к модулю (D-65, Р6): перенос четырёх сценариев
// `canEnrollNextModule` (policy.test.ts: входной; предыдущий пройден; не пройден;
// пройден другой). «Модуль не найден в курсе» и «пустой курс» недостижимы
// через UC (нет курса → допущен) и не переносятся. Курс — первый в порядке
// файла из всех, включающих модуль, в любом статусе (поведение v0.2.6, Т18).

const COURSE_A = '55555555-5555-4555-8555-555555555551';
const COURSE_B = '55555555-5555-4555-8555-555555555552';

const course = (
  moduleIds: string[],
  phases: CourseState['phases'] = [],
  extra: Partial<CourseState> = {},
) => CourseAr.restore(stored('published', { moduleIds, phases, ...extra }));

const moduleOf = (uuid: string, title = `Модуль ${uuid.slice(0, 2)}`) =>
  ModuleAr.restore(storedModule('published', { uuid, title }));

const ALL = [M1, M2, M3, M4].map((id) => moduleOf(id));

const verdict = (
  courses: CourseAr[],
  moduleId: string,
  passed: string[] = [],
  modules: ModuleAr[] = ALL,
) => new ModulePrerequisiteDqs(courses, modules, passed).verdict(moduleId);

describe('ModulePrerequisiteDqs.verdict — допущен', () => {
  it('курса с этим модулем нет — допущен', () => {
    expect(verdict([], M2)).toEqual({ admitted: true });
    expect(verdict([course([M1, M2])], OUTSIDE)).toEqual({ admitted: true });
  });

  it('входной модуль — допущен без пройденных модулей', () => {
    expect(verdict([course([M1, M2])], M1, [])).toEqual({ admitted: true });
  });

  it('предыдущий модуль пройден — допущен', () => {
    expect(verdict([course([M1, M2])], M2, [M1])).toEqual({ admitted: true });
  });

  it('предыдущий пройден, прочие пройденные модули не мешают', () => {
    expect(verdict([course([M1, M2, M3])], M3, [M1, OUTSIDE, M2])).toEqual({
      admitted: true,
    });
  });

  it('предыдущий ищется через границу этапов', () => {
    const staged = course([M1, M2, M3], [phase('А', M1), phase('Б', M3)]);
    expect(verdict([staged], M3, [M2])).toEqual({ admitted: true });
  });

  it('курс без этапов обрабатывается по линейному порядку', () => {
    expect(verdict([course([M1, M2, M3])], M2, [M1])).toEqual({
      admitted: true,
    });
  });

  it('пройден сам модуль, а не предыдущий — отказ', () => {
    expect(verdict([course([M1, M2])], M2, [M2])).toMatchObject({
      admitted: false,
    });
  });
});

describe('ModulePrerequisiteDqs.verdict — previous-not-passed', () => {
  it.each<{ title: string; modules: ModuleAr[]; expectedTitle: string }>([
    {
      title: 'название модуля по его uuid',
      modules: ALL,
      expectedTitle: 'Модуль 11',
    },
    {
      title: 'название берётся у записи именно предыдущего модуля',
      modules: [moduleOf(M1, 'Синтаксис'), moduleOf(M2, 'Алгоритмика')],
      expectedTitle: 'Синтаксис',
    },
  ])('предыдущий не пройден — $title', ({ modules, expectedTitle }) => {
    expect(verdict([course([M1, M2])], M2, [], modules)).toEqual({
      admitted: false,
      reason: 'previous-not-passed',
      title: expectedTitle,
    });
  });

  it('пройден другой модуль, но не предыдущий — отказ', () => {
    expect(verdict([course([M1, M2, M3])], M3, [M1])).toEqual({
      admitted: false,
      reason: 'previous-not-passed',
      title: 'Модуль 22',
    });
  });

  it('предыдущий через границу этапов не пройден — отказ', () => {
    const staged = course([M1, M2, M3], [phase('А', M1), phase('Б', M3)]);
    expect(verdict([staged], M3, [M1])).toMatchObject({
      admitted: false,
      reason: 'previous-not-passed',
      title: 'Модуль 22',
    });
  });
});

describe('ModulePrerequisiteDqs.verdict — closed (Т6)', () => {
  it('записи предыдущего модуля нет среди модулей — closed, без названия', () => {
    const verdictOut = verdict([course([M1, M2])], M2, [], [moduleOf(M2)]);
    expect(verdictOut).toEqual({ admitted: false, reason: 'closed' });
  });

  it('предыдущий пройден — запись модуля не нужна, допущен', () => {
    expect(verdict([course([M1, M2])], M2, [M1], [])).toEqual({
      admitted: true,
    });
  });

  it('входной модуль — запись модуля не нужна, допущен', () => {
    expect(verdict([course([M1, M2])], M1, [], [])).toEqual({ admitted: true });
  });
});

describe('ModulePrerequisiteDqs.verdict — выбор курса (Т18)', () => {
  it('первый в порядке файла из курсов, включающих модуль', () => {
    // В первом курсе M2 — второй (нужен M1), во втором — входной.
    const first = course([M1, M2], [], { uuid: COURSE_A });
    const second = course([M2], [], { uuid: COURSE_B });
    expect(verdict([first, second], M2, [])).toMatchObject({
      admitted: false,
      reason: 'previous-not-passed',
    });
    expect(verdict([second, first], M2, [])).toEqual({ admitted: true });
  });

  it('статус курса не важен: архивный первый в файле решает', () => {
    const archived = CourseAr.restore(
      stored('archived', { uuid: COURSE_A, moduleIds: [M1, M2], phases: [] }),
    );
    const published = course([M2], [], { uuid: COURSE_B });
    expect(verdict([archived, published], M2, [])).toMatchObject({
      admitted: false,
      reason: 'previous-not-passed',
    });
  });

  it('курсы без модуля пропускаются', () => {
    const unrelated = course([M3, M4], [], { uuid: COURSE_A });
    const related = course([M1, M2], [], { uuid: COURSE_B });
    expect(verdict([unrelated, related], M2, [M1])).toEqual({ admitted: true });
  });
});
