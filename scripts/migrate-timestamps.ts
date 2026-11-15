/**
 * migrate-timestamps — переводит даты в файлах `DB_DIR` (по умолчанию `data`)
 * из ISO-строк в Timestamp; по умолчанию сухой прогон, `--write` — запись и
 * контрольное чтение. Перед живыми данными — остановить бота и `bun run backup`.
 * @see conductor/tracks/timestamp-data_20261115/slices/f4-migrate-timestamps.md
 */
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { DATA_FILES, DataDirAudit, JOB_RUNS_FILE } from '@u7-scl/app';

/** Ввод-вывод скрипта: подменяется в тестах. */
export interface MigrateIo {
  log(line: string): void;
  error(line: string): void;
}

const consoleIo: MigrateIo = {
  log: (line) => console.log(line),
  error: (line) => console.error(line),
};

/** Поле даты: путь в нотации `steps[].completedAt`; `local` — время UTC+5 без зоны. */
type DateField = { readonly path: string; readonly zone?: 'local' };

type FileSpec =
  | {
      readonly file: string;
      readonly kind: 'records';
      readonly fields: readonly DateField[];
    }
  | { readonly file: string; readonly kind: 'last-runs' };

const BASE: readonly DateField[] = [
  { path: 'createdAt' },
  { path: 'updatedAt' },
];

/** Поля дат сверх `BASE` по агрегатам; домен не импортируется (ARC-04). */
const EXTRA_FIELDS: Readonly<
  Record<keyof typeof DATA_FILES, readonly DateField[]>
> = {
  user: [],
  course: [],
  module: [],
  lesson: [],
  step: [],
  wish: [],
  questionnaire: [
    { path: 'warnedAt' },
    { path: 'continueInvitedAt' },
    { path: 'completedAt' },
    { path: 'answers[].answeredAt' },
  ],
  'review-campaign': [{ path: 'expiresAt' }],
  review: [],
  stream: [{ path: 'startDate', zone: 'local' }],
  student: [
    { path: 'enrolledAt' },
    { path: 'steps[].issuedAt' },
    { path: 'steps[].completedAt' },
    { path: 'notices[].sentAt' },
  ],
};

/** Карта «файл в `DB_DIR` → поля дат»: пути — из `DATA_FILES` приложения. */
const FILES: readonly FileSpec[] = [
  ...Object.entries(EXTRA_FIELDS).map(
    ([aggregate, extra]): FileSpec => ({
      file: DATA_FILES[aggregate as keyof typeof DATA_FILES],
      kind: 'records',
      fields: [...BASE, ...extra],
    }),
  ),
  { file: JOB_RUNS_FILE, kind: 'last-runs' },
];

/** Смещение местной зоны проекта (UTC+5), мс. */
const LOCAL_OFFSET_MS = 5 * 3_600_000;

export type InvalidValue = {
  readonly index?: number;
  readonly uuid?: string;
  readonly path: string;
  readonly value: unknown;
};

export type FileReport = {
  readonly file: string;
  readonly missing: boolean;
  readonly converted: number;
  readonly alreadyNumber: number;
  readonly invalid: readonly InvalidValue[];
};

/** Итог по `startDate` потоков: без зоны трактуются как UTC+5. */
export type StartDateReport = {
  readonly withoutZone: number;
  readonly withZone: number;
  readonly numeric: number;
  readonly withoutZoneIds: readonly string[];
};

export type MigrationReport = {
  readonly files: readonly FileReport[];
  readonly totals: {
    readonly converted: number;
    readonly alreadyNumber: number;
    readonly invalid: number;
  };
  readonly startDates: StartDateReport;
  /** Записанные файлы (относительно `DB_DIR`). */
  readonly written: readonly string[];
};

/** Прежний `isoDateTime`: минуты без секунд и без зоны — UTC. */
const ISO_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
/** Прежний `isoTimestamp`: секунды, дробь до 9 знаков, обязательная зона. */
const ISO_TIMESTAMP =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})$/;

/** Разобранная ISO-строка: момент и признак явной зоны. */
type ParsedIso = { readonly at: number; readonly zoned: boolean };

/**
 * ISO-дата-время в паритете с прежним `F.timestamp` (dmg-core v0.3.1). Строже
 * прежнего: несуществующая дата — `undefined` (раньше Date.parse сдвигал или NaN).
 */
function parseIso(value: string): ParsedIso | undefined {
  const m = ISO_DATE_TIME.exec(value) ?? ISO_TIMESTAMP.exec(value);
  if (!m) return undefined;
  const [year = 0, month = 0, day = 0, hour = 0, minute = 0, second = 0] = m
    .slice(1, 7)
    .map((x) => Number(x ?? '0'));
  if (hour > 23 || minute > 59 || second > 59) return undefined;
  const ms = Number((m[7] ?? '').padEnd(3, '0').slice(0, 3));
  const at = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  const back = new Date(at);
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day
  ) {
    return undefined;
  }
  const zone = m[8];
  if (zone === undefined) return { at, zoned: false };
  if (zone === 'Z') return { at, zoned: true };
  const digits = zone.slice(1).replace(':', '');
  const offH = Number(digits.slice(0, 2));
  const offM = Number(digits.slice(2));
  if (offH > 23 || offM > 59) return undefined;
  const sign = zone.startsWith('-') ? -1 : 1;
  return { at: at - sign * (offH * 60 + offM) * 60_000, zoned: true };
}

/** Путь к значению в дереве JSON: ключи объектов и индексы массивов. */
type JsonPath = readonly (string | number)[];
const pathKey = (path: JsonPath) => JSON.stringify(path);

/**
 * Позиции строковых значений в тексте JSON: ключ — `pathKey` пути, значение —
 * `[начало, конец)` литералов с кавычками (несколько — при дубле ключа).
 */
class JsonStringSpans {
  readonly spans = new Map<string, (readonly [number, number])[]>();
  #i = 0;

  constructor(private readonly text: string) {
    this.#value([]);
    this.#ws();
    if (this.#i !== text.length) this.#fail();
  }

  #fail(): never {
    throw new Error(`разбор JSON: неожиданный символ на позиции ${this.#i}`);
  }

  #ws() {
    while (/\s/.test(this.text[this.#i] ?? '')) this.#i++;
  }

  #value(path: JsonPath): void {
    this.#ws();
    const c = this.text[this.#i];
    if (c === '{') {
      this.#object(path);
      return;
    }
    if (c === '[') {
      this.#array(path);
      return;
    }
    if (c === '"') {
      const start = this.#i;
      this.#string();
      const key = pathKey(path);
      this.spans.set(key, [...(this.spans.get(key) ?? []), [start, this.#i]]);
      return;
    }
    const m = /^(-?\d+(\.\d+)?([eE][+-]?\d+)?|true|false|null)/.exec(
      this.text.slice(this.#i, this.#i + 40),
    );
    if (!m) this.#fail();
    this.#i += m[0].length;
  }

  #string(): string {
    const start = this.#i++;
    while (this.#i < this.text.length) {
      const c = this.text[this.#i];
      if (c === '\\') this.#i += 2;
      else if (c === '"') {
        this.#i++;
        return JSON.parse(this.text.slice(start, this.#i)) as string;
      } else this.#i++;
    }
    this.#fail();
  }

  #expect(c: string) {
    this.#ws();
    if (this.text[this.#i] !== c) this.#fail();
    this.#i++;
  }

  #object(path: JsonPath) {
    this.#i++;
    this.#ws();
    if (this.text[this.#i] === '}') {
      this.#i++;
      return;
    }
    for (;;) {
      this.#ws();
      if (this.text[this.#i] !== '"') this.#fail();
      const key = this.#string();
      this.#expect(':');
      this.#value([...path, key]);
      this.#ws();
      const c = this.text[this.#i++];
      if (c === '}') return;
      if (c !== ',') this.#fail();
    }
  }

  #array(path: JsonPath) {
    this.#i++;
    this.#ws();
    if (this.text[this.#i] === ']') {
      this.#i++;
      return;
    }
    for (let index = 0; ; index++) {
      this.#value([...path, index]);
      this.#ws();
      const c = this.text[this.#i++];
      if (c === ']') return;
      if (c !== ',') this.#fail();
    }
  }
}

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec =>
  typeof x === 'object' && x !== null && !Array.isArray(x);

/** Найденное значение даты: путь в дереве и для отчёта. */
type Hit = {
  readonly path: JsonPath;
  readonly label: string;
  readonly value: unknown;
};

/** Значения поля `field` в записи (`null` и отсутствие пропускаются). */
function collect(record: Rec, base: JsonPath, field: string): Hit[] {
  const hits: Hit[] = [];
  const walk = (
    node: unknown,
    segs: readonly string[],
    path: JsonPath,
    label: string,
  ) => {
    const [seg, ...rest] = segs;
    if (seg === undefined || !isRec(node)) return;
    const many = seg.endsWith('[]');
    const key = many ? seg.slice(0, -2) : seg;
    if (!(key in node)) return;
    const value = node[key];
    const here = label ? `${label}.${key}` : key;
    if (many) {
      if (!Array.isArray(value)) return;
      value.forEach((item, i) => {
        walk(item, rest, [...path, key, i], `${here}[${i}]`);
      });
      return;
    }
    if (rest.length > 0) return walk(value, rest, [...path, key], here);
    if (value === null || value === undefined) return;
    hits.push({ path: [...path, key], label: here, value });
  };
  walk(record, field.split('.'), base, '');
  return hits;
}

/** План по файлу: отчёт и замены (путь → новое значение). */
type FilePlan = {
  readonly report: FileReport;
  readonly text?: string;
  readonly replacements: Map<
    string,
    { readonly path: JsonPath; readonly at: number }
  >;
};

class StartDateTally {
  withoutZone = 0;
  withZone = 0;
  numeric = 0;
  readonly withoutZoneIds: string[] = [];

  report(): StartDateReport {
    return {
      withoutZone: this.withoutZone,
      withZone: this.withZone,
      numeric: this.numeric,
      withoutZoneIds: [...this.withoutZoneIds],
    };
  }
}

function planFile(
  dbDir: string,
  spec: FileSpec,
  tally: StartDateTally,
): FilePlan {
  const path = join(dbDir, spec.file);
  const replacements: FilePlan['replacements'] = new Map();
  if (!existsSync(path)) {
    return {
      report: {
        file: spec.file,
        missing: true,
        converted: 0,
        alreadyNumber: 0,
        invalid: [],
      },
      replacements,
    };
  }
  const text = readFileSync(path, 'utf8');
  const tree = JSON.parse(text) as unknown;
  let converted = 0;
  let alreadyNumber = 0;
  const invalid: InvalidValue[] = [];

  const visit = (
    hit: Hit,
    field: DateField,
    where: { index?: number; uuid?: string },
  ) => {
    const local = field.zone === 'local';
    const bad = () =>
      invalid.push({ ...where, path: hit.label, value: hit.value });
    if (typeof hit.value === 'number') {
      if (local) {
        // Число в startDate неотличимо от «фальшивого UTC» — решение spec (ФР-7).
        tally.numeric++;
        return bad();
      }
      if (Number.isSafeInteger(hit.value)) alreadyNumber++;
      else bad();
      return;
    }
    const parsed =
      typeof hit.value === 'string' ? parseIso(hit.value) : undefined;
    if (!parsed) return bad();
    let at = parsed.at;
    if (local) {
      if (parsed.zoned) tally.withZone++;
      else {
        tally.withoutZone++;
        at -= LOCAL_OFFSET_MS;
        if (where.uuid !== undefined) tally.withoutZoneIds.push(where.uuid);
      }
    }
    converted++;
    replacements.set(pathKey(hit.path), { path: hit.path, at });
  };

  if (spec.kind === 'last-runs') {
    const lastRuns = isRec(tree) ? tree.lastRuns : undefined;
    if (!isRec(lastRuns)) throw new Error(`${spec.file}: нет объекта lastRuns`);
    for (const [job, value] of Object.entries(lastRuns)) {
      visit(
        { path: ['lastRuns', job], label: `lastRuns.${job}`, value },
        { path: job },
        {},
      );
    }
  } else {
    if (!Array.isArray(tree))
      throw new Error(`${spec.file}: ожидается массив записей`);
    tree.forEach((record: unknown, index) => {
      if (!isRec(record)) {
        invalid.push({ index, path: '(запись)', value: record });
        return;
      }
      const uuid = typeof record.uuid === 'string' ? record.uuid : undefined;
      const where = uuid === undefined ? { index } : { index, uuid };
      for (const field of spec.fields) {
        for (const hit of collect(record, [index], field.path))
          visit(hit, field, where);
      }
    });
  }

  return {
    report: {
      file: spec.file,
      missing: false,
      converted,
      alreadyNumber,
      invalid,
    },
    text,
    replacements,
  };
}

/** Новый текст файла: литералы дат заменены числами, остальное байт в байт. */
function rewrite(
  file: string,
  text: string,
  plan: FilePlan['replacements'],
): string {
  const spans = new JsonStringSpans(text).spans;
  // Дубль ключа: JSON.parse берёт последний, заменяются все литералы ключа.
  const edits = [...plan.entries()].flatMap(([key, { at }]) => {
    const found = spans.get(key);
    if (!found) throw new Error(`${file}: не найден литерал ${key}`);
    return found.map((span) => ({ span, at }));
  });
  edits.sort((a, b) => b.span[0] - a.span[0]);
  let out = text;
  for (const { span, at } of edits) {
    out = out.slice(0, span[0]) + String(at) + out.slice(span[1]);
  }
  // Самопроверка: новый текст = исходное дерево с заменёнными значениями.
  const expected = JSON.parse(text) as unknown;
  for (const { path, at } of plan.values()) setAt(expected, path, at);
  if (!Bun.deepEquals(JSON.parse(out), expected, true)) {
    throw new Error(`${file}: самопроверка побайтовой замены не прошла`);
  }
  return out;
}

function setAt(tree: unknown, path: JsonPath, value: number) {
  let node = tree as Record<string | number, unknown>;
  for (const seg of path.slice(0, -1))
    node = node[seg] as Record<string | number, unknown>;
  const last = path.at(-1);
  if (last !== undefined) node[last] = value;
}

/** Временный файл с режимом исходного, fsync, затем `rename` поверх исходного. */
function writeAtomic(path: string, text: string) {
  const mode = statSync(path).mode & 0o7777;
  const tmp = `${path}.migrate-${process.pid}.tmp`;
  try {
    const fd = openSync(tmp, 'w', mode);
    try {
      writeSync(fd, text);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    chmodSync(tmp, mode);
    renameSync(tmp, path);
  } catch (e) {
    rmSync(tmp, { force: true });
    throw e;
  }
}

/** Сбой записи после того, как часть файлов уже записана. */
export class PartialWriteError extends Error {
  constructor(
    readonly file: string,
    readonly written: readonly string[],
    cause: unknown,
  ) {
    super(`${file}: ${(cause as Error).message}`, { cause });
  }
}

/** Разбор всех файлов, затем (при `write` и без invalid) запись изменённых. */
export async function migrate(
  dbDir: string,
  options: { readonly write: boolean },
): Promise<MigrationReport> {
  const tally = new StartDateTally();
  const plans = FILES.map((spec) => planFile(dbDir, spec, tally));
  const files = plans.map((p) => p.report);
  const totals = {
    converted: sum(files, (f) => f.converted),
    alreadyNumber: sum(files, (f) => f.alreadyNumber),
    invalid: sum(files, (f) => f.invalid.length),
  };
  const outputs = plans.flatMap((p) =>
    p.text === undefined || p.replacements.size === 0
      ? []
      : [
          {
            file: p.report.file,
            text: rewrite(p.report.file, p.text, p.replacements),
          },
        ],
  );
  const written: string[] = [];
  if (options.write && totals.invalid === 0) {
    for (const { file, text } of outputs) {
      try {
        writeAtomic(join(dbDir, file), text);
      } catch (e) {
        throw new PartialWriteError(file, written, e);
      }
      written.push(file);
    }
  }
  return { files, totals, startDates: tally.report(), written };
}

const sum = <T>(xs: readonly T[], f: (x: T) => number) =>
  xs.reduce((a, x) => a + f(x), 0);

function printReport(report: MigrationReport, io: MigrateIo) {
  for (const f of report.files) {
    if (f.missing) {
      io.log(`${f.file}: нет файла`);
      continue;
    }
    io.log(
      `${f.file}: переведено ${f.converted}, уже число ${f.alreadyNumber}, не разобрано ${f.invalid.length}`,
    );
    for (const bad of f.invalid) {
      const at = [
        bad.index === undefined ? '' : `[${bad.index}]`,
        bad.uuid ?? '',
      ]
        .filter(Boolean)
        .join(' ');
      io.error(`  ${f.file} ${at} ${bad.path}: ${JSON.stringify(bad.value)}`);
    }
  }
  const s = report.startDates;
  io.log(
    `startDate потоков: без зоны ${s.withoutZone} (как UTC+5), с зоной ${s.withZone}, число ${s.numeric}`,
  );
  if (s.withoutZoneIds.length > 0)
    io.log(`  без зоны: ${s.withoutZoneIds.join(', ')}`);
  const t = report.totals;
  io.log(
    `Итого: переведено ${t.converted}, уже число ${t.alreadyNumber}, не разобрано ${t.invalid}`,
  );
}

/** Точка входа: код возврата 0 — успех, 1 — неразобранные значения или ошибка. */
export async function run(
  argv: readonly string[],
  dbDir: string,
  io: MigrateIo = consoleIo,
): Promise<number> {
  const unknown = argv.filter((a) => a !== '--write');
  if (unknown.length > 0) {
    io.error(
      `Неизвестные аргументы: ${unknown.join(' ')}. Допустим только --write.`,
    );
    return 1;
  }
  const write = argv.includes('--write');
  io.log(`Каталог: ${dbDir}. Режим: ${write ? 'запись' : 'сухой прогон'}.`);
  let report: MigrationReport;
  try {
    report = await migrate(dbDir, { write });
  } catch (e) {
    if (e instanceof PartialWriteError && e.written.length > 0) {
      io.error(`Сбой записи ${e.message}.`);
      io.error(
        `Уже записаны (восстановить из бэкапа): ${e.written.join(', ')}`,
      );
    } else {
      io.error(`Ошибка: ${(e as Error).message}. Ничего не записано.`);
    }
    return 1;
  }
  printReport(report, io);
  if (report.totals.invalid > 0) {
    io.error('Есть неразобранные значения — ничего не записано.');
    return 1;
  }
  if (!write) return 0;
  io.log(`Записано файлов: ${report.written.length}.`);
  const audit = await new DataDirAudit(dbDir).run();
  for (const issue of audit.issues) {
    const at =
      issue.index === undefined ? '' : ` [${issue.index}] ${issue.uuid ?? ''}`;
    io.error(`Контрольное чтение: ${issue.file}${at}: ${issue.message}`);
  }
  if (!audit.ok) return 1;
  io.log('Контрольное чтение: 0 ошибок.');
  return 0;
}

if (import.meta.main) {
  process.exit(await run(process.argv.slice(2), process.env.DB_DIR ?? 'data'));
}
