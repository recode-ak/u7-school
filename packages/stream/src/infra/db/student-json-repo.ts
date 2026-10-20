import { JsonFileRepo } from '@u7-scl/core/infra';
import type { Student, StudentRepo } from '@u7-scl/domain/stream';
import { StudentSchema } from '@u7-scl/domain/stream';

/**
 * JSON-файловая реализация репозитория студентов потока.
 */
export class StudentJsonRepo implements StudentRepo {
  readonly #repo: JsonFileRepo<Student>;

  constructor(filePath: string) {
    this.#repo = new JsonFileRepo(StudentSchema, filePath);
  }

  async save(student: Student): Promise<void> {
    const all = await this.#repo.readAll();
    const idx = all.findIndex((s) => s.uuid === student.uuid);

    if (idx !== -1) {
      all[idx] = student;
    } else {
      all.push(student);
    }

    await this.#repo.writeAll(all);
  }

  async getByUuid(uuid: string): Promise<Student | undefined> {
    const all = await this.#repo.readAll();
    return all.find((s) => s.uuid === uuid);
  }

  async getByStream(streamId: string): Promise<Student[]> {
    const all = await this.#repo.readAll();
    return all.filter((s) => s.streamId === streamId);
  }

  async getByUser(userId: string): Promise<Student[]> {
    const all = await this.#repo.readAll();
    return all.filter((s) => s.userId === userId);
  }

  async getByStatuses(statuses: Array<Student['status']>): Promise<Student[]> {
    const all = await this.#repo.readAll();
    return all.filter((s) => statuses.includes(s.status));
  }
}
