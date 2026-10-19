/** Правила `rules.md`, которые проверяет `arch:check`. */
export type ArchRule =
  | 'ARC-04'
  | 'ARC-05'
  | 'ARC-06'
  | 'ERR-04'
  | 'MAN-01'
  | 'MAN-02'
  | 'MAN-03'
  | 'MAN-06'
  | 'MAN-08'
  | 'MAN-10';

export type Violation = { readonly rule: ArchRule; readonly message: string };

/** Строка отчёта: начинается с ID правила. */
export function formatViolation(v: Violation): string {
  return `${v.rule}: ${v.message}`;
}
