/** Имена по таблицам naming.md §1 и §4. */

/** Виды артефактов с суффиксом файла и классом. */
export type NamedKind = 'ar' | 'uc' | 'er' | 'job' | 'dcs' | 'dqs';

const SUFFIX: Record<NamedKind, string> = {
  ar: 'Ar',
  uc: 'Uc',
  er: 'Er',
  job: 'Job',
  dcs: 'Dcs',
  dqs: 'Dqs',
};

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function isKebab(value: string): boolean {
  return KEBAB.test(value);
}

/** `complete-student` → `CompleteStudent`. */
export function toPascal(kebab: string): string {
  return kebab
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export interface KindNames {
  /** `CompleteStudentUc` */
  className: string;
  /** `CompleteStudentUcDef` */
  defName: string;
  /** `complete-student.uc.ts` */
  fileName: string;
}

export function kindNames(kind: NamedKind, kebab: string): KindNames {
  const className = `${toPascal(kebab)}${SUFFIX[kind]}`;
  return {
    className,
    defName: `${className}Def`,
    fileName: `${kebab}.${kind}.ts`,
  };
}

/** `stream-student` → `streamStudent`. */
export function toCamel(kebab: string): string {
  const pascal = toPascal(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/** `stream-student` → `STREAM_STUDENT`. */
export function toUpperSnake(kebab: string): string {
  return kebab.toUpperCase().replaceAll('-', '_');
}
