import { describe, expect, it } from 'bun:test';
import * as v from 'valibot';
import { StepArDef } from './step.ar';
import { FILE_ID, MODULE, STEP, T0 } from './step.fixture';

// Перенос `entity.test.ts` (StepSchema, 10) на state по Def (D-36): даты —
// числа (UTC), legacy-запись с ISO читается; variant по `kind`. `FileVo` —
// локальная копия `FileMetadataSchema` (Т10).

const base = {
  uuid: STEP,
  moduleId: MODULE,
  description: 'Описание шага',
  status: 'draft',
  createdAt: '2026-07-08T18:35',
};

const validFile = {
  uuid: FILE_ID,
  name: 'файл.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  description: 'Описание файла',
};

// Фолбэк `updatedAt = createdAt` и `version = 0` — только в `StepArDef.state` (D-36).
const parse = (value: unknown) => v.safeParse(StepArDef.state, value);

describe('StepState — legacy-запись (D-36)', () => {
  it('ISO без секунд (UTC) → число, updatedAt = createdAt, version = 0', () => {
    const res = parse({ ...base, kind: 'text' });
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({
      createdAt: T0,
      updatedAt: T0,
      version: 0,
    });
  });

  it('legacy updatedAt (ISO без секунд) сохраняется числом', () => {
    const res = parse({ ...base, kind: 'text', updatedAt: '2026-07-09T08:30' });
    expect(res.output).toMatchObject({
      updatedAt: Date.UTC(2026, 6, 9, 8, 30),
    });
  });

  it('запись нового формата (числа, version) проходит как есть', () => {
    const res = parse({
      ...base,
      kind: 'code',
      code: 'x',
      createdAt: T0,
      updatedAt: T0 + 1,
      version: 4,
    });
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({
      createdAt: T0,
      updatedAt: T0 + 1,
      version: 4,
    });
  });

  it.each(['text', 'code', 'file'] as const)(
    'ISO читается и у шага kind=%s',
    (kind) => {
      const extra =
        kind === 'code'
          ? { code: 'x' }
          : kind === 'file'
            ? { file: validFile }
            : {};
      const res = parse({ ...base, kind, ...extra });
      expect(res.success).toBe(true);
      expect(res.output).toMatchObject({ kind, createdAt: T0, version: 0 });
    },
  );
});

describe('StepState — виды шага (перенос entity.test.ts)', () => {
  it('принимает text-шаг', () => {
    expect(parse({ ...base, kind: 'text' }).success).toBe(true);
  });

  it('принимает text-шаг без опциональных content, updatedAt', () => {
    const res = parse({ ...base, kind: 'text' });
    expect(res.success).toBe(true);
    expect(res.output).not.toHaveProperty('content');
  });

  it('принимает text-шаг с content', () => {
    const res = parse({ ...base, kind: 'text', content: 'Текст' });
    expect(res.output).toMatchObject({ content: 'Текст' });
  });

  it('принимает code-шаг', () => {
    const res = parse({ ...base, kind: 'code', code: 'console.log(1)' });
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({ kind: 'code', code: 'console.log(1)' });
  });

  it('принимает code-шаг без language', () => {
    expect(parse({ ...base, kind: 'code', code: 'x' }).success).toBe(true);
  });

  it('принимает code-шаг без content (так в данных у 44 шагов)', () => {
    const res = parse({ ...base, kind: 'code', code: 'x', language: 'js' });
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({ language: 'js' });
  });

  it('принимает file-шаг', () => {
    const res = parse({ ...base, kind: 'file', file: validFile });
    expect(res.success).toBe(true);
    expect(res.output).toMatchObject({ kind: 'file', file: validFile });
  });

  it('принимает file-шаг без description файла', () => {
    const { description: _d, ...fm } = validFile;
    expect(parse({ ...base, kind: 'file', file: fm }).success).toBe(true);
  });

  it('принимает file-шаг с файлом нулевого размера', () => {
    const file = { ...validFile, size: 0 };
    expect(parse({ ...base, kind: 'file', file }).success).toBe(true);
  });

  it('отклоняет code-шаг без code', () => {
    expect(parse({ ...base, kind: 'code' }).success).toBe(false);
  });

  it('отклоняет code-шаг с пустым code', () => {
    expect(parse({ ...base, kind: 'code', code: '' }).success).toBe(false);
  });

  it('отклоняет file-шаг без file', () => {
    expect(parse({ ...base, kind: 'file' }).success).toBe(false);
  });

  it('отклоняет file-шаг с отрицательным размером файла', () => {
    const file = { ...validFile, size: -1 };
    expect(parse({ ...base, kind: 'file', file }).success).toBe(false);
  });

  it('отклоняет file-шаг с файлом без имени или с пустым MIME', () => {
    const noName = { ...validFile, name: '  ' };
    const noMime = { ...validFile, mimeType: '' };
    expect(parse({ ...base, kind: 'file', file: noName }).success).toBe(false);
    expect(parse({ ...base, kind: 'file', file: noMime }).success).toBe(false);
  });

  it('отклоняет file-шаг с некорректным uuid файла', () => {
    const file = { ...validFile, uuid: 'bad' };
    expect(parse({ ...base, kind: 'file', file }).success).toBe(false);
  });

  it('отклоняет невалидный kind', () => {
    expect(parse({ ...base, kind: 'video' }).success).toBe(false);
  });

  it('отклоняет запись без kind', () => {
    expect(parse(base).success).toBe(false);
  });
});

describe('StepState — общие поля', () => {
  it('отклоняет пустое описание', () => {
    expect(parse({ ...base, kind: 'text', description: '' }).success).toBe(
      false,
    );
  });

  it('отклоняет описание из пробелов (обрезка краёв)', () => {
    expect(parse({ ...base, kind: 'text', description: '   ' }).success).toBe(
      false,
    );
  });

  it('описание обрезается по краям', () => {
    const res = parse({ ...base, kind: 'text', description: ' Шаг ' });
    expect(res.output).toMatchObject({ description: 'Шаг' });
  });

  it('отклоняет некорректный uuid шага', () => {
    expect(parse({ ...base, kind: 'text', uuid: 'bad' }).success).toBe(false);
  });

  it('отклоняет некорректный moduleId', () => {
    expect(parse({ ...base, kind: 'text', moduleId: 'bad' }).success).toBe(
      false,
    );
  });

  it.each(['draft', 'published', 'archived'])(
    'статус %s допустим',
    (status) => {
      expect(parse({ ...base, kind: 'text', status }).success).toBe(true);
    },
  );

  it('отклоняет неизвестный статус', () => {
    expect(parse({ ...base, kind: 'text', status: 'nonsense' }).success).toBe(
      false,
    );
  });
});
