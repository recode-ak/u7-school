import {
  GetCoursesIncludingModuleUcDef,
  GetSameModulesUcDef,
} from '@u7-scl/domain/course/contract';
import { StudentEvents } from '@u7-scl/domain/stream/contract';
import { defineEventReaction } from 'dmg-core';
import { WishArDef } from '../wish.ar';

/**
 * Реализация желаний зачислением. Что спросить у курса и какие желания
 * реализовать, решает `WishFulfillmentDcs`; события реализации у `wish` нет.
 */
export const FulfillWishErDef = defineEventReaction({
  name: 'fulfillWish',
  label: 'Отметить желание реализованным',
  description:
    'Когда студент зачислен на поток, его желания пройти курс этого модуля или сам модуль становятся реализованными; остальные желания не меняются.',
  on: [StudentEvents.enrolled],
  touches: [WishArDef],
  calls: [GetCoursesIncludingModuleUcDef, GetSameModulesUcDef],
  emits: [],
});
