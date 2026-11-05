import {
  GetModuleSnapshotUcDef,
  ModuleErrors,
} from '@u7-scl/domain/course/contract';
import { UseCaseDef } from 'dmg-core';
import * as v from 'valibot';
import { StreamArDef } from '../stream.ar';
import { StreamEvents } from '../stream.events';
import { StreamPolicy } from '../stream.policy';
import { StreamState } from '../stream.state';

const { entries } = StreamState;

/**
 * Создание потока — сразу в наборе. Ментор потока — субъект, школа — из
 * настроек приложения, поэтому их во входе нет; снимок контента UC берёт
 * у модуля курсов в момент создания (`getModuleSnapshot`).
 */
export const CreateStreamUcDef = UseCaseDef.define({
  name: 'createStream',
  label: 'Создать поток',
  description:
    'Создаёт поток по модулю курса с набором студентов и фиксирует снимок контента модуля.',
  type: 'command',
  aggregate: StreamArDef,
  callers: ['user'],
  policy: StreamPolicy.rules.canCreate,
  calls: [GetModuleSnapshotUcDef],
  input: v.object({
    title: entries.title,
    description: entries.description,
    moduleId: entries.moduleId,
    startDate: entries.startDate,
    telegramGroupId: entries.telegramGroupId,
    telegramGroupInvite: entries.telegramGroupInvite,
    goal: entries.goal,
    result: entries.result,
    rules: entries.rules,
    additional: entries.additional,
    targetAudience: entries.targetAudience,
    enrollmentKey: entries.enrollmentKey,
  }),
  output: v.object({ streamId: entries.uuid }),
  errors: [ModuleErrors.NOT_FOUND],
  emits: [StreamEvents.created],
});
