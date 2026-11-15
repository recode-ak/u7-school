import { TimeZoneVo } from '@u7-scl/domain/shared';
import type { Timestamp } from 'dmg-core';
import * as v from 'valibot';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/** Местные часы на момент: все поля — строки с ведущими нулями. */
interface LocalParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Часовая зона IANA: ввод и показ времени людям. Смещение считается
 * на каждый момент через `Intl` — летнее время учитывается.
 * @see ./local-zone.test.ts
 */
export class LocalZone {
  /** Один форматтер на зону: создание `Intl.DateTimeFormat` дорогое. */
  private readonly parts: Intl.DateTimeFormat;

  private constructor(
    /** Имя зоны IANA (`Asia/Oral`). */
    readonly name: string,
  ) {
    this.parts = new Intl.DateTimeFormat('en-US', {
      timeZone: name,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /** Зона по имени IANA; неизвестное имя — ошибка конфигурации, бросает. */
  static of(name: string): LocalZone {
    const parsed = v.safeParse(TimeZoneVo, name);
    if (!parsed.success) {
      throw new Error(`Неизвестная часовая зона: «${name}»`);
    }
    return new LocalZone(parsed.output);
  }

  /**
   * Местное `YYYY-MM-DD` (полночь) или `YYYY-MM-DDTHH:mm` → метка UTC.
   * Невалидный ввод и несуществующее местное время — `undefined`;
   * неоднозначное (перевод часов назад) — ранний момент, как `compatible`
   * в Temporal.
   */
  parseLocal(text: string): Timestamp | undefined {
    const m = LOCAL_RE.exec(text);
    if (!m) return undefined;
    const [, y, mo, d, h = '00', mi = '00'] = m;
    const localAsUtc = Date.UTC(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(mi),
    );
    const expected = `${y}-${mo}-${d}T${h}:${mi}`;
    // Смещения за сутки до и после покрывают переход часов рядом с вводом.
    // Обратное форматирование отсекает переполнение (31.02, 25:00) и время,
    // выпавшее при скачке вперёд.
    const candidates = [
      this.offsetMinutes(localAsUtc - DAY_MS),
      this.offsetMinutes(localAsUtc + DAY_MS),
    ]
      .map((offset) => localAsUtc - offset * MINUTE_MS)
      .filter((at) => this.formatInput(at) === expected);
    return candidates.length ? Math.min(...candidates) : undefined;
  }

  /** `дд.мм.гггг` — без подписи зоны. */
  formatDate(at: Timestamp): string {
    const p = this.local(at);
    return `${p.day}.${p.month}.${p.year}`;
  }

  /** `чч:мм (UTC+5)` — время с подписью зоны. */
  formatTime(at: Timestamp): string {
    const p = this.local(at);
    return `${p.hour}:${p.minute} (${this.offsetLabel(at)})`;
  }

  /** `YYYY-MM-DDTHH:mm` без подписи — формат ввода, обратный `parseLocal`. */
  formatInput(at: Timestamp): string {
    const p = this.local(at);
    return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
  }

  /**
   * Подпись смещения на момент: `UTC+5`, `UTC+5:30`, `UTC-3`, `UTC` при нуле.
   * Знак — настоящее смещение, обратный знак имён `Etc/GMT±N` скрыт.
   */
  offsetLabel(at: Timestamp): string {
    const offset = this.offsetMinutes(at);
    if (offset === 0) return 'UTC';
    const sign = offset < 0 ? '-' : '+';
    const abs = Math.abs(offset);
    const minutes = abs % 60;
    const hours = (abs - minutes) / 60;
    return `UTC${sign}${hours}${minutes ? `:${pad2(minutes)}` : ''}`;
  }

  /** Смещение местного времени от UTC на момент, в минутах. */
  private offsetMinutes(at: Timestamp): number {
    const p = this.local(at);
    const localAsUtc = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    // Форматтер отбрасывает миллисекунды — сравниваем с началом секунды.
    const wholeSecond = at - (((at % 1000) + 1000) % 1000);
    return Math.round((localAsUtc - wholeSecond) / MINUTE_MS);
  }

  private local(at: Timestamp): LocalParts {
    const f: Record<string, string> = {};
    for (const { type, value } of this.parts.formatToParts(at)) f[type] = value;
    return {
      year: (f.year ?? '').padStart(4, '0'),
      month: f.month ?? '',
      day: f.day ?? '',
      hour: f.hour ?? '',
      minute: f.minute ?? '',
      second: f.second ?? '',
    };
  }
}
