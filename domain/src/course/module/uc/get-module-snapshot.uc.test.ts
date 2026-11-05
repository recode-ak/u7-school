import { describe, expect, it } from 'bun:test';
import { normalize } from 'dmg-core/graph';
import * as v from 'valibot';
import {
  type ContentSnapshot,
  ContentSnapshotVo,
  CourseModuleDef,
  GetModuleSnapshotUcDef,
} from '../../contract';

// Переезд `course/uc/get-module-snapshot.uc.test.ts` (6): Def перенесён в
// агрегат `module` (снимок — вопрос про модуль), вызывающие расширены до
// `user`, `guest`, `system` (Т1, Т3). Ошибка единая — `ModuleErrors.NOT_FOUND`
// (`MODULE_NOT_FOUND`, Т8 Ф3); прежняя `COURSE_MODULE_NOT_FOUND` удалена.

const MODULE = '0b6f2c1e-8a4d-4f3b-9c2e-1d5a7b9e3f10';
const snapshot: ContentSnapshot = [
  {
    projectId: '11111111-1111-4111-8111-111111111111',
    projectTitle: 'Введение',
    lessons: [
      {
        lessonId: '22222222-2222-4222-8222-222222222222',
        lessonTitle: 'Урок 1',
        stepIds: ['33333333-3333-4333-8333-333333333333'],
      },
    ],
  },
];

describe('GetModuleSnapshotUcDef', () => {
  it('query над агрегатом module для user, guest и system, allowAll, ошибка — модуль не найден', () => {
    expect(normalize(GetModuleSnapshotUcDef)).toMatchObject({
      name: 'getModuleSnapshot',
      type: 'query',
      aggregate: 'module',
      callers: ['user', 'guest', 'system'],
      errors: ['MODULE_NOT_FOUND'],
    });
    expect(GetModuleSnapshotUcDef.policy.op).toBe('allowAll');
  });

  it('ошибка MODULE_NOT_FOUND — not_found', () => {
    const [error] = GetModuleSnapshotUcDef.errors;
    expect(error?.code).toBe('MODULE_NOT_FOUND');
    expect(error?.kind).toBe('not_found');
  });

  it('вход — uuid модуля', () => {
    const { input } = GetModuleSnapshotUcDef;
    expect(v.parse(input, { moduleId: MODULE })).toEqual({ moduleId: MODULE });
    expect(v.safeParse(input, { moduleId: 'x' }).success).toBe(false);
    expect(v.safeParse(input, {}).success).toBe(false);
  });

  it('выход — снимок контента (ContentSnapshotVo), в т. ч. пустой', () => {
    const { output } = GetModuleSnapshotUcDef;
    expect(v.parse(output, snapshot)).toEqual(snapshot);
    expect(v.parse(output, [])).toEqual([]);
    expect(
      v.safeParse(output, [{ ...snapshot[0], projectTitle: '' }]).success,
    ).toBe(false);
  });

  it('ContentSnapshotVo: у поля и вложенных полей есть описание (MAN-02)', () => {
    expect(v.getDescription(ContentSnapshotVo)).toBeString();
    const item = ContentSnapshotVo.item;
    for (const field of Object.values(item.entries)) {
      expect(v.getDescription(field)).toBeString();
    }
  });

  it('входит в паспорт CourseModuleDef', () => {
    expect(normalize(CourseModuleDef).useCases).toContain('getModuleSnapshot');
  });
});
