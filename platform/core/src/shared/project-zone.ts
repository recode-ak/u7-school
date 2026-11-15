import type { Timestamp } from 'dmg-core';

/** Уральск (UTC+5, без летнего времени), в минутах. */
const DEFAULT_OFFSET_MINUTES = 300;

const MINUTE_MS = 60_000;
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/**
 * Часовая зона проекта с фиксированным смещением: ввод и показ времени
 * людям. Единственное место, где метка времени (UTC) переводится
 * в местное время и обратно.
 */
export class ProjectZone {
  private readonly offsetMinutes: number;

  constructor(offsetMinutes: number) {
    this.offsetMinutes = offsetMinutes;
  }

  static default(): ProjectZone {
    return new ProjectZone(DEFAULT_OFFSET_MINUTES);
  }

  /**
   * Разбирает местное `YYYY-MM-DD` (полночь) или `YYYY-MM-DDTHH:mm` в метку UTC.
   * Невалидный ввод (несуществующая дата, секунды, `Z`, мусор) — `undefined`.
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
    // Обратное форматирование отсекает переполнение (31 февраля, 25:00)
    const back = new Date(localAsUtc).toISOString();
    const expected = `${y}-${mo}-${d}T${h}:${mi}`;
    if (back.slice(0, 16) !== expected) return undefined;
    return localAsUtc - this.offsetMinutes * MINUTE_MS;
  }

  /** `дд.мм.гггг` */
  formatDate(at: Timestamp): string {
    const [y, mo, d] = this.local(at);
    return `${d}.${mo}.${y}`;
  }

  /** `чч:мм` */
  formatTime(at: Timestamp): string {
    const [, , , h, mi] = this.local(at);
    return `${h}:${mi}`;
  }

  /** `YYYY-MM-DDTHH:mm` — формат ввода, обратный `parseLocal`. */
  formatInput(at: Timestamp): string {
    const [y, mo, d, h, mi] = this.local(at);
    return `${y}-${mo}-${d}T${h}:${mi}`;
  }

  /** Компоненты местного времени: [гггг, мм, дд, чч, мин]. */
  private local(at: Timestamp): string[] {
    return new Date(at + this.offsetMinutes * MINUTE_MS)
      .toISOString()
      .slice(0, 16)
      .split(/[-T:]/);
  }
}
