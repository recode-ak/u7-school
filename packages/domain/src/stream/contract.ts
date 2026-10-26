/** Контракт модуля stream: паспорт внешнего модуля (D-37), события, фасад, ошибки. */
export * from './errors';
export type { StreamFacade, StreamMember, StreamMembers } from './facade';
export { StreamArDef } from './stream/stream.ar';
export { StreamEvents } from './stream/stream.events';
export {
  GetStreamPresenceUcDef,
  type StreamPresence,
} from './stream/uc/get-stream-presence.uc';
export { StreamModuleDef } from './stream.module';
export { StudentEvents } from './student/student.events';
