import { createHmac } from 'node:crypto';

/**
 * Непрозрачный стабильный идентификатор посетителя канала для `trace.channel.visitorId`
 * (F-111, D-86): в лог операций Telegram ID не попадает. Один `telegramId` — один id
 * (на нём держится отсев повторов гостя, `command-replay.ts`); обратно id в
 * `telegramId` не превращается без ключа.
 *
 * Ключ — токен бота из конфига, задаётся при старте; пустой ключ — ошибка:
 * без него id подбирается перебором Telegram ID.
 */
export class VisitorId {
  readonly #key: string;

  constructor(key: string) {
    if (key === '') throw new Error('Ключ VisitorId не может быть пустым');
    this.#key = key;
  }

  static #installed?: VisitorId;

  /** Ключ задаётся один раз при старте процесса (`main.ts`); в тестах — прелоад. */
  static install(key: string): void {
    const next = new VisitorId(key);
    const current = VisitorId.#installed;
    if (current === undefined) {
      VisitorId.#installed = next;
      return;
    }
    // Тот же ключ — идемпотентно; другой — молчаливая подмена сломала бы стабильность id.
    if (current.#key !== key) {
      throw new Error('VisitorId уже настроен другим ключом');
    }
  }

  /** Установленный экземпляр; без `install` — ошибка конфигурации, а не молчаливый запасной ключ. */
  static installed(): VisitorId {
    if (VisitorId.#installed === undefined) {
      throw new Error('VisitorId не настроен: вызови VisitorId.install(ключ)');
    }
    return VisitorId.#installed;
  }

  /** Первые 16 hex HMAC-SHA256 от `telegramId`. */
  of(telegramId: number): string {
    return createHmac('sha256', this.#key)
      .update(String(telegramId))
      .digest('hex')
      .slice(0, 16);
  }
}
