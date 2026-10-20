import { JsonFileRepo } from '@u7-scl/core/infra';
import type { WishRepo, WishStatus, WishTargetVo } from '@u7-scl/domain/wish';
import { WishPolicy, WishState } from '@u7-scl/domain/wish';

/** Проверяет равенство целей желания (сравнение по варианту и его ключам). */
function isSameTarget(a: WishTargetVo, b: WishTargetVo): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'course' && b.kind === 'course') {
    return a.courseId === b.courseId;
  }
  if (a.kind === 'module' && b.kind === 'module') {
    return a.moduleId === b.moduleId;
  }
  return false;
}

/**
 * JSON-файловая реализация репозитория желаний.
 * Хранит данные в JSON-файле через {@link JsonFileRepo}.
 */
export class WishJsonRepo implements WishRepo {
  readonly #repo: JsonFileRepo<WishState>;

  constructor(filePath = 'data/wish/wishes.json') {
    this.#repo = new JsonFileRepo(WishState, filePath);
  }

  async save(wish: WishState): Promise<void> {
    const all = await this.#repo.readAll();
    const idx = all.findIndex((w) => w.uuid === wish.uuid);
    if (idx !== -1) {
      all[idx] = wish;
    } else {
      all.push(wish);
    }
    await this.#repo.writeAll(all);
  }

  async getByUuid(uuid: string): Promise<WishState | undefined> {
    const all = await this.#repo.readAll();
    return all.find((w) => w.uuid === uuid);
  }

  async findAllByUserAndTarget(
    userId: string,
    target: WishTargetVo,
  ): Promise<WishState[]> {
    const all = await this.#repo.readAll();
    return all.filter(
      (w) => w.userId === userId && isSameTarget(w.target, target),
    );
  }

  async getByUserAndTarget(
    userId: string,
    target: WishTargetVo,
  ): Promise<WishState | undefined> {
    const matches = await this.findAllByUserAndTarget(userId, target);
    // При равных createdAt порядок записей недетерминирован, поэтому
    // сначала сужаем выборку до активных желаний (релевантных для
    // потребителей: отмена, экран W04, ER-реакции), и только среди
    // них берём последнее созданное.
    const active = matches.filter((w) => WishPolicy.isActive(w.status));
    const pool = active.length > 0 ? active : matches;
    pool.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return pool[0];
  }

  async getByUser(userId: string): Promise<WishState[]> {
    const all = await this.#repo.readAll();
    return all.filter((w) => w.userId === userId);
  }

  async findAllByKind(
    kind: 'course' | 'module',
    statuses?: WishStatus[],
  ): Promise<WishState[]> {
    const all = await this.#repo.readAll();
    return all.filter(
      (w) =>
        w.target.kind === kind && (!statuses || statuses.includes(w.status)),
    );
  }
}
