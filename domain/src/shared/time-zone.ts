import * as v from 'valibot';

/** Регистр — как в базе IANA; псевдонимы не сводятся; неизвестное — как есть. */
const canonical = (name: string): string => {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: name,
    }).resolvedOptions().timeZone;
  } catch {
    return name;
  }
};

/** Зону принимает `Intl` — набор зон берётся из движка, без своей таблицы. */
const isKnownZone = (name: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: name });
    return true;
  } catch {
    return false;
  }
};

/**
 * Часовая зона — имя IANA (`Asia/Oral`, `Europe/Berlin`, `UTC`); регистр —
 * как в базе IANA (`asia/oral` → `Asia/Oral`), псевдонимы не сводятся.
 * Первая буква латинская: строка смещения (`+05:00`) — не имя. Проверка
 * `Intl` — после `transform`: JSON Schema (input) обрывается на нём, `check`
 * в неё не переводится (MAN-03).
 */
export const TimeZoneVo = v.pipe(
  v.string(),
  v.description('Часовая зона (имя IANA)'),
  v.regex(/^[A-Za-z]/),
  v.transform(canonical),
  v.check(isKnownZone),
);

export type TimeZoneVo = v.InferOutput<typeof TimeZoneVo>;
