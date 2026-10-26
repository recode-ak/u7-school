// Чистая пара модулей для контрактных проверок: `alpha` зависит от `beta`,
// слушает его событие и вызывает его UC через фасад (`calls`, D-42). Негативные фикстуры — в тестах,
// как варианты этих Def.
import * as v from 'valibot';
import { defineAggregate } from '../domain/aggregate/define-aggregate';
import { defineEventReaction } from '../domain/contracts/define-event-reaction';
import { defineJob } from '../domain/contracts/define-job';
import { defineModule } from '../domain/contracts/define-module';
import { defineUseCase } from '../domain/contracts/define-use-case';
import { defineEvents } from '../domain/events/define-events';
import { allowAll } from '../domain/policy/policy';
import { defineErrors } from '../kernel/errors/define-errors';
import { BaseEntityFields, F } from '../kernel/fields/fields';

export const ItemEvents = defineEvents('beta.item', {
  created: {
    label: 'Позиция создана',
    description: 'Появилась новая позиция.',
    payload: v.object({ itemId: F.uuid('позиции') }),
  },
});

export const ItemErrors = defineErrors('ITEM', {
  NOT_FOUND: {
    kind: 'not_found',
    label: 'Позиция не найдена',
    description: 'Позиции с таким идентификатором нет.',
    payload: v.object({ itemId: F.uuid('позиции') }),
  },
});

export const ItemArDef = defineAggregate({
  name: 'item',
  label: 'Позиция',
  description: 'Позиция каталога.',
  state: v.object({ ...BaseEntityFields, title: F.string('Название') }),
  events: ItemEvents,
  errors: ItemErrors,
});

export const CreateItemUcDef = defineUseCase({
  name: 'createItem',
  label: 'Создать позицию',
  description: 'Добавляет позицию в каталог.',
  type: 'command',
  aggregate: ItemArDef,
  callers: ['user'],
  policy: allowAll,
  input: v.object({ title: F.string('Название') }),
  output: v.object({ itemId: F.uuid('позиции') }),
  errors: [],
  emits: [ItemEvents.created],
});

export const GetItemUcDef = defineUseCase({
  name: 'getItem',
  label: 'Позиция',
  description: 'Позиция по идентификатору — для других модулей.',
  type: 'query',
  aggregate: ItemArDef,
  callers: ['system'],
  policy: allowAll,
  input: v.object({ itemId: F.uuid('позиции') }),
  output: v.object({ title: F.string('Название') }),
  errors: [ItemErrors.NOT_FOUND],
});

export const BetaModuleDef = defineModule({
  name: 'beta',
  label: 'Каталог',
  description: 'Модуль-зависимость.',
  dependsOn: [],
  aggregates: [ItemArDef],
  useCases: [CreateItemUcDef, GetItemUcDef],
  reactions: [],
  jobs: [],
});

export const NoteEvents = defineEvents('alpha.note', {
  added: {
    label: 'Заметка добавлена',
    description: 'К позиции добавлена заметка.',
    payload: v.object({ noteId: F.uuid('заметки') }),
  },
});

export const NoteErrors = defineErrors('NOTE', {
  EMPTY: {
    kind: 'validation',
    label: 'Пустая заметка',
    description: 'Текст заметки пуст.',
  },
});

export const NoteArDef = defineAggregate({
  name: 'note',
  label: 'Заметка',
  description: 'Заметка к позиции.',
  state: v.object({ ...BaseEntityFields, text: F.string('Текст') }),
  events: NoteEvents,
  errors: NoteErrors,
});

export const AddNoteErDef = defineEventReaction({
  name: 'addNote',
  label: 'Добавить заметку',
  description: 'К новой позиции добавляется заметка.',
  on: [ItemEvents.created],
  touches: [NoteArDef],
  calls: [GetItemUcDef],
  emits: [NoteEvents.added],
});

export const PurgeNotesJobDef = defineJob({
  name: 'purgeNotes',
  label: 'Чистка заметок',
  description: 'Удаляет старые заметки.',
  schedule: { kind: 'dailyAt', hour: 4, minute: 0 },
  scans: [NoteArDef],
});

export const AlphaModuleDef = defineModule({
  name: 'alpha',
  label: 'Заметки',
  description: 'Модуль, который зависит от каталога.',
  dependsOn: [BetaModuleDef],
  aggregates: [NoteArDef],
  useCases: [],
  reactions: [AddNoteErDef],
  jobs: [PurgeNotesJobDef],
});
