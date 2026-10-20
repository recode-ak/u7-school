import {
  type ListStreamsCmd,
  type ListStreamsCmdMeta,
  ListStreamsCmdSchema,
  type Stream,
  StreamSchema,
} from '@u7-scl/domain/stream';
import * as v from 'valibot';
import { StreamUseCase } from '../stream-uc';

export class ListStreamsUc extends StreamUseCase<ListStreamsCmdMeta> {
  protected readonly ucName = 'list-streams' as const;
  protected readonly ucLabel = 'Список потоков' as const;
  protected readonly arMeta = {
    arName: 'Stream' as const,
    arLabel: 'Поток' as const,
  };
  protected readonly type = 'query' as const;
  protected readonly requiresAuth = false as const;
  protected readonly inputSchema = ListStreamsCmdSchema;
  protected readonly outputSchema = v.array(StreamSchema);

  async execute(command: ListStreamsCmd): Promise<Stream[]> {
    const repo = this.resolve.streamRepo;
    return repo.getAll(command);
  }
}
