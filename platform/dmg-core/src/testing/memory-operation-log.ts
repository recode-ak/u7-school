import type {
  OperationLog,
  OperationRecord,
} from '../app/oplog/operation-record';

/** Лог операций в памяти: тест читает записи из `records`. */
export class MemoryOperationLog implements OperationLog {
  readonly records: OperationRecord[] = [];

  async append(record: OperationRecord): Promise<void> {
    this.records.push(record);
  }
}
