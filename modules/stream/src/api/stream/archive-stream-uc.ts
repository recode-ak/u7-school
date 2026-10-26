import type { User } from '@u7-scl/app/domain';
import {
  type ArchiveStreamCmd,
  type ArchiveStreamCmdMeta,
  ArchiveStreamCmdSchema,
  StreamAr,
  StreamPolicy,
} from '@u7-scl/domain/stream';
import * as v from 'valibot';
import { StreamUseCase } from '../stream-uc';

export class ArchiveStreamUc extends StreamUseCase<ArchiveStreamCmdMeta> {
  protected readonly ucName = 'archive-stream' as const;
  protected readonly ucLabel = 'Архивировать поток' as const;
  protected readonly arMeta = {
    arName: 'Stream' as const,
    arLabel: 'Поток' as const,
  };
  protected readonly type = 'command' as const;
  protected readonly requiresAuth = true as const;
  protected readonly inputSchema = ArchiveStreamCmdSchema;
  protected readonly outputSchema = v.undefined();

  async execute(command: ArchiveStreamCmd, actor: User): Promise<undefined> {
    const streamEntity = await this.getStream(command.streamId);

    // Проверка прав: ментор потока или админ
    if (!StreamPolicy.canEdit(actor, streamEntity)) {
      this.throwAccessDenied();
    }

    const streamAr = new StreamAr(streamEntity);

    streamAr.archive();

    await this.resolve.streamRepo.save(streamAr.state);
    return undefined;
  }
}
